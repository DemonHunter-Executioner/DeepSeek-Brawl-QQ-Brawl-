// dsh-whale-battle · 宿主半区
//
// 干三件事：
//   1. 存档 + 离线结算（每条鲸鱼都记得自己多久没被喂过）
//   2. /dsh-whale-battle/* HTTP 路由（客户端和控制台都走它）
//   3. 三个给 agent 的工具（whale_status / whale_care / whale_battle）
//
// 浏览器半区（src/client → client.js）只负责画：悬浮鲸鱼、战斗动作、数值面板。
// 两个半区之间只有一个 HTTP 契约，没有隐藏状态——所以刷新页面、重装插件都不会丢档。
import { registerRoutes } from './lib/routes.js'
import { registerTools } from './lib/tools.js'
import { resolveHome, savePathOf, touchState } from './lib/store.js'
import { stateDirOf } from './lib/desktop.js'
import fs from 'node:fs'
import path from 'node:path'

/** tools 是硬依赖：没有它就没法在对话里照顾鲸鱼。webServer 单独用 ctx.inject 等。 */
export const inject = ['tools']

export function apply(ctx, config = {}) {
  const home = resolveHome(config)
  const logger = typeof ctx.logger?.info === 'function' ? (msg) => ctx.logger.info(msg) : () => {}

  // 首次启动就建档：用户装完插件打开面板，看到的应该是一条活鲸鱼，不是空白。
  try {
    const { state, fresh, migrated } = touchState(home)
    logger(`[鲸鱼大作战] 已挂载 home=${home} 存档=${savePathOf(home)} `
      + `${fresh ? '（新档）' : ''}${migrated ? '（已从旧企鹅档迁移）' : ''} `
      + `Lv.${state.team[0]?.level ?? '-'} 金币 ${state.gold}`)
  } catch (error) {
    logger(`[鲸鱼大作战] 读取存档失败：${error?.message ?? error}`)
  }

  const deps = { home, config, logger }

  // 把本次运行的 Web 地址记下来：桌面小窗（尤其是双击启动器启动的）靠它找接口。
  try {
    const dir = stateDirOf()
    fs.mkdirSync(dir, { recursive: true })
    const base = String(process.env.DSH_WEB_URL || '').trim().replace(/\/$/, '')
    if (base) fs.writeFileSync(path.join(dir, 'base-url.txt'), base, 'utf8')
  } catch {}

  const disposeTools = registerTools(ctx, deps)
  ctx.effect(() => () => disposeTools(), 'dsh-whale-battle: tools')

  ctx.inject(['webServer'], (scope) => registerRoutes(scope, deps))

  void ctx
}
