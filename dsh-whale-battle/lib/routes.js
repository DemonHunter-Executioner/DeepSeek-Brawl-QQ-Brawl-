// /dsh-whale-battle/*：客户端和 agent 工具共用的一套 HTTP 面。
//
// 和 dsh-tts 一样：同源、无额外 token；非 GET 再验一个 JSON content-type 挡 CSRF。
// 战斗在宿主侧结算（种子随请求发出、日志整段返回），客户端只负责播动画——
// 这样 UI 里改什么都不会影响数值，回放也永远和真实结算一致。
import {
  ELEMENTS,
  FORMS,
  SKILLS,
  STAGES,
  applyDecay,
  careModifiers,
  clamp,
  createPet,
  expToNext,
  formOf,
  grantExp,
  refreshPet,
  rewardsFor,
  enemyTeam,
  simulateBattle,
  stageUnlocked,
} from './game.js'
import { loadState, pushEvent, resolveHome, saveState, savePathOf, touchState } from './store.js'
import { todayWork, workBonus, workGold } from './worklog.js'
import { close as closeDesktop, isRunning as desktopRunning, open as openDesktop, status as desktopStatus } from './desktop.js'

export const ROUTE_PREFIX = '/dsh-whale-battle'

const SECURITY_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

function sendJson(res, status, payload) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('请求体太大'), { statusCode: 413 })
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON'), { statusCode: 400 })
  }
}

function guard(req, res, methods) {
  if (!methods.includes(req.method)) {
    sendJson(res, 405, { ok: false, error: `不支持 ${req.method}` })
    return false
  }
  if (req.method !== 'GET') {
    if (!sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: '跨站请求被拒绝' })
      return false
    }
    const type = String(req.headers['content-type'] || '')
    if (!type.includes('application/json')) {
      sendJson(res, 415, { ok: false, error: 'content-type 必须是 application/json' })
      return false
    }
  }
  return true
}

/* ------------------------------------------------------------ 视图组装 */

function petView(pet) {
  const form = formOf(pet.level)
  return {
    id: pet.id,
    name: pet.name,
    element: pet.element,
    elementName: ELEMENTS[pet.element]?.name || '萌',
    elementColor: ELEMENTS[pet.element]?.color || '#ffd166',
    level: pet.level,
    exp: pet.exp,
    expToNext: expToNext(pet.level),
    stats: pet.stats,
    skills: pet.skills,
    skillDetails: pet.skills.map((id) => {
      const skill = SKILLS[id]
      return {
        id,
        name: skill?.name || id,
        el: skill?.el || 'neutral',
        elementName: ELEMENTS[skill?.el]?.name || '萌',
        kind: skill?.kind || 'attack',
        power: skill?.power || 0,
        cost: skill?.cost || 0,
        unlock: skill?.unlock || 1,
        desc: skill?.desc || '',
      }
    }),
    form: form.tier,
    formName: form.name,
    formTitle: form.title,
  }
}

function stageView(stage, state) {
  const leadLevel = state.team[0]?.level || 1
  return {
    ...stage,
    cleared: state.cleared.includes(stage.id),
    unlocked: stageUnlocked(stage.id, state.cleared),
    preview: enemyTeam(stage.id, leadLevel, stage.id).map((pet) => ({
      name: pet.name,
      level: pet.level,
      element: pet.element,
      elementName: ELEMENTS[pet.element]?.name || '萌',
      elementColor: ELEMENTS[pet.element]?.color || '#ffd166',
    })),
  }
}

export function snapshot(home) {
  const { state, fresh } = touchState(home)
  const work = todayWork(home)
  const bonus = workBonus(work)
  const lead = state.team[0]
  const mods = careModifiers(state.care)
  return {
    ok: true,
    fresh,
    gold: state.gold,
    food: state.food,
    care: {
      hunger: Math.round(state.care.hunger),
      clean: Math.round(state.care.clean),
      mood: Math.round(state.care.mood),
      stamina: Math.round(state.care.stamina),
      workReadyAt: Number(state.care.workReadyAt) || 0,
      workReadyIn: Math.max(0, (Number(state.care.workReadyAt) || 0) - Date.now()),
      sleepReadyAt: Number(state.care.sleepReadyAt) || 0,
      sleepReadyIn: Math.max(0, (Number(state.care.sleepReadyAt) || 0) - Date.now()),
    },
    team: state.team.map(petView),
    lead: lead ? petView(lead) : null,
    mods,
    cleared: state.cleared,
    stages: STAGES.map((stage) => stageView(stage, state)),
    stats: state.stats,
    log: state.log.slice(-12),
    work: {
      steps: work.steps,
      toolCalls: work.toolCalls,
      toolErrors: work.toolErrors,
      turns: work.turns,
      sessions: work.sessions,
      files: work.files,
      bonus,
      bonusPct: Math.round(bonus * 100),
      workGold: workGold(work, lead?.level || 1),
    },
    forms: FORMS,
    elementChart: {
      ice: { strong: 'water', weak: 'fire' },
      water: { strong: 'fire', weak: 'ice' },
      fire: { strong: 'ice', weak: 'water' },
    },
    savePath: savePathOf(home),
    desktop: { running: desktopRunning() },
  }
}

