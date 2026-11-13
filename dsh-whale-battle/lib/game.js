// 鲸鱼大作战 · 纯逻辑引擎
//
// 这个文件不碰文件系统、不碰网络、不依赖 DSH：给定输入和种子，输出完全确定。
// 宿主（index.js/routes.js）负责存档与 HTTP，客户端只负责把战斗日志按顺序播出来。
// 所以「同一场战斗在两边算出来必须一模一样」是硬约束——随机数只有 mulberry32 一处。

/* ------------------------------------------------------------------ 常量 */

export const ELEMENTS = {
  neutral: { key: 'neutral', name: '萌', color: '#ffd166', strong: null, weak: null, icon: '🐧' },
  ice: { key: 'ice', name: '冰', color: '#7fd3ff', strong: 'water', weak: 'fire', icon: '❄️' },
  water: { key: 'water', name: '水', color: '#5aa9ff', strong: 'fire', weak: 'ice', icon: '💧' },
  fire: { key: 'fire', name: '火', color: '#ff8a5c', strong: 'ice', weak: 'water', icon: '🔥' },
}

export const ELEMENT_KEYS = ['neutral', 'ice', 'water', 'fire']

/** 相克倍率：克 1.5、被克 0.75、其余 1。 */
export function elementMultiplier(attacker, defender) {
  const atk = ELEMENTS[attacker]
  if (!atk || !atk.strong) return 1
  if (atk.strong === defender) return 1.5
  if (atk.weak === defender) return 0.75
  return 1
}

/** 形态：等级一到就进化，客户端按 tier 换立绘。 */
export const FORMS = [
  { minLevel: 1, tier: 0, name: '幼鲸', title: '刚学会喷水' },
  { minLevel: 5, tier: 1, name: '小鲸鱼', title: '尾巴有力气了' },
  { minLevel: 12, tier: 2, name: '鲸鱼少年', title: '能潜很深' },
  { minLevel: 20, tier: 3, name: '冰原鲸', title: '扛得住风暴' },
  { minLevel: 30, tier: 4, name: '鲸王', title: '深海的主人' },
]

export function formOf(level) {
  let form = FORMS[0]
  for (const item of FORMS) if (level >= item.minLevel) form = item
  return form
}

/* ------------------------------------------------------------------ 技能 */

