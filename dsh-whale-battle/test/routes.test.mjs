// 宿主侧集成测试：路由契约、存档、劳作统计。
// 不启动真 HTTP 服务，直接把假 req/res 递给 registerRoutes 注册的 handler。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import zlib from 'node:zlib'
import { registerRoutes } from '../lib/routes.js'
import { loadState, newPlayerState, saveState, savePathOf } from '../lib/store.js'
import { todayWork, workBonus, workGold } from '../lib/worklog.js'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-test-'))
const handlers = new Map()
const scope = {
  webServer: {
    register({ path: routePath, handler }) {
      handlers.set(routePath, handler)
      return () => handlers.delete(routePath)
    },
  },
}
registerRoutes(scope, { home })

let passed = 0
const failures = []
async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`FAIL ${name}\n     ${error?.message}`)
  }
}

/** 调一次路由，返回 { status, body }。 */
async function call(route, { method = 'GET', body, headers = {} } = {}) {
  const handler = handlers.get(route)
  assert.ok(handler, `路由没注册：${route}`)
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  const req = Readable.from(payload)
  req.method = method
  req.headers = { host: '127.0.0.1:49236', 'content-type': 'application/json', ...headers }
  let status = 0
  let text = ''
  const res = {
    writeHead(nextStatus) {
      status = nextStatus
    },
    end(chunk) {
      text = String(chunk ?? '')
    },
  }
  await handler(req, res)
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {}
  return { status, body: parsed, text }
}

const ROUTE = '/dsh-whale-battle'

/* ------------------------------------------------------------------ 用例 */

await test('新档：一条 1 级幼鲸、60 金币、12 个关卡', async () => {
  const { status, body } = await call(`${ROUTE}/state`)
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.team.length, 1)
  assert.equal(body.team[0].level, 1)
  assert.equal(body.gold, 60)
  assert.equal(body.stages.length, 12)
  assert.equal(body.stages[0].unlocked, true)
  assert.equal(body.stages[1].unlocked, false)
  assert.ok(body.lead.expToNext > 0)
  assert.ok(body.savePath.includes('dsh-whale-battle'))
})

await test('存档真的落盘了', async () => {
  const file = savePathOf(home)
  assert.ok(fs.existsSync(file), 'save.json 不存在')
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(saved.team.length, 1)
  assert.ok(saved.createdAt > 0)
})

await test('喂食：金币 -8，饱食度上升', async () => {
  const before = (await call(`${ROUTE}/state`)).body
  const { status, body } = await call(`${ROUTE}/care`, { method: 'POST', body: { action: 'feed' } })
  assert.equal(status, 200)
  assert.equal(body.gold, before.gold - 8)
  assert.ok(body.care.hunger >= before.care.hunger)
})

await test('金币不够时喂食返回 400 并说明原因', async () => {
  const { state } = loadState(home)
  state.gold = 0
  saveState(home, state)
  const { status, body } = await call(`${ROUTE}/care`, { method: 'POST', body: { action: 'feed' } })
  assert.equal(status, 400)
  assert.equal(body.ok, false)
  assert.match(body.error, /金币/)
  const restored = loadState(home).state
  restored.gold = 200
  saveState(home, restored)
})

await test('未解锁关卡打不了', async () => {
  const { status, body } = await call(`${ROUTE}/battle`, { method: 'POST', body: { stageId: 5 } })
  assert.equal(status, 400)
  assert.match(body.error, /解锁|上一关/)
})

await test('战斗返回完整对局：日志、双方队伍、种子', async () => {
  const { status, body } = await call(`${ROUTE}/battle`, { method: 'POST', body: { stageId: 1 } })
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.ok(['a', 'b', 'draw'].includes(body.winner))
  assert.ok(body.log.length > 2)
  assert.equal(body.log.at(-1).kind, 'end')
  assert.equal(body.player.length, 1)
  assert.ok(body.enemies.length >= 1)
  assert.ok(Number.isInteger(body.seed))
  assert.ok(body.state.ok)
})

await test('强鲸鱼打通第一关：奖励入账 + 解锁第二关', async () => {
  const { state } = loadState(home)
  state.team[0].level = 40
  state.team[0].stats = { hp: 9000, atk: 600, def: 400, spd: 300, crit: 0.4 }
  state.care.stamina = 100
  state.cleared = []
  saveState(home, state)
  const { status, body } = await call(`${ROUTE}/battle`, { method: 'POST', body: { stageId: 1 } })
  assert.equal(status, 200)
  assert.equal(body.winner, 'a')
  assert.ok(body.rewards.gold > 0)
  assert.equal(body.rewards.firstClear, true)
  assert.ok(body.state.cleared.includes(1))
  const after = (await call(`${ROUTE}/state`)).body
  assert.equal(after.stages[1].unlocked, true)
})

await test('未知动作被拒绝', async () => {
  const { status } = await call(`${ROUTE}/care`, { method: 'POST', body: { action: 'sleepwalk' } })
  assert.equal(status, 400)
})

await test('非 JSON content-type 被挡（CSRF 兜底）', async () => {
  const { status } = await call(`${ROUTE}/care`, {
    method: 'POST',
    body: { action: 'feed' },
    headers: { 'content-type': 'text/plain' },
  })
  assert.equal(status, 415)
})