/* -------------------------------------------------------------- 动作 */

const CARE_COST = { feed: 8, bath: 6, play: 0, sleep: 0, work: 0, train: 0 }
const WORK_COOLDOWN_MS = 10 * 60 * 1000
const SLEEP_COOLDOWN_MS = 3 * 60 * 1000

export function doCare(state, home, action) {
  const care = state.care
  applyDecay(care)
  const lead = state.team[0]
  if (!lead) throw Object.assign(new Error('队伍里没有鲸鱼'), { statusCode: 400 })

  if (action === 'feed') {
    if (state.gold < CARE_COST.feed) throw Object.assign(new Error('金币不够，先去打工'), { statusCode: 400 })
    state.gold -= CARE_COST.feed
    care.hunger = clamp(care.hunger + 32, 0, 100)
    care.mood = clamp(care.mood + 6, 0, 100)
    pushEvent(state, { kind: 'care', text: `${lead.name} 吃了一顿，饱食 +32` })
  } else if (action === 'bath') {
    if (state.gold < CARE_COST.bath) throw Object.assign(new Error('金币不够，先去打工'), { statusCode: 400 })
    state.gold -= CARE_COST.bath
    care.clean = clamp(care.clean + 38, 0, 100)
    care.mood = clamp(care.mood + 8, 0, 100)
    pushEvent(state, { kind: 'care', text: `${lead.name} 洗了个澡，清洁 +38` })
  } else if (action === 'play') {
    if (care.stamina < 10) throw Object.assign(new Error('体力不够了，让它睡会儿'), { statusCode: 400 })
    care.stamina = clamp(care.stamina - 10, 0, 100)
    care.mood = clamp(care.mood + 16, 0, 100)
    care.hunger = clamp(care.hunger - 5, 0, 100)
    pushEvent(state, { kind: 'care', text: `${lead.name} 追着自己的影子玩了一会儿，心情 +16` })
  } else if (action === 'sleep') {
    const readyAt = Number(care.sleepReadyAt) || 0
    if (Date.now() < readyAt) throw Object.assign(new Error('刚睡醒，再等等'), { statusCode: 429 })
    care.sleepReadyAt = Date.now() + SLEEP_COOLDOWN_MS
    care.stamina = clamp(care.stamina + 42, 0, 100)
    care.mood = clamp(care.mood + 4, 0, 100)
    pushEvent(state, { kind: 'care', text: `${lead.name} 眯了一觉，体力 +42` })
  } else if (action === 'work') {
    if (Date.now() < (Number(care.workReadyAt) || 0)) {
      const left = Math.ceil(((Number(care.workReadyAt) || 0) - Date.now()) / 60000)
      throw Object.assign(new Error(`刚打完一份工，${left} 分钟后再来`), { statusCode: 429 })
    }
    if (care.stamina < 20) throw Object.assign(new Error('体力不足 20，打不了工'), { statusCode: 400 })
    const work = todayWork(home)
    const gold = workGold(work, lead.level)
    care.stamina = clamp(care.stamina - 20, 0, 100)
    care.mood = clamp(care.mood - 4, 0, 100)
    care.workReadyAt = Date.now() + WORK_COOLDOWN_MS
    state.gold += gold
    const gained = grantExp(lead, 12)
    pushEvent(state, { kind: 'work', text: `${lead.name} 打了一份工，赚到 ${gold} 金币${gained ? '，升级了！' : ''}` })
  } else if (action === 'train') {
    if (care.stamina < 15) throw Object.assign(new Error('体力不足 15，练不动'), { statusCode: 400 })
    care.stamina = clamp(care.stamina - 15, 0, 100)
    const exp = 10 + lead.level * 3
    const gained = grantExp(lead, exp)
    pushEvent(state, { kind: 'train', text: `${lead.name} 自己练了会儿，经验 +${exp}${gained ? '，升级了！' : ''}` })
  } else {
    throw Object.assign(new Error(`未知动作 ${action}`), { statusCode: 400 })
  }
  state.team = state.team.map((pet) => refreshPet(pet))
  return snapshotAfter(home, state)
}