// kind: attack 伤害 / heal 回血 / shield 护盾 / buff 自身增益 / debuff 削弱对手
// unlock: 学习等级；cost: 怒气；power: 伤害或治疗强度（攻击力百分比）
const SKILL_LIST = [
  // 通用
  { id: 'beak', name: '甩尾', el: 'neutral', kind: 'attack', power: 60, cost: 0, unlock: 1, target: 'enemy',
    desc: '最基础的攻击，不消耗怒气。' },
  { id: 'slap', name: '尾鳍拍击', el: 'neutral', kind: 'attack', power: 80, cost: 25, unlock: 7, target: 'enemy',
    desc: '一尾巴糊过去，伤害稳定。' },
  { id: 'cuddle', name: '卖萌', el: 'neutral', kind: 'debuff', power: 0, cost: 20, unlock: 4, target: 'enemy',
    fx: [{ kind: 'stun', chance: 0.35, turns: 1 }], desc: '35% 概率让对方愣住一回合。' },
  { id: 'warmup', name: '热身', el: 'neutral', kind: 'buff', power: 0, cost: 20, unlock: 6, target: 'self',
    fx: [{ kind: 'atkUp', chance: 1, turns: 3, value: 0.25 }], desc: '接下来 3 回合攻击 +25%。' },
  { id: 'snack', name: '偷吃小鱼干', el: 'neutral', kind: 'heal', power: 45, cost: 40, unlock: 6, target: 'self',
    desc: '回复自身 45% 攻击力的生命。' },
  { id: 'shell', name: '下潜', el: 'neutral', kind: 'shield', power: 70, cost: 30, unlock: 9, target: 'self',
    desc: '潜入水下，获得一层护盾。' },
  { id: 'mega', name: '跃身撞击', el: 'neutral', kind: 'attack', power: 155, cost: 100, unlock: 14, target: 'enemy',
    desc: '整头鲸跃出水面砸下去。' },

  // 冰
  { id: 'ice_pebble', name: '冰砾', el: 'ice', kind: 'attack', power: 70, cost: 0, unlock: 3, target: 'enemy',
    desc: '丢一块小冰碴。' },
  { id: 'frost_wave', name: '寒霜波', el: 'ice', kind: 'attack', power: 95, cost: 30, unlock: 8, target: 'enemy',
    fx: [{ kind: 'freeze', chance: 0.25, turns: 1 }], desc: '25% 概率冰冻对手一回合。' },
  { id: 'ice_wall', name: '冰墙', el: 'ice', kind: 'shield', power: 90, cost: 35, unlock: 11, target: 'self',
    desc: '竖起冰墙，护盾更厚。' },
  { id: 'glacier', name: '冰川崩落', el: 'ice', kind: 'attack', power: 160, cost: 100, unlock: 16, target: 'enemy',
    desc: '冰系绝招，砸下去再说。' },

  // 水
  { id: 'splash', name: '水炮', el: 'water', kind: 'attack', power: 70, cost: 0, unlock: 3, target: 'enemy',
    desc: '一口水喷出去。' },
  { id: 'bubble', name: '泡沫缠绕', el: 'water', kind: 'debuff', power: 0, cost: 25, unlock: 8, target: 'enemy',
    fx: [{ kind: 'defDown', chance: 0.6, turns: 3, value: 0.25 }], desc: '60% 概率让对方防御 -25%。' },
  { id: 'tide', name: '潮汐', el: 'water', kind: 'attack', power: 100, cost: 35, unlock: 12, target: 'enemy',
    fx: [{ kind: 'burn', chance: 0.3, turns: 2 }], desc: '30% 概率附加 2 回合持续伤害。' },
  { id: 'tsunami', name: '滔天浪', el: 'water', kind: 'attack', power: 160, cost: 100, unlock: 16, target: 'enemy',
    desc: '水系绝招，铺天盖地。' },

  // 火
  { id: 'ember', name: '火苗', el: 'fire', kind: 'attack', power: 70, cost: 0, unlock: 3, target: 'enemy',
    desc: '张嘴一个小火苗。' },
  { id: 'blaze', name: '烈焰拍击', el: 'fire', kind: 'attack', power: 95, cost: 30, unlock: 8, target: 'enemy',
    fx: [{ kind: 'burn', chance: 0.35, turns: 2 }], desc: '35% 概率点燃对手。' },
  { id: 'roast', name: '灼热吐息', el: 'fire', kind: 'buff', power: 0, cost: 30, unlock: 11, target: 'self',
    fx: [{ kind: 'atkUp', chance: 1, turns: 3, value: 0.35 }], desc: '接下来 3 回合攻击 +35%。' },
  { id: 'inferno', name: '焚天火', el: 'fire', kind: 'attack', power: 160, cost: 100, unlock: 16, target: 'enemy',
    desc: '火系绝招，烧穿一切。' },
]

export const SKILLS = Object.fromEntries(SKILL_LIST.map((skill) => [skill.id, skill]))

export function skillsFor(level, element) {
  return SKILL_LIST
    .filter((skill) => skill.unlock <= level && (skill.el === 'neutral' || skill.el === element))
    .map((skill) => skill.id)
}

/* ------------------------------------------------------------------ 数值 */

/** 1 级基础值；每级成长写在 GROWTH 里，属性差异由元素系数给出。 */
const BASE_STATS = { hp: 120, atk: 24, def: 12, spd: 18, crit: 0.1 }
const GROWTH = { hp: 14, atk: 3.1, def: 1.5, spd: 0.75, crit: 0.0015 }

const ELEMENT_BIAS = {
  neutral: { hp: 1.05, atk: 1.0, def: 1.0, spd: 1.0 },
  ice: { hp: 1.0, atk: 1.02, def: 1.12, spd: 0.92 },
  water: { hp: 1.1, atk: 0.96, def: 1.02, spd: 1.0 },
  fire: { hp: 0.94, atk: 1.12, def: 0.92, spd: 1.06 },
}

export function statsAt(level, element = 'neutral') {
  const bias = ELEMENT_BIAS[element] || ELEMENT_BIAS.neutral
  const lv = Math.max(1, Math.floor(level))
  const grow = lv - 1
  return {
    hp: Math.round((BASE_STATS.hp + GROWTH.hp * grow) * bias.hp),
    atk: Math.round((BASE_STATS.atk + GROWTH.atk * grow) * bias.atk * 10) / 10,
    def: Math.round((BASE_STATS.def + GROWTH.def * grow) * bias.def * 10) / 10,
    spd: Math.round((BASE_STATS.spd + GROWTH.spd * grow) * bias.spd * 10) / 10,
    crit: Math.min(0.5, Math.round((BASE_STATS.crit + GROWTH.crit * grow) * 1000) / 1000),
  }
}

