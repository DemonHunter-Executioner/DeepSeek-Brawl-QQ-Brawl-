// 引擎单测：战斗确定性、边界、平衡区间。跑法：node test/game.test.mjs
import assert from 'node:assert/strict'
import {
  ELEMENTS,
  SKILLS,
  STAGES,
  applyDecay,
  careModifiers,
  createPet,
  elementMultiplier,
  enemyTeam,
  expToNext,
  formOf,
  grantExp,
  makeRng,
  newCare,
  rewardsFor,
  simulateBattle,
  stageUnlocked,
  statsAt,
} from '../lib/game.js'

let passed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`FAIL ${name}\n     ${error?.message}`)
  }
}

/* ------------------------------------------------------------------ 随机 */

test('makeRng 同种子同序列，不同种子不同序列', () => {
  const a = makeRng(42)
  const b = makeRng(42)
  const c = makeRng(43)
  const seqA = Array.from({ length: 5 }, () => a())
  const seqB = Array.from({ length: 5 }, () => b())
  const seqC = Array.from({ length: 5 }, () => c())
  assert.deepEqual(seqA, seqB)
  assert.notDeepEqual(seqA, seqC)
  for (const value of seqA) assert.ok(value >= 0 && value < 1)
})

/* ------------------------------------------------------------------ 数值 */

test('statsAt 随等级单调增长', () => {
  let previous = statsAt(1, 'neutral')
  for (let level = 2; level <= 40; level += 1) {
    const current = statsAt(level, 'neutral')
    assert.ok(current.hp > previous.hp, `hp 在 ${level} 级没涨`)
    assert.ok(current.atk > previous.atk, `atk 在 ${level} 级没涨`)
    assert.ok(current.def > previous.def, `def 在 ${level} 级没涨`)
    previous = current
  }
})

test('相克：冰克水、水克火、火克冰，反向 0.75', () => {
  assert.equal(elementMultiplier('ice', 'water'), 1.5)
  assert.equal(elementMultiplier('water', 'fire'), 1.5)
  assert.equal(elementMultiplier('fire', 'ice'), 1.5)
  assert.equal(elementMultiplier('water', 'ice'), 0.75)
  assert.equal(elementMultiplier('ice', 'ice'), 1)
  assert.equal(elementMultiplier('neutral', 'fire'), 1)
})

test('expToNext 递增，grantExp 处理连续升级', () => {
  assert.ok(expToNext(1) < expToNext(10))
  const pet = createPet({ name: '测试', element: 'ice', level: 1 })
  const levels = grantExp(pet, expToNext(1) + expToNext(2) + 5)
  assert.equal(levels, 2)
  assert.equal(pet.level, 3)
  assert.ok(pet.exp >= 5)
  assert.ok(pet.skills.includes('ice_pebble'), '3 级应该学会本系基础技能')
  assert.equal(formOf(1).tier, 0)
  assert.equal(formOf(12).tier, 2)
  assert.equal(formOf(30).tier, 4)
})

test('createPet 的技能与等级匹配', () => {
  const pet = createPet({ element: 'fire', level: 10 })
  assert.ok(pet.skills.every((id) => SKILLS[id].unlock <= 10))
  assert.ok(pet.skills.every((id) => SKILLS[id].el === 'neutral' || SKILLS[id].el === 'fire'))
  assert.ok(pet.stats.hp > 200)
})

/* ------------------------------------------------------------------ 养成 */

test('applyDecay 离线会饿、会回体力、且有上限', () => {
  const care = { ...newCare(), lastTick: Date.now() - 3 * 3600_000 }
  care.hunger = 90
  care.stamina = 30
  applyDecay(care)
  assert.ok(care.hunger < 90)
  assert.ok(care.stamina > 30)
  const week = { ...newCare(), lastTick: Date.now() - 7 * 24 * 3600_000 }
  applyDecay(week)
  assert.ok(week.hunger >= 0 && week.clean >= 0)
  assert.ok(week.stamina <= 100)
})

test('careModifiers：心情好加攻，饿肚子掉攻，脏了掉防', () => {
  const happy = careModifiers({ hunger: 90, clean: 90, mood: 90, stamina: 90 })
  assert.ok(happy.atk > 1)
  const starving = careModifiers({ hunger: 10, clean: 90, mood: 90, stamina: 90 })
  assert.ok(starving.atk < happy.atk)
  const dirty = careModifiers({ hunger: 90, clean: 10, mood: 90, stamina: 90 })
  assert.ok(dirty.def < 1)
  const tired = careModifiers({ hunger: 90, clean: 90, mood: 90, stamina: 5 })
  assert.ok(tired.spd < 1)
})

/* ------------------------------------------------------------------ 战斗 */

test('同一 seed 两次结算完全一致（客户端回放的地基）', () => {
  const teamA = [createPet({ name: 'A', element: 'ice', level: 6 })]
  const teamB = enemyTeam(3, 6, 12345)
  const first = simulateBattle(teamA, teamB, 777)
  const second = simulateBattle(teamA, teamB, 777)
  assert.deepEqual(first.log, second.log)
  assert.equal(first.winner, second.winner)
  assert.equal(first.rounds, second.rounds)
})

