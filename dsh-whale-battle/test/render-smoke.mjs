// 客户端渲染冒烟：用最小 React shim 在 node 里把 client.js 真跑一遍。
//
// 目标不是像素级正确，而是「不会白屏」：模块能注册进 shell.overlay、点鲸鱼能开面板、
// 切页签能出内容、点关卡能真的走一次战斗、战斗日志能渲染出来。
// 夹具不是手写的 JSON——直接调宿主真实函数生成，避免两边字段漂移。
//
// 用法：node test/render-smoke.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { doBattle, snapshot } from '../lib/routes.js'
import { loadState, saveState } from '../lib/store.js'
import { registerRoutes } from '../lib/routes.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const code = fs.readFileSync(path.join(root, 'client.js'), 'utf8')

/* ------------------------------------------------------ 真实宿主夹具 */

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-smoke-'))
const { state } = loadState(home)
state.team[0].level = 4
state.gold = 260
state.care = { hunger: 60, clean: 35, mood: 70, stamina: 88, lastTick: Date.now(), workReadyAt: 0 }
saveState(home, state)

const stateFixture = snapshot(home)
const battleFixture = { ok: true, ...doBattle(loadState(home).state, home, 1) }

// 一个假的 webServer，把路由注册出来（顺便验证宿主侧路由可注册）
const routes = new Map()
registerRoutes({ webServer: { register({ path: routePath, handler }) { routes.set(routePath, handler); return () => {} } } }, { home })

const fixtures = {
  [`/dsh-whale-battle/state`]: stateFixture,
  [`/dsh-whale-battle/battle`]: battleFixture,
  [`/dsh-whale-battle/care`]: stateFixture,
}

/* ------------------------------------------------------ 最小 React */

let currentRec = null
const records = new Map()
let dirty = false

function recordFor(type) {
  let rec = records.get(type)
  if (!rec) {
    rec = { idx: 0, vals: [], deps: [], pending: [], dirty: false }
    records.set(type, rec)
  }
  return rec
}

const React = {
  createElement(type, props, ...children) {
    return { type, props: { ...(props || {}), children: children.flat ? children.flat() : children } }
  },
  Fragment: Symbol('Fragment'),
  useState(init) {
    const rec = currentRec
    const index = rec.idx++
    if (!(index in rec.vals)) rec.vals[index] = typeof init === 'function' ? init() : init
    return [rec.vals[index], (value) => {
      rec.vals[index] = typeof value === 'function' ? value(rec.vals[index]) : value
      rec.dirty = true
      dirty = true
    }]
  },
  useRef(initial) {
    const rec = currentRec
    const index = rec.idx++
    if (!(index in rec.vals)) rec.vals[index] = { current: initial }
    return rec.vals[index]
  },
  useEffect(effect, deps) {
    const rec = currentRec
    const index = rec.idx++
    const prev = rec.deps[index]
    const changed = !prev || !deps || deps.some((value, i) => value !== prev[i])
    if (changed) {
      rec.deps[index] = deps
      rec.pending.push(effect)
    }
  },
  useMemo(fn, deps) {
    const rec = currentRec
    const index = rec.idx++
    const prev = rec.deps[index]
    const changed = !prev || !deps || deps.some((value, i) => value !== prev[i])
    if (changed) {
      rec.deps[index] = deps
      rec.vals[index] = fn()
    }
    return rec.vals[index]
  },
  useCallback(fn, deps) {
    return React.useMemo(() => fn, deps)
  },
}

/* ------------------------------------------------------ DOM / 环境 shim */