/** 升到下一级需要的经验。 */
export function expToNext(level) {
  return Math.round(40 * Math.pow(level, 1.32) + 20 * level)
}

export const ELEMENT_NAMES = { neutral: '萌系', ice: '冰系', water: '水系', fire: '火系' }

export function createPet({ name, element = 'neutral', level = 1, exp = 0 } = {}) {
  const stats = statsAt(level, element)
  return {
    id: `pet-${Math.random().toString(36).slice(2, 8)}`,
    name: name || '小鲸鱼',
    element,
    level,
    exp,
    stats,
    skills: skillsFor(level, element),
    form: formOf(level).tier,
    bornAt: Date.now(),
  }
}

/** 重算 stats/skills/form（升级、进化后调用）。 */
export function refreshPet(pet) {
  pet.stats = statsAt(pet.level, pet.element)
  pet.skills = skillsFor(pet.level, pet.element)
  pet.form = formOf(pet.level).tier
  return pet
}

/** 加经验并处理连续升级。返回升了几级。 */
export function grantExp(pet, exp) {
  pet.exp = Math.max(0, Math.round((pet.exp || 0) + exp))
  let levels = 0
  while (pet.exp >= expToNext(pet.level) && pet.level < 60) {
    pet.exp -= expToNext(pet.level)
    pet.level += 1
    levels += 1
  }
  if (levels > 0) refreshPet(pet)
  return levels
}

/* -------------------------------------------------------------- 养成外皮 */

// 四项状态按真实时间衰减/恢复。离线也算，所以 applyDecay 只看「距上次结算过去了多久」。
const DECAY_PER_HOUR = { hunger: 3.2, clean: 2.4, mood: 1.6, stamina: -7 } // 负数=恢复

export function newCare() {
  return { hunger: 85, clean: 85, mood: 80, stamina: 100, lastTick: Date.now(), workReadyAt: 0 }
}

/**
 * 把 care 结算到 now：没上线也在饿、也在回体力。
 * 超过 12 小时的部分不累计（免得放一周回来变成负无穷）。
 */
export function applyDecay(care, now = Date.now()) {
  const from = Number(care?.lastTick) || now
  const hours = Math.min(12, Math.max(0, (now - from) / 3_600_000))
  if (hours <= 0) {
    care.lastTick = now
    return care
  }
  for (const [key, rate] of Object.entries(DECAY_PER_HOUR)) {
    if (key === 'stamina') continue // 体力单独处理：只恢复
    care[key] = clamp(care[key] - rate * hours, 0, 100)
  }
  care.stamina = clamp((care.stamina ?? 100) + 7 * hours, 0, 100)
  care.lastTick = now
  return care
}

export function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** 状态对战斗的影响：心情好攻击高，饿肚子/太脏/太累都会掉。 */
export function careModifiers(care) {
  const c = care || {}
  const atk = (c.mood ?? 80) >= 70 ? 1.05 : (c.mood ?? 80) < 30 ? 0.92 : 1
  const atkLow = (c.hunger ?? 85) < 30 ? 0.9 : 1
  const def = (c.clean ?? 85) < 30 ? 0.92 : 1
  const spd = (c.stamina ?? 100) < 20 ? 0.9 : 1
  return { atk: atk * atkLow, def, spd }
}

/* ------------------------------------------------------------------ 战斗 */