test('不同 seed 会打出不同结果', () => {
  const teamA = [createPet({ name: 'A', element: 'fire', level: 8 })]
  const results = new Set()
  for (let seed = 1; seed <= 12; seed += 1) {
    results.add(JSON.stringify(simulateBattle(teamA, enemyTeam(4, 8, seed), seed).log.length))
  }
  assert.ok(results.size > 1, '所有种子都打出一样的长度，说明随机没用上')
})

test('战斗一定在 40 回合内结束，且结局合法', () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const a = [createPet({ name: 'A', element: 'water', level: 1 + (seed % 20) })]
    const b = enemyTeam((seed % 12) + 1, 1 + (seed % 20), seed)
    const result = simulateBattle(a, b, seed)
    assert.ok(result.rounds >= 1 && result.rounds <= 40)
    assert.ok(['a', 'b', 'draw'].includes(result.winner))
    assert.ok(result.log.length > 0)
    assert.equal(result.log.at(-1).kind, 'end')
  }
})

test('强队打弱关必胜，弱队打强关必输', () => {
  const strong = [createPet({ name: '老大哥', element: 'ice', level: 40 })]
  const weak = [createPet({ name: '新兵', element: 'neutral', level: 1 })]
  for (let seed = 1; seed <= 20; seed += 1) {
    assert.equal(simulateBattle(strong, enemyTeam(1, 40, seed), seed).winner, 'a')
    assert.equal(simulateBattle(weak, enemyTeam(12, 1, seed), seed).winner, 'b')
  }
})

test('第一关对 1 级幼鲸有可赢得性（30%~100%）', () => {
  const team = [createPet({ name: '小鲸鱼', element: 'neutral', level: 1 })]
  let wins = 0
  for (let seed = 1; seed <= 200; seed += 1) {
    if (simulateBattle(team, enemyTeam(1, 1, seed), seed).winner === 'a') wins += 1
  }
  const rate = wins / 200
  assert.ok(rate > 0.3 && rate <= 1, `胜率 ${rate} 不在合理区间`)
})

test('3v3 队伍也能结算，死亡单位不再行动', () => {
  const team = [1, 2, 3].map((i) => createPet({ name: `P${i}`, element: 'water', level: 12 }))
  const result = simulateBattle(team, enemyTeam(8, 12, 7), 7)
  assert.equal(result.a.length, 3)
  assert.ok(result.b.length >= 1)
  // 倒下之后不该再有该单位出手的 hit 日志
  const downAt = new Map()
  for (const [index, entry] of result.log.entries()) {
    if (entry.kind === 'down' && entry.target) downAt.set(`${entry.target.side}:${entry.target.index}`, index)
  }
  for (const [index, entry] of result.log.entries()) {
    if (entry.kind !== 'hit' && entry.kind !== 'heal' && entry.kind !== 'shield') continue
    const key = `${entry.actor.side}:${entry.actor.index}`
    const down = downAt.get(key)
    if (down !== undefined) assert.ok(index < down, `单位 ${key} 倒下后还在行动`)
  }
})

test('伤害/治疗/护盾日志都带可读文本，UI 可以直接播', () => {
  const result = simulateBattle(
    [createPet({ name: 'A', element: 'ice', level: 14 })],
    enemyTeam(6, 14, 3),
    3,
  )
  for (const entry of result.log) {
    assert.equal(typeof entry.text, 'string')
    assert.ok(entry.text.length > 0)
  }
  const kinds = new Set(result.log.map((entry) => entry.kind))
  assert.ok(kinds.has('hit'))
})

/* ------------------------------------------------------------------ 关卡 */

test('关卡解锁链：必须先过上一关', () => {
  assert.equal(stageUnlocked(1, []), true)
  assert.equal(stageUnlocked(2, []), false)
  assert.equal(stageUnlocked(2, [1]), true)
  assert.equal(stageUnlocked(12, [1, 2, 3]), false)
  assert.equal(stageUnlocked(12, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), true)
})

test('敌人队伍数量与关卡一致，boss 关第一位是 boss', () => {
  for (const stage of STAGES) {
    const team = enemyTeam(stage.id, stage.level, 99)
    assert.equal(team.length, stage.count)
    if (stage.boss) assert.equal(team[0].name, stage.boss)
    for (const pet of team) assert.ok(ELEMENTS[pet.element])
  }
})

test('奖励随关卡与劳作加成上升', () => {
  const low = rewardsFor(1, 1, 0)
  const high = rewardsFor(12, 20, 0)
  const boosted = rewardsFor(12, 20, 0.5)
  assert.ok(high.gold > low.gold)
  assert.ok(high.exp > low.exp)
  assert.ok(boosted.exp > high.exp)
})

/* ------------------------------------------------------------------ 汇总 */

if (failures.length > 0) {
  console.error(`\n${failures.length} 个用例失败：`)
  for (const failure of failures) console.error(` - ${failure.name}: ${failure.error?.stack || failure.error}`)
  process.exit(1)
}
console.log(`\n全部通过：${passed} 个用例`)