const styleTags = []
const sandbox = {
  React,
  console,
  window: {},
  document: {
    createElement(tag) {
      const element = { tag, textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value } }
      return element
    },
    head: {
      appendChild(element) { styleTags.push(element) },
    },
  },
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
    setItem(key, value) { this.store.set(key, String(value)) },
    removeItem(key) { this.store.delete(key) },
  },
  fetch: async (url) => {
    const parsed = new URL(String(url), 'http://127.0.0.1:49236')
    const fixture = fixtures[parsed.pathname]
    if (!fixture) return { ok: false, status: 404, json: async () => ({ ok: false, error: 'not found' }) }
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(fixture)) }
  },
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
}
sandbox.window = sandbox
sandbox.window.innerWidth = 1600
sandbox.window.innerHeight = 900
sandbox.window.addEventListener = () => {}
sandbox.window.removeEventListener = () => {}
sandbox.window.__ModuleLoader__ = {
  load(definition) {
    sandbox.__loaded = definition
  },
}
vm.createContext(sandbox)

/* ------------------------------------------------------ 渲染器 */

function expand(node) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return { text: String(node) }
  if (Array.isArray(node)) return node.map(expand).filter(Boolean)
  if (typeof node.type === 'function') {
    const rec = recordFor(node.type)
    const saved = currentRec
    currentRec = rec
    rec.idx = 0
    const out = node.type({ ...node.props })
    currentRec = saved
    return expand(out)
  }
  const children = expand(node.props ? node.props.children : [])
  return { vnode: node, children: children ? (Array.isArray(children) ? children : [children]) : [] }
}

function walk(tree, visit) {
  if (!tree) return
  if (Array.isArray(tree)) {
    for (const item of tree) walk(item, visit)
    return
  }
  visit(tree)
  for (const child of tree.children || []) walk(child, visit)
}

function allText(tree) {
  const out = []
  walk(tree, (node) => {
    if (typeof node.text === 'string') out.push(node.text)
  })
  return out.join(' ')
}

function findByClassName(tree, className) {
  let found = null
  walk(tree, (node) => {
    if (!found && node.vnode && node.vnode.props && String(node.vnode.props.className || '').split(' ').includes(className)) found = node
  })
  return found
}

function findAllButtons(tree) {
  const out = []
  walk(tree, (node) => {
    if (node.vnode && node.vnode.type === 'button') out.push(node)
  })
  return out
}

function findButton(tree, label) {
  return findAllButtons(tree).find((node) => allText([node]).includes(label))
}

const macrotask = () => new Promise((resolve) => setImmediate(resolve))

async function render(component, props) {
  let tree = null
  for (let pass = 0; pass < 16; pass += 1) {
    for (const rec of records.values()) {
      rec.idx = 0
      rec.pending = []
      rec.dirty = false
    }
    dirty = false
    tree = expand(React.createElement(component, props || {}))
    const pending = [...records.values()].flatMap((rec) => rec.pending)
    for (const effect of pending) effect()
    await macrotask()
    await macrotask()
    if (!dirty && ![...records.values()].some((rec) => rec.dirty)) break
  }
  return tree
}

/* ------------------------------------------------------ 开跑 */

let failed = 0
function check(ok, label, detail) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) {
    failed += 1
    if (detail) console.log(`     ${detail}`)
  }
}

vm.runInContext(code, sandbox)
const loaded = sandbox.__loaded
check(Boolean(loaded), 'client.js 注册了模块')
check(loaded && loaded.id === 'dsh-whale-battle', '模块 id 正确')