/** 确定性随机：同一 seed 两边算出同一场战斗。 */
export function makeRng(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function combatantFrom(pet, side, index, mods) {
  const stats = pet.stats || statsAt(pet.level, pet.element)
  const mod = mods || { atk: 1, def: 1, spd: 1 }
  return {
    side,
    index,
    name: pet.name,
    element: pet.element,
    level: pet.level,
    maxHp: Math.round(stats.hp),
    hp: Math.round(stats.hp),
    atk: stats.atk * mod.atk,
    def: stats.def * mod.def,
    spd: stats.spd * mod.spd,
    crit: stats.crit,
    energy: 0,
    skills: (pet.skills || skillsFor(pet.level, pet.element)).filter((id) => SKILLS[id]),
    fx: {},
    shield: 0,
    alive: true,
  }
}

function fxValue(c, key) {
  return c.fx[key] ? c.fx[key].value || 0 : 0
}

function addFx(target, effect, log, round, source) {
  if (!target.alive) return false
  const turns = effect.turns || 1
  if (effect.kind === 'shield') {
    target.shield = Math.round(target.shield + (source.atk * effect.value || 0))
    return true
  }
  target.fx[effect.kind] = { turns, value: effect.value || 0, dmg: effect.dmg || 0 }
  return true
}

function aliveOf(team) {
  return team.filter((unit) => unit.alive)
}

function sideHpPercent(team) {
  let hp = 0
  let max = 0
  for (const unit of team) {
    hp += unit.hp
    max += unit.maxHp
  }
  return max > 0 ? hp / max : 0
}

const FX_LABEL = {
  burn: '燃烧', stun: '眩晕', freeze: '冰冻', defDown: '破防', atkUp: '攻击提升', shield: '护盾',
}

function pickTarget(enemies, rng, skill) {
  const alive = aliveOf(enemies)
  if (alive.length === 0) return null
  // 集火残血：70% 挑血量最低的，30% 随机，避免每次都打同一个显得机械。
  if (rng() < 0.7) return alive.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]
  return alive[Math.floor(rng() * alive.length)]
}

/** 简单 AI：会补血、会攒大招、血量低时怂一点。 */
function chooseSkill(actor, enemies, allies, rng) {
  const available = actor.skills.map((id) => SKILLS[id]).filter((skill) => (skill.cost || 0) <= actor.energy)
  const hpPct = actor.hp / actor.maxHp
  const heal = available.find((skill) => skill.kind === 'heal')
  if (hpPct < 0.35 && heal && rng() < 0.85) return heal

  const ult = available.filter((skill) => skill.cost >= 90).sort((a, b) => b.power - a.power)[0]
  if (ult && rng() < 0.9) return ult

  const attacks = available.filter((skill) => skill.kind === 'attack')
  const debuffs = available.filter((skill) => skill.kind === 'debuff')
  const buffs = available.filter((skill) => skill.kind === 'buff')
  const shields = available.filter((skill) => skill.kind === 'shield')

  if (shields.length > 0 && hpPct < 0.5 && !actor.shield && rng() < 0.4) return shields[0]
  if (buffs.length > 0 && !actor.fx.atkUp && rng() < 0.3) return buffs[0]
  if (debuffs.length > 0 && rng() < 0.3) return debuffs[0]

  const target = pickTarget(enemies, rng, null)
  if (attacks.length > 0) {
    const scored = attacks
      .map((skill) => ({
        skill,
        score: skill.power * elementMultiplier(skill.el, target ? target.element : 'neutral'),
      }))
      .sort((a, b) => b.score - a.score)
    // 小概率故意用弱的，不然每回合都选同一招很无聊
    return rng() < 0.75 ? scored[0].skill : scored[Math.floor(rng() * scored.length)].skill
  }
  return SKILLS.beak
}