function snapshotAfter(home, state) {
  saveState(home, state)
  return snapshot(home)
}

/* ------------------------------------------------------------- 战斗 */

export function doBattle(state, home, stageId) {
  applyDecay(state.care)
  const stage = STAGES.find((item) => item.id === Number(stageId))
  if (!stage) throw Object.assign(new Error('没有这个关卡'), { statusCode: 404 })
  if (!stageUnlocked(stage.id, state.cleared)) throw Object.assign(new Error('还没解锁，先过上一关'), { statusCode: 400 })
  if (state.team.length === 0) throw Object.assign(new Error('队伍里没有鲸鱼'), { statusCode: 400 })

  const care = state.care
  if (care.stamina < 12) throw Object.assign(new Error('体力不足 12，打不动了，让它睡会儿'), { statusCode: 400 })

  const mods = careModifiers(care)
  const playerTeam = state.team.map((pet) => ({ ...pet, mods }))
  const seed = Math.floor(Math.random() * 2 ** 31)
  const enemies = enemyTeam(stage.id, state.team[0].level, seed)
  const battle = simulateBattle(playerTeam, enemies, seed)

  const work = todayWork(home)
  const bonus = workBonus(work)
  const result = {
    stage: { id: stage.id, name: stage.name, element: stage.element, boss: stage.boss || null },
    winner: battle.winner,
    rounds: battle.rounds,
    seed,
    mvp: battle.mvp,
    player: battle.a.map((unit) => ({ ...unit, elementName: ELEMENTS[unit.element]?.name })),
    enemies: battle.b.map((unit) => ({ ...unit, elementName: ELEMENTS[unit.element]?.name })),
    log: battle.log,
    rewards: null,
  }

  const lead = state.team[0]
  care.stamina = clamp(care.stamina - 12, 0, 100)
  state.stats.battles += 1

  if (battle.winner === 'a') {
    const firstClear = !state.cleared.includes(stage.id)
    const base = rewardsFor(stage.id, lead.level, bonus)
    const rewards = {
      gold: base.gold + (firstClear ? 40 : 0),
      exp: base.exp,
      firstClear,
      levels: 0,
    }
    state.gold += rewards.gold
    // 经验只给活着的那几只，全灭就谁都没有（赢了至少有一只活着）
    const aliveIndex = new Set(battle.a.filter((unit) => unit.alive).map((unit) => unit.index))
    let leveled = 0
    state.team.forEach((pet, index) => {
      const share = aliveIndex.has(index) ? 1 : 0.4
      leveled += grantExp(pet, Math.round(rewards.exp * share))
    })
    rewards.levels = leveled
    if (firstClear) state.cleared = [...state.cleared, stage.id].sort((a, b) => a - b)
    state.stats.wins += 1
    if (!state.stats.bestRound || battle.rounds < state.stats.bestRound) state.stats.bestRound = battle.rounds
    care.mood = clamp(care.mood + 10, 0, 100)
    care.hunger = clamp(care.hunger - 4, 0, 100)
    pushEvent(state, { kind: 'win', text: `打赢了「${stage.name}」，金币 +${rewards.gold}，经验 +${rewards.exp}` })
    result.rewards = rewards
  } else {
    state.stats.losses += 1
    care.mood = clamp(care.mood - 8, 0, 100)
    pushEvent(state, { kind: 'lose', text: `在「${stage.name}」被打回来了` })
  }

  state.team = state.team.map((pet) => refreshPet(pet))
  result.state = snapshotAfter(home, state)
  result.state = { ...result.state, ok: true }
  return result
}

/* ------------------------------------------------------------- 注册 */