const plugin = loaded.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require(${name})`)
})
check(plugin && Array.isArray(plugin.inject) && plugin.inject.includes('slots'), '插件注入 slots')

let registration = null
plugin.apply({
  slots: {
    inject(name, factory) {
      if (name === 'shell.overlay') factory()
    },
    register(options, Component) {
      registration = { options, Component }
      return () => {}
    },
  },
})
check(registration && registration.options.name === 'shell.overlay', '注册进 shell.overlay')
check(registration && registration.options.id === 'whale-battle', '槽位 id 正确')
check(registration && typeof registration.Component === 'function', '槽位拿到的是组件')

/* ------------------------------------------------------ 首屏：悬浮鲸鱼 */

let tree = await render(registration.Component, {})
const styleText = styleTags[0] ? styleTags[0].textContent : ''
check(styleText.includes('.wb-panel'), '样式注入了（不是裸组件）')
check(styleText.includes('@keyframes wb-lunge-up') && styleText.includes('.wb-anim-lunge-up'), '战斗动作的样式与关键帧都在')
let text = allText(tree)
check(text.includes('鲸鱼'), '首屏渲染出鲸鱼', text.slice(0, 160))
check(Boolean(findByClassName(tree, 'wb-whale')), '立绘画的是鲸鱼（wb-whale）')
check(Boolean(findByClassName(tree, 'wb-pet')), '有可拖动的宠物容器')
check(Boolean(findByClassName(tree, 'wb-bubble')), '有对话气泡')
check(text.includes(`Lv.${stateFixture.team[0].level}`), `名字牌显示等级 Lv.${stateFixture.team[0].level}`, text)

/* ------------------------------------------------------ 点开面板 */

const pet = findByClassName(tree, 'wb-pet')
pet.vnode.props.onPointerDown({ button: 0, clientX: 10, clientY: 10, currentTarget: { setPointerCapture() {} } })
pet.vnode.props.onPointerUp()

tree = await render(registration.Component, {})
text = allText(tree)
check(Boolean(findByClassName(tree, 'wb-panel')), '点鲸鱼打开了面板')
check(text.includes('对战') && text.includes('养成') && text.includes('队伍'), '面板有四个页签', text.slice(0, 200))
check(text.includes('浅滩草甸'), '对战页列出了关卡')
check(text.includes('主线'), '对战页显示通关进度')

/* ------------------------------------------------------ 切页签：养成 */

const careTab = findButton(tree, '养成')
check(Boolean(careTab), '找到「养成」页签')
careTab.vnode.props.onClick()
tree = await render(registration.Component, {})
text = allText(tree)
check(text.includes('今日劳作'), '养成页有今日劳作卡片', text.slice(0, 240))
check(text.includes('喂食') && text.includes('打工'), '养成页有互动按钮')
check(text.includes('饱食'), '养成页有四项状态')

/* ------------------------------------------------------ 切页签：队伍 */

findButton(tree, '队伍').vnode.props.onClick()
tree = await render(registration.Component, {})
text = allText(tree)
check(text.includes('我的队伍'), '队伍页存在')
check(text.includes('改名'), '队伍页可以改名')

/* ------------------------------------------------------ 打一关 */

findButton(tree, '对战').vnode.props.onClick()
tree = await render(registration.Component, {})
const stageButton = findAllButtons(tree).find((node) => allText([node]).includes('1. 浅滩草甸'))
check(Boolean(stageButton), '找到第一关按钮')
stageButton.vnode.props.onClick()
tree = await render(registration.Component, {})
const fightButton = findButton(tree, '开战')
check(Boolean(fightButton), '选中关卡后出现「开战」')
await fightButton.vnode.props.onClick()
tree = await render(registration.Component, {})
text = allText(tree)
check(text.includes('回合'), '战斗界面显示回合', text.slice(0, 240))
check(text.includes('跳过'), '战斗界面有跳过按钮')
check(text.includes('2×'), '战斗界面有倍速')
check(Boolean(findByClassName(tree, 'wb-arena')), '有战场容器')

// 关键：第一帧应该是一个攻击动作 —— 出手方有位移、目标有受击和飘字
let unitCount = 0
let animated = 0
let burst = 0
walk(tree, (node) => {
  const cls = String(node.vnode && node.vnode.props ? node.vnode.props.className || '' : '')
  if (cls.split(' ').includes('wb-unit')) unitCount += 1
  if (cls.includes('wb-anim-')) animated += 1
  if (cls.split(' ').includes('wb-burst')) burst += 1
})
check(unitCount >= 2, `双方单位卡都画出来了（${unitCount} 张）`)
check(animated >= 1, `第一帧有肢体动作（${animated} 个动画单位）`)
check(burst >= 1, '命中位置有冲击波特效')

/* ------------------------------------------------------ 结果 */

if (failed > 0) {
  console.error(`\n${failed} 项冒烟失败`)
  process.exit(1)
}
console.log('\n客户端冒烟全部通过')
fs.rmSync(home, { recursive: true, force: true })