await test('跨站 Origin 被拒', async () => {
  const { status } = await call(`${ROUTE}/care`, {
    method: 'POST',
    body: { action: 'feed' },
    headers: { origin: 'https://evil.example.com' },
  })
  assert.equal(status, 403)
})

await test('劳作统计能数出今天的步数/工具调用/失败', async () => {
  const sessionDir = path.join(home, 'sessions', '--fake-workspace--', 'session-test')
  fs.mkdirSync(sessionDir, { recursive: true })
  const events = [
    { type: 'session', data: { id: 'session-test' } },
    { type: 'turn/start', data: { turn: 1 } },
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: `第 ${i} 步` }] } } })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'tool/call', data: { callId: `c${i}` } })),
    { type: 'tool/result', data: { message: { isError: true } } },
    { type: 'tool/result', data: { message: { isError: false } } },
  ]
  // 分帧写：真实会话就是每条事件一帧
  const frames = events.map((event) => zlib.zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`, 'utf8')))
  fs.writeFileSync(path.join(sessionDir, 'session.v4.jsonl.zstd'), Buffer.concat(frames))

  const work = todayWork(home)
  assert.equal(work.steps, 5, `steps=${work.steps}`)
  assert.equal(work.toolCalls, 4, `toolCalls=${work.toolCalls}`)
  assert.equal(work.toolErrors, 1, `toolErrors=${work.toolErrors}`)
  assert.equal(work.turns, 1, `turns=${work.turns}`)
  assert.ok(work.chars > 0)
  assert.ok(workBonus(work) > 0 && workBonus(work) <= 0.5)
  assert.ok(workGold(work, 1) > 0)

  const api = (await call(`${ROUTE}/work`)).body
  assert.equal(api.ok, true)
  assert.equal(api.work.toolCalls, 4)

  const state = (await call(`${ROUTE}/state`)).body
  assert.equal(state.work.toolCalls, 4)
  assert.ok(state.work.bonusPct >= 0)
})

await test('打工：金币增加、进冷却、体力下降', async () => {
  const before = (await call(`${ROUTE}/state`)).body
  const { status, body } = await call(`${ROUTE}/care`, { method: 'POST', body: { action: 'work' } })
  assert.equal(status, 200)
  assert.ok(body.gold > before.gold)
  assert.ok(body.care.stamina < 100)
  assert.ok(body.care.workReadyIn > 0)
  const again = await call(`${ROUTE}/care`, { method: 'POST', body: { action: 'work' } })
  assert.equal(again.status, 429)
})

await test('reset 回到 1 级新档', async () => {
  const { status, body } = await call(`${ROUTE}/reset`, { method: 'POST', body: {} })
  assert.equal(status, 200)
  assert.equal(body.team[0].level, 1)
  assert.equal(body.gold, 60)
  assert.deepEqual(body.cleared, [])
})

await test('损坏的存档会被修好而不是抛异常', async () => {
  const file = savePathOf(home)
  fs.writeFileSync(file, '{"team":[{"level":"oops","element":"lava"}],"gold":"x"}')
  const { state } = loadState(home)
  assert.equal(state.team.length, 1)
  assert.equal(state.team[0].level, 1)
  assert.equal(state.team[0].element, 'neutral')
  assert.equal(state.gold, 0)
})

await test('newPlayerState 形状稳定', () => {
  const state = newPlayerState()
  assert.equal(state.team.length, 1)
  for (const key of ['hunger', 'clean', 'mood', 'stamina']) assert.equal(typeof state.care[key], 'number')
  assert.deepEqual(state.cleared, [])
})

await test('旧企鹅档能迁移到鲸鱼目录', () => {
  const legacyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-legacy-'))
  const legacyDir = path.join(legacyHome, 'dsh-penguin-battle')
  fs.mkdirSync(legacyDir, { recursive: true })
  fs.writeFileSync(
    path.join(legacyDir, 'save.json'),
    JSON.stringify({
      gold: 333,
      team: [{ name: '小企鹅', element: 'ice', level: 7 }],
      cleared: [1, 2],
      care: { hunger: 50, clean: 50, mood: 50, stamina: 50, lastTick: Date.now() },
    }),
  )
  const migrated = loadState(legacyHome)
  assert.equal(migrated.migrated, true)
  assert.equal(migrated.state.team[0].level, 7)
  assert.equal(migrated.state.team[0].name, '小鲸鱼')
  assert.equal(migrated.state.gold, 333)
  assert.deepEqual(migrated.state.cleared, [1, 2])
  assert.ok(fs.existsSync(savePathOf(legacyHome)), '迁移后应该写出新档')
  fs.rmSync(legacyHome, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ 汇总 */

fs.rmSync(home, { recursive: true, force: true })
if (failures.length > 0) {
  console.error(`\n${failures.length} 个用例失败：`)
  for (const failure of failures) console.error(` - ${failure.name}: ${failure.error?.stack || failure.error}`)
  process.exit(1)
}
console.log(`\n全部通过：${passed} 个用例`)
