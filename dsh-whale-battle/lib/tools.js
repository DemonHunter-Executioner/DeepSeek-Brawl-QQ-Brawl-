// 给 agent 的工具：可以在对话里直接「帮我喂一口」「替我打一关」。
//
// 工具名统一 whale_ 前缀，和别的插件区分开。返回一律是 JSON 字符串，
// 人类可读的部分交给 render，模型看到的是结构化数据。
import { ELEMENTS, STAGES } from './game.js'
import { loadState, resolveHome, touchState } from './store.js'
import { doBattle, doCare, snapshot } from './routes.js'
import { close as closeDesktop, open as openDesktop, status as desktopStatus } from './desktop.js'

const STRING_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: String(value) }],
}

function json(value) {
  return JSON.stringify(value, null, 2)
}

function brief(state) {
  const lead = state.team[0]
  if (!lead) return { ok: false, error: '队伍里没有鲸鱼' }
  return {
    gold: state.gold,
    care: {
      hunger: Math.round(state.care.hunger),
      clean: Math.round(state.care.clean),
      mood: Math.round(state.care.mood),
      stamina: Math.round(state.care.stamina),
    },
    lead: {
      name: lead.name,
      level: lead.level,
      exp: lead.exp,
      element: ELEMENTS[lead.element]?.name,
      form: lead.form,
      stats: lead.stats,
    },
    teamSize: state.team.length,
    cleared: state.cleared,
  }
}

export function registerTools(ctx, deps) {
  const home = deps?.home || resolveHome(deps?.config)
  const disposers = []

  disposers.push(ctx.tools.register({
    name: 'whale_status',
    description:
      '查看鲸鱼大作战的状态：金币、四项养成数值（饱食/清洁/心情/体力）、主鲸等级与属性、已通关卡。'
      + '想知道「它现在怎么样」「还差多少金币」时先查这个。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: STRING_OUTPUT,
    async execute() {
      try {
        const { state } = touchState(home)
        const view = snapshot(home)
        return json({ ...brief(state), work: view.work, nextLevelExp: view.lead?.expToNext })
      } catch (error) {
        return json({ ok: false, error: String(error?.message ?? error) })
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'whale_care',
    description:
      '照顾鲸鱼。action 取值：feed 喂食（花 8 金币）、bath 洗澡（花 6 金币）、play 陪玩（耗 10 体力）、'
      + 'sleep 睡觉（回 42 体力，3 分钟冷却）、work 打工（耗 20 体力，赚金币，10 分钟冷却）、train 训练（耗 15 体力，涨经验）。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['feed', 'bath', 'play', 'sleep', 'work', 'train'], description: '要做的动作' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: STRING_OUTPUT,
    async execute(args) {
      try {
        const { state } = loadState(home)
        const view = doCare(state, home, String(args?.action || ''))
        return json({
          ok: true,
          action: args.action,
          hint: view.log.at(-1)?.text,
          gold: view.gold,
          care: view.care,
          lead: view.lead && { name: view.lead.name, level: view.lead.level, formName: view.lead.formName },
        })
      } catch (error) {
        return json({ ok: false, error: String(error?.message ?? error) })
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'whale_battle',
    description:
      '替鲸鱼打一关（回合制自动战斗，宿主机结算）。stageId 从 1 到 12，必须先解锁上一关。'
      + '返回胜负、回合数、战斗日志摘要与奖励；赢了的经验金币会立刻入账。',
    parameters: {
      type: 'object',
      properties: {
        stageId: { type: 'integer', minimum: 1, maximum: 12, description: '关卡编号 1-12' },
      },
      required: ['stageId'],
      additionalProperties: false,
    },
    timeoutMs: 30000,
    output: STRING_OUTPUT,
    async execute(args) {
      try {
        const { state } = loadState(home)
        const stageId = Number(args?.stageId)
        if (!STAGES.some((stage) => stage.id === stageId)) return json({ ok: false, error: '没有这个关卡（1-12）' })
        const result = doBattle(state, home, stageId)
        const lines = result.log.filter((entry) => entry.kind === 'hit' || entry.kind === 'down').slice(-8).map((entry) => entry.text)
        return json({
          ok: true,
          stage: result.stage,
          winner: result.winner,
          rounds: result.rounds,
          mvp: result.mvp,
          rewards: result.rewards,
          tail: lines,
          state: brief(result.state),
        })
      } catch (error) {
        return json({ ok: false, error: String(error?.message ?? error) })
      }
    },
  }))

  disposers.push(ctx.tools.register({
    name: 'whale_desktop',
    description:
      '打开 / 关闭桌面鲸鱼小窗（Windows 置顶透明窗口，浮在所有应用上面）。'
      + 'action=open 时会在 %LOCALAPPDATA% 里按需编译并启动 pet-window.exe；close 关掉它；status 看运行状态。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['open', 'close', 'status'], description: '要做的操作' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: STRING_OUTPUT,
    async execute(args) {
      try {
        const action = String(args?.action || 'status')
        if (action === 'open') {
          const base = process.env.DSH_WEB_URL || 'http://127.0.0.1:49236'
          return json(openDesktop(base, () => {}))
        }
        if (action === 'close') return json(closeDesktop())
        return json(desktopStatus())
      } catch (error) {
        return json({ ok: false, error: String(error?.message ?? error) })
      }
    },
  }))

  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {}
    }
    disposers.length = 0
  }
}