export function registerRoutes(scope, deps) {
  const { home = resolveHome(deps?.config), logger } = deps || {}
  const disposers = []
  const route = (pathname, handler) => {
    disposers.push(scope.webServer.register({ kind: 'exact', path: pathname, handler }))
  }
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res)
    } catch (error) {
      const status = Number(error?.statusCode) || 400
      sendJson(res, status, { ok: false, error: String(error?.message ?? error) })
    }
  }

  route(`${ROUTE_PREFIX}/ping`, wrap(async (req, res) => {
    if (!guard(req, res, ['GET'])) return
    sendJson(res, 200, { ok: true, pong: Date.now() })
  }))

  route(`${ROUTE_PREFIX}/state`, wrap(async (req, res) => {
    if (!guard(req, res, ['GET'])) return
    sendJson(res, 200, snapshot(home))
  }))

  route(`${ROUTE_PREFIX}/care`, wrap(async (req, res) => {
    if (!guard(req, res, ['POST'])) return
    const body = await readJson(req)
    const { state } = loadState(home)
    const action = String(body?.action || '')
    const view = doCare(state, home, action)
    sendJson(res, 200, view)
  }))

  route(`${ROUTE_PREFIX}/battle`, wrap(async (req, res) => {
    if (!guard(req, res, ['POST'])) return
    const body = await readJson(req)
    const { state } = loadState(home)
    const result = doBattle(state, home, Number(body?.stageId))
    sendJson(res, 200, { ok: true, ...result })
  }))

  route(`${ROUTE_PREFIX}/recruit`, wrap(async (req, res) => {
    if (!guard(req, res, ['POST'])) return
    const body = await readJson(req)
    const { state } = loadState(home)
    if (state.team.length >= 3) throw Object.assign(new Error('队伍满了（最多 3 只）'), { statusCode: 400 })
    const cost = 120 + state.team.length * 80
    if (state.gold < cost) throw Object.assign(new Error(`招募要 ${cost} 金币，还差 ${cost - state.gold}`), { statusCode: 400 })
    const element = ['ice', 'water', 'fire', 'neutral'].includes(body?.element) ? body.element : 'water'
    const names = { ice: '冰球', water: '水泡', fire: '火苗', neutral: '小跟班' }
    const pet = createPet({ name: names[element], element, level: Math.max(1, state.team[0].level - 1) })
    state.gold -= cost
    state.team.push(pet)
    pushEvent(state, { kind: 'recruit', text: `招募了 ${pet.name}（${ELEMENTS[element].name}系）` })
    sendJson(res, 200, snapshotAfter(home, state))
  }))

  route(`${ROUTE_PREFIX}/rename`, wrap(async (req, res) => {
    if (!guard(req, res, ['POST'])) return
    const body = await readJson(req)
    const { state } = loadState(home)
    const index = Number(body?.index) || 0
    const pet = state.team[index]
    if (!pet) throw Object.assign(new Error('没有这条鲸鱼'), { statusCode: 400 })
    const name = String(body?.name || '').trim().slice(0, 12)
    if (!name) throw Object.assign(new Error('名字不能为空'), { statusCode: 400 })
    pet.name = name
    sendJson(res, 200, snapshotAfter(home, state))
  }))

  route(`${ROUTE_PREFIX}/reset`, wrap(async (req, res) => {
    if (!guard(req, res, ['POST'])) return
    const { state } = loadState(home)
    const fresh = state
    fresh.team = [createPet({ name: '小鲸鱼', element: 'neutral', level: 1 })]
    fresh.gold = 60
    fresh.cleared = []
    fresh.care = { hunger: 85, clean: 85, mood: 80, stamina: 100, lastTick: Date.now(), workReadyAt: 0, sleepReadyAt: 0 }
    fresh.stats = { battles: 0, wins: 0, losses: 0, bestRound: 0 }
    fresh.log = []
    pushEvent(fresh, { kind: 'reset', text: '重开了一条鲸鱼' })
    sendJson(res, 200, snapshotAfter(home, fresh))
  }))

  // 诊断用：直接看统计口径对不对，不暴露正文
  route(`${ROUTE_PREFIX}/work`, wrap(async (req, res) => {
    if (!guard(req, res, ['GET'])) return
    const work = todayWork(home)
    sendJson(res, 200, { ok: true, work, bonus: workBonus(work) })
  }))

  // 桌面小窗：开 / 关 / 查状态
  route(`${ROUTE_PREFIX}/desktop`, wrap(async (req, res) => {
    if (!guard(req, res, ['GET', 'POST'])) return
    const action = req.method === 'GET' ? 'status' : String((await readJson(req)).action || 'status')
    const logger2 = typeof logger === 'function' ? logger : () => {}
    if (action === 'open') {
      const host = req.headers.host || '127.0.0.1:49236'
      const result = openDesktop(`http://${host}`, logger2)
      if (!result.ok) return sendJson(res, 500, { ok: false, error: result.error })
      return sendJson(res, 200, { ok: true, ...result })
    }
    if (action === 'close') return sendJson(res, 200, { ok: true, ...closeDesktop(logger2) })
    if (action === 'status') return sendJson(res, 200, { ok: true, ...desktopStatus() })
    sendJson(res, 400, { ok: false, error: `未知动作 ${action}` })
  }))

  void logger
  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {}
    }
    disposers.length = 0
  }
}