/** 结算一次技能。返回日志条目（可能不止一条）。 */
function performAction(actor, allies, enemies, log, round, rng, teamA, teamB) {
  const hp = () => snapTeams(teamA, teamB)
  const skill = chooseSkill(actor, enemies, allies, rng)
  const isAttack = skill.kind === 'attack'
  const target = isAttack
    ? pickTarget(enemies, rng, skill)
    : skill.target === 'self' ? actor : pickTarget(enemies, rng, skill)
  if (!target || !target.alive) return

  actor.energy = clamp(actor.energy - (skill.cost || 0), 0, 100)

  const base = { r: round, actor: { side: actor.side, index: actor.index, name: actor.name }, skill: skill.id, skillName: skill.name, skillEl: skill.el, skillKind: skill.kind }

  if (isAttack) {
    const crit = rng() < actor.crit
    const mult = elementMultiplier(skill.el, target.element)
    const mitigation = 1 - target.def / (target.def + 200)
    const jitter = 0.9 + rng() * 0.2
    const atkBuff = 1 + fxValue(actor, 'atkUp')
    const defBreak = 1 + fxValue(target, 'defDown')
    let dmg = actor.atk * (skill.power / 100) * mitigation * mult * jitter * atkBuff * defBreak
    if (crit) dmg *= 1.6
    dmg = Math.max(1, Math.round(dmg))

    let absorbed = 0
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, dmg)
      target.shield -= absorbed
      dmg -= absorbed
    }
    target.hp = Math.max(0, target.hp - dmg)
    if (target.hp === 0) target.alive = false

    log.push({
      ...base,
      kind: 'hit',
      target: { side: target.side, index: target.index, name: target.name },
      dmg,
      absorbed,
      crit,
      mult,
      shield: target.shield,
      hp: hp(),
      text: `${actor.name} 对 ${target.name} 使用「${skill.name}」，造成 ${dmg} 伤害${crit ? '（暴击！）' : ''}${mult > 1 ? '（克制）' : mult < 1 ? '（被克）' : ''}${absorbed > 0 ? `，护盾挡下 ${absorbed}` : ''}`,
    })

    const effects = skill.fx || []
    for (const effect of effects) {
      if (rng() > (effect.chance ?? 1)) continue
      const targetForFx = effect.kind === 'atkUp' ? actor : target
      if (effect.kind === 'burn' || effect.kind === 'poison') {
        targetForFx.fx[effect.kind] = { turns: effect.turns || 2, value: 0, dmg: Math.round(targetForFx.maxHp * 0.05) }
      } else if (effect.kind === 'shield') {
        targetForFx.shield += Math.round(actor.atk * (effect.value || 1))
      } else {
        targetForFx.fx[effect.kind] = { turns: effect.turns || 1, value: effect.value || 0, dmg: 0 }
      }
      log.push({
        ...base,
        kind: 'status',
        target: { side: targetForFx.side, index: targetForFx.index, name: targetForFx.name },
        effect: effect.kind,
        hp: hp(),
        text: `${targetForFx.name} 陷入「${FX_LABEL[effect.kind] || effect.kind}」`,
      })
    }
    if (!target.alive) {
      log.push({
        ...base,
        kind: 'down',
        target: { side: target.side, index: target.index, name: target.name },
        hp: hp(),
        text: `${target.name} 倒下了`,
      })
    }
    return
  }

  if (skill.kind === 'heal') {
    const amount = Math.round(actor.atk * (skill.power / 100))
    const before = actor.hp
    actor.hp = Math.min(actor.maxHp, actor.hp + amount)
    log.push({
      ...base,
      kind: 'heal',
      target: { side: actor.side, index: actor.index, name: actor.name },
      amount: actor.hp - before,
      hp: hp(),
      text: `${actor.name} 使用「${skill.name}」，回复 ${actor.hp - before} 生命`,
    })
    return
  }

  if (skill.kind === 'shield') {
    const amount = Math.round(actor.atk * (skill.power / 100))
    actor.shield += amount
    log.push({
      ...base,
      kind: 'shield',
      target: { side: actor.side, index: actor.index, name: actor.name },
      amount,
      hp: hp(),
      text: `${actor.name} 使用「${skill.name}」，获得 ${amount} 点护盾`,
    })
    return
  }

  // buff / debuff
  for (const effect of skill.fx || []) {
    if (rng() > (effect.chance ?? 1)) continue
    const fxTarget = effect.kind === 'atkUp' ? actor : target
    fxTarget.fx[effect.kind] = { turns: effect.turns || 2, value: effect.value || 0, dmg: 0 }
    log.push({
      ...base,
      kind: 'status',
      target: { side: fxTarget.side, index: fxTarget.index, name: fxTarget.name },
      effect: effect.kind,
      hp: hp(),
      text: `${fxTarget.name} 陷入「${FX_LABEL[effect.kind] || effect.kind}」`,
    })
  }
}

/** 整队血量快照：客户端只靠这个数组就能把每一帧的 HP 条画对。 */
function snapTeams(teamA, teamB) {
  const snap = (team) => team.map((unit) => ({
    hp: Math.max(0, Math.round(unit.hp)),
    maxHp: unit.maxHp,
    alive: unit.alive,
    shield: Math.round(unit.shield || 0),
    energy: Math.round(unit.energy || 0),
  }))
  return { a: snap(teamA), b: snap(teamB) }
}

