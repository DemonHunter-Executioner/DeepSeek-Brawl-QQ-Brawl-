// 存档：一个 JSON 文件，原子写，坏了就回退到新档（不抛异常，鲸鱼不能因为写盘失败消失）。
//
// 0.2.0 从「企鹅」改名成「鲸鱼」，数据目录也跟着换了；首次启动会尝试把旧档搬过来，
// 这样已经练到 2 级的那条鱼不会因为改名就归零。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  applyDecay,
  clamp,
  createPet,
  formOf,
  newCare,
  refreshPet,
  skillsFor,
  statsAt,
} from './game.js'

export const SAVE_VERSION = 1
export const DATA_DIR = 'dsh-whale-battle'
export const LEGACY_DIR = 'dsh-penguin-battle'

/** 和 dsh-tts 一致：DSH_HOME 优先，其次 ~/.dsh。 */
export function resolveHome(config) {
  const fromConfig = typeof config?.home === 'string' && config.home.trim() ? config.home.trim() : ''
  if (fromConfig) return fromConfig
  const fromEnv = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() ? process.env.DSH_HOME.trim() : ''
  if (fromEnv) return fromEnv
  return path.join(os.homedir(), '.dsh')
}

export function dataDirOf(home) {
  return path.join(home, DATA_DIR)
}

export function savePathOf(home) {
  return path.join(dataDirOf(home), 'save.json')
}

export function legacySavePathOf(home) {
  return path.join(home, LEGACY_DIR, 'save.json')
}

export function newPlayerState() {
  const pet = createPet({ name: '小鲸鱼', element: 'neutral', level: 1 })
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    gold: 60,
    food: 3,
    team: [pet],
    care: newCare(),
    cleared: [],
    stats: { battles: 0, wins: 0, losses: 0, bestRound: 0 },
    log: [],
  }
}

/** 把磁盘上的旧档修成当前形状。缺什么补什么，多余字段忽略。 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return newPlayerState()
  const state = newPlayerState()
  state.createdAt = Number(raw.createdAt) || state.createdAt
  state.gold = Math.max(0, Math.round(Number(raw.gold) || 0))
  state.food = Math.max(0, Math.round(Number(raw.food) || 0))
  state.cleared = Array.isArray(raw.cleared)
    ? raw.cleared.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : []
  state.stats = { ...state.stats, ...(raw.stats && typeof raw.stats === 'object' ? raw.stats : {}) }
  state.care = { ...newCare(), ...(raw.care && typeof raw.care === 'object' ? raw.care : {}) }
  if (Array.isArray(raw.team) && raw.team.length > 0) {
    state.team = raw.team.slice(0, 3).map((pet) => normalizePet(pet)).filter(Boolean)
  }
  if (state.team.length === 0) state.team = [createPet({ name: '小鲸鱼', element: 'neutral', level: 1 })]
  state.log = Array.isArray(raw.log) ? raw.log.slice(-30) : []
  return state
}

export function normalizePet(raw) {
  const level = clamp(Math.round(Number(raw?.level) || 1), 1, 60)
  const element = ['neutral', 'ice', 'water', 'fire'].includes(raw?.element) ? raw.element : 'neutral'
  const pet = {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `pet-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof raw?.name === 'string' && raw.name ? raw.name.slice(0, 12) : '小鲸鱼',
    element,
    level,
    exp: Math.max(0, Math.round(Number(raw?.exp) || 0)),
    stats: raw?.stats && typeof raw.stats === 'object' ? raw.stats : statsAt(level, element),
    skills: Array.isArray(raw?.skills) ? raw.skills : skillsFor(level, element),
    form: Number(raw?.form) || formOf(level).tier,
    bornAt: Number(raw?.bornAt) || Date.now(),
  }
  return refreshPet(pet)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 读档。新目录没有档时，尝试从旧企鹅目录迁移一次。
 * @returns {{ state:object, file:string, fresh:boolean, migrated:boolean }}
 */
export function loadState(home) {
  const file = savePathOf(home)
  const direct = readJson(file)
  if (direct) return { state: normalizeState(direct), file, fresh: false, migrated: false }

  const legacyFile = legacySavePathOf(home)
  const legacy = readJson(legacyFile)
  if (legacy) {
    const state = normalizeState(legacy)
    // 旧档里的名字可能是企鹅时期的，迁过来时换个默认名
    state.team = state.team.map((pet) => (pet.name === '小企鹅' ? { ...pet, name: '小鲸鱼' } : pet))
    try {
      saveState(home, state)
    } catch {
      // 迁移写盘失败不影响本次运行
    }
    return { state, file, fresh: false, migrated: true }
  }

  return { state: newPlayerState(), file, fresh: true, migrated: false }
}

export function saveState(home, state) {
  const file = savePathOf(home)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const payload = JSON.stringify({ ...state, updatedAt: Date.now() }, null, 2)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, payload, 'utf8')
  fs.renameSync(tmp, file)
  return file
}

/** 读取 + 结算离线衰减；只有真的过了时间才写回。 */
export function touchState(home) {
  const { state, file, fresh, migrated } = loadState(home)
  const before = Number(state.care.lastTick) || 0
  applyDecay(state.care)
  state.team.forEach((pet) => refreshPet(pet))
  if (fresh || migrated || Date.now() - before > 60_000) saveState(home, state)
  return { state, file, fresh, migrated }
}

/** 往状态里追加一行「最近发生的事」，只留最近 30 条。 */
export function pushEvent(state, entry) {
  state.log = [...(state.log || []), { at: Date.now(), ...entry }].slice(-30)
  return state
}