/** 回合开始：结算持续伤害与状态回合数。 */
function tickStatuses(team, teamA, teamB, log, round) {
  for (const unit of team) {
    if (!unit.alive) continue
    unit.energy = clamp(unit.energy + 28, 0, 100)
    for (const [key, fx] of Object.entries(unit.fx)) {
      if (key === 'burn' || key === 'poison') {
        const dmg = Math.max(1, fx.dmg || Math.round(unit.maxHp * 0.05))
        unit.hp = Math.max(0, unit.hp - dmg)
        log.push({
          r: round,
          kind: 'dot',
          actor: { side: unit.side, index: unit.index, name: unit.name },
          target: { side: unit.side, index: unit.index, name: unit.name },
          effect: key,
          dmg,
          hp: snapTeams(teamA, teamB),
          text: `${unit.name} 受到「${FX_LABEL[key]}」${dmg} 点伤害`,
        })
        if (unit.hp === 0) {
          unit.alive = false
          log.push({
            r: round,
            kind: 'down',
            actor: { side: unit.side, index: unit.index, name: unit.name },
            target: { side: unit.side, index: unit.index, name: unit.name },
            hp: snapTeams(teamA, teamB),
            text: `${unit.name} 倒下了`,
          })
        }
      }
      fx.turns -= 1
      if (fx.turns <= 0) delete unit.fx[key]
    }
  }
}

/**
 * 打一整场。teamA = 玩家，teamB = 敌人。
 * @returns {{ winner:'a'|'b'|'draw', rounds:number, log:object[], survivors:string[], a:object[], b:object[] }}
 */
export function simulateBattle(petsA, petsB, seed = Date.now()) {
  const rng = makeRng(seed)
  const teamA = petsA.map((pet, i) => combatantFrom(pet, 'a', i, pet.mods))
  const teamB = petsB.map((pet, i) => combatantFrom(pet, 'b', i, pet.mods))
  const log = []
  let round = 0
  const MAX_ROUNDS = 40

  while (round < MAX_ROUNDS && aliveOf(teamA).length > 0 && aliveOf(teamB).length > 0) {
    round += 1
    tickStatuses(teamA, teamA, teamB, log, round)
    tickStatuses(teamB, teamA, teamB, log, round)
    if (aliveOf(teamA).length === 0 || aliveOf(teamB).length === 0) break

    const order = [...aliveOf(teamA), ...aliveOf(teamB)]
      .map((unit) => ({ unit, roll: unit.spd * (0.88 + rng() * 0.24) }))
      .sort((x, y) => y.roll - x.roll)

    for (const { unit } of order) {
      if (!unit.alive) continue
      if (aliveOf(teamA).length === 0 || aliveOf(teamB).length === 0) break
      if (unit.fx.stun || unit.fx.freeze) {
        log.push({
          r: round,
          kind: 'skip',
          actor: { side: unit.side, index: unit.index, name: unit.name },
          text: `${unit.name} 被${unit.fx.freeze ? '冻住' : '眩晕'}，无法行动`,
        })
        delete unit.fx.stun
        delete unit.fx.freeze
        continue
      }
      const allies = unit.side === 'a' ? teamA : teamB
      const enemies = unit.side === 'a' ? teamB : teamA
      performAction(unit, allies, enemies, log, round, rng, teamA, teamB)
    }
  }

  const aliveA = aliveOf(teamA).length
  const aliveB = aliveOf(teamB).length
  let winner = 'draw'
  if (aliveA > 0 && aliveB === 0) winner = 'a'
  else if (aliveB > 0 && aliveA === 0) winner = 'b'
  else if (aliveA === 0 && aliveB === 0) winner = 'draw'
  else winner = sideHpPercent(teamA) >= sideHpPercent(teamB) ? 'a' : 'b'

  log.push({
    r: round,
    kind: 'end',
    winner,
    text: winner === 'a' ? '战斗胜利！' : winner === 'b' ? '战斗失败……' : '平局',
  })

  return {
    winner,
    rounds: round,
    seed,
    log,
    mvp: findMvp(teamA, teamB, winner),
    a: teamA.map(publicUnit),
    b: teamB.map(publicUnit),
  }
}

function publicUnit(unit) {
  return {
    side: unit.side, index: unit.index, name: unit.name, element: unit.element, level: unit.level,
    hp: unit.hp, maxHp: unit.maxHp, alive: unit.alive, energy: unit.energy, shield: unit.shield,
  }
}

function findMvp(teamA, teamB, winner) {
  const team = winner === 'b' ? teamB : teamA
  let best = null
  for (const unit of team) {
    const score = (unit.maxHp - unit.hp) * 0.2 + (unit.alive ? 100 : 0) + unit.level
    if (!best || score > best.score) best = { unit, score }
  }
  return best ? best.unit.name : null
}

/* ------------------------------------------------------------------ 关卡 */

export const STAGES = [
  { id: 1, name: '浅滩草甸', level: 1, element: 'neutral', count: 1, desc: '刚学会喷水的小鲸鱼都在这儿练尾巴。' },
  { id: 2, name: '蒲公英坡', level: 2, element: 'neutral', count: 1, desc: '风一吹，绒絮和浪花一起飞。' },
  { id: 3, name: '冰湖边', level: 3, element: 'ice', count: 2, desc: '脚下打滑，但对面也滑。' },
  { id: 4, name: '温泉口', level: 4, element: 'fire', count: 2, desc: '鲸鱼也泡温泉，只是会输。' },
  { id: 5, name: '潮汐滩', level: 5, element: 'water', count: 2, desc: '涨潮的时候没人敢站着。' },
  { id: 6, name: '风暴崖', level: 7, element: 'ice', count: 3, boss: '雪山王', desc: '崖顶那位不太喜欢访客。' },
  { id: 7, name: '熔岩洞', level: 9, element: 'fire', count: 3, desc: '太热了，背鳍要烤干。' },
  { id: 8, name: '深海底', level: 11, element: 'water', count: 3, desc: '这儿是鲸鱼的主场，但对面也这么想。' },
  { id: 9, name: '极光台', level: 13, element: 'ice', count: 3, boss: '极光守卫', desc: '极光下面站着一排不服的。' },
  { id: 10, name: '荒野峡谷', level: 15, element: 'neutral', count: 3, desc: '杂牌军也有杂牌军的打法。' },
  { id: 11, name: '王座前厅', level: 17, element: 'fire', count: 3, desc: '最后两道门之一。' },
  { id: 12, name: '鲸王座', level: 20, element: 'neutral', count: 3, boss: '帝鲸王', desc: '王座上坐着的，是另一个你。' },
]

const ENEMY_POOL = {
  neutral: ['野鸭', '胖仓鼠', '河狸', '倔强小鸡'],
  ice: ['雪鹱', '冰晶兔', '雪狼', '霜角羊'],
  water: ['水母', '泡泡鱼', '潮汐龟', '海带精'],
  fire: ['火蜥蜴', '熔岩蟹', '烈焰鸦', '炭烤章鱼'],
}

export function stageList() {
  return STAGES.map((stage) => ({ ...stage }))
}

/**
 * 生成敌人队伍。等级跟着关卡走，玩家等级远高于关卡时给一点追赶，避免刷低级关毫无意义。
 */
export function enemyTeam(stageId, playerLevel = 1, seed = 1) {
  const stage = STAGES.find((item) => item.id === Number(stageId)) || STAGES[0]
  const rng = makeRng(seed * 7919 + stage.id * 104729)
  const catchup = Math.max(0, Math.min(3, Math.floor((playerLevel - stage.level) / 4)))
  const level = stage.level + catchup
  const pool = ENEMY_POOL[stage.element] || ENEMY_POOL.neutral
  const team = []
  for (let i = 0; i < stage.count; i += 1) {
    const isBoss = stage.boss && i === 0
    const name = isBoss ? stage.boss : pool[Math.floor(rng() * pool.length)]
    const pet = createPet({
      name,
      element: isBoss ? stage.element : (rng() < 0.7 ? stage.element : 'neutral'),
      level: isBoss ? level + 2 : level,
    })
    if (isBoss) {
      pet.stats = {
        ...pet.stats,
        hp: Math.round(pet.stats.hp * 1.35),
        atk: Math.round(pet.stats.atk * 1.1 * 10) / 10,
      }
    }
    team.push(pet)
  }
  return team
}

/** 通关奖励。todayBonus 是 DSH 真实劳作带来的经验加成（0~0.5）。 */
export function rewardsFor(stageId, playerLevel = 1, todayBonus = 0) {
  const stage = STAGES.find((item) => item.id === Number(stageId)) || STAGES[0]
  const gold = Math.round(24 + stage.level * 7 + (stage.boss ? 60 : 0) + stage.id * 3)
  const exp = Math.round((30 + stage.level * 11 + (stage.boss ? 55 : 0)) * (1 + todayBonus))
  return { gold, exp, firstClear: 0 }
}

/** 关卡是否已解锁：第一关永远开，其余要求上一关通过。 */
export function stageUnlocked(stageId, cleared = []) {
  const id = Number(stageId)
  if (id <= 1) return true
  return cleared.includes(id - 1)
}
