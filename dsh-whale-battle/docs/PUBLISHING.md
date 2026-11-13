# 发布与上架

这份文档只写「把它推出去」需要做的事。插件本身的开发说明在根目录 `README.md`。

## 0. 发布前自检

```bash
node bin/check.mjs
```

它会检查必需文件、`package.json` 的 `dsh` 字段、`cordis.patch.yml`、重新生成一遍 `client.js`，
把库里所有 JS 过一遍 `node --check`。再加 `--strict` 会提醒你补 `docs/` 截图。

```bash
node bin/build-client.mjs && git diff --exit-code client.js   # 产物必须是最新的
node test/game.test.mjs && node test/routes.test.mjs && node test/render-smoke.mjs
```

## 1. 先在本地装一遍（别跳过）

装进你自己的 DSH，确认三件事：右下角有鲸鱼、点开面板、打一关能看到动作。

- **GUI**：设置 → 插件管理 → 从本地安装 → 选中本目录 → **刷新页面**
- **让 DSH 装**：对它说「安装本地插件包 <这个目录的绝对路径>」
- **自检**：`curl http://127.0.0.1:<你的端口>/dsh-whale-battle/state` 返回 `{"ok":true,...}`

> 安装只是把本目录链接进 profile（`~/.dsh/plugins/` + profile 的 `package.json`），
> 改完源码用 GUI 重新装一次或重启 DSH 即可；存档在 `~/.dsh/dsh-whale-battle/save.json`，不会被覆盖。

## 2. 建 GitHub 仓库

仓库名建议就是包名 `dsh-whale-battle`。

```bash
cd dsh-whale-battle
git init -b main          # 已经在仓库里就跳过
git add -A
git commit -m "feat: 鲸鱼大作战 0.2.0 —— 鲸鱼立绘 + 战斗动作 + 前端重构"

# 网页上建一个空仓库后：
git remote add origin git@github.com:<你的用户名>/dsh-whale-battle.git
git push -u origin main
```

仓库设置里填：

- **Description**：`DeepSeek Harness 的鲸鱼桌宠 + 回合制自动对战：十二关、技能、属性克制、战斗动作、进化，经验吃你真实的工具调用量。`
- **Topics**：`dsh-plugin` `deepseek-harness` `desktop-pet` `whale` `turn-based` `tamagotchi`
- 按版本打 tag（见第 3 节）

`dsh-plugin` 这个 topic 是市场爬虫认的标记，别漏。

## 3. 打第一个 release

```bash
git tag v0.2.0
git push origin v0.2.0
```

Release 里贴玩法说明和一张「战斗动作」截图最有效——这个插件最大的卖点就是看得见的打斗。
GitHub 会自动生成源码 zip；DSH 从 GitHub 安装时直接拉源码，不需要额外构建。

## 4. 上架到 DSH 插件市场

市场目录是 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，
线上站点 `awesome-dsh-plugin.com` 和 `dsh-plugin-catalog` 都从它生成。

### A. 用现成的一键发布插件（省事）

社区有个 `dsh-plugin-publisher`：本地 preflight → 快照 push → 打 `dsh-plugin` topic → 提 awesome-dsh-plugin 的 PR，一条龙。

```bash
dsh plugin --profile web add github:Dried-Persimmon-JPG/dsh-plugin-publisher
```

装好后按它 README 的流程跑，注意它是**在你自己的 GitHub 账号和 token 下**操作的。

### B. 手动提 PR（可控）

1. fork `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 按现有格式加一条，字段参照这份草稿：

```jsonc
{
  "name": "dsh-whale-battle",
  "url": "https://github.com/<你的用户名>/dsh-whale-battle",
  "description": {
    "en": "A whale desktop pet for DeepSeek Harness with 12-stage turn-based auto-battles: elemental counters, skills, crits, status effects and 3v3, plus feeding/bathing/working — with visible combat animations, and EXP fed by your real tool-call volume.",
    "zh": "给 DeepSeek Harness 的鲸鱼桌宠：十二关回合制自动对战（属性克制、技能、暴击、异常状态、3v3），战斗有看得见的动作，喂食洗澡打工，经验来自你真实的工具调用量。"
  },
  "categories": ["ui"],
  "install": "dsh plugin --profile web add github:<你的用户名>/dsh-whale-battle",
  "keywords": ["pet", "whale", "battle", "game", "desktop-pet"]
}
```

3. 提 PR，标题 `feat: add dsh-whale-battle`，描述里放一句「装完是什么样子」+ 一张战斗截图。

> 字段名和目录结构以对方仓库当时的 README / schema 为准；上面是按 `plugins.json` 的实际字段写的草稿。
> 如果 PR 被拒，通常是缺截图、缺一句人类可读的玩法描述，或者条目里混进了推广链接。

## 5. 发 npm（可选）

不强制。好处是别人能 `dsh plugin add dsh-whale-battle` 直接装、市场能显示 npm 徽标；坏处是每次发版多一步。

```bash
npm publish --access public
```

`package.json` 已经有 `files` 白名单，只会带上运行必需的文件（`lib/`、`index.js`、`client.js`、`icon.svg`、`cordis.patch.yml`、README、LICENSE）。
`src/` 不进 npm 包——它只在仓库里维护源码。

## 6. 以后每次更新

1. 改 `src/client/*.js` → `node bin/build-client.mjs`（**别忘了提交 client.js**）；
2. 三套测试 + `node bin/check.mjs` 全绿；
3. 更新 `package.json` 版本号；
4. commit + tag + push + release；
5. 市场 PR 只需要在版本变大时更新（用 `github:user/repo` 的 install 永远不用改）。

## 7. 装完没反应？按顺序排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 右下角没有鲸鱼 | 客户端 bundle 没重载 | 硬刷新 `Ctrl+F5`；还不行重启 DSH |
| 有鲸鱼但点开是「小鲸鱼正在游过来…」 | 宿主路由没起来 | `curl .../dsh-whale-battle/state`；404 就看 DSH 日志里插件挂载报错 |
| 控制台 `__ModuleLoader__` 报错 | `client.js` 语法或槽位名不对 | `node bin/build-client.mjs` 后看 `node --check client.js` |
| 战斗能打但没有动作 | CSS 未注入或类名不匹配 | 检查页面里有没有 `.wb-anim-lunge-up` 这段样式；确认没有旧版本残留 |
| 面板能开但数值不动 | 存档目录不可写 | 检查 `~/.dsh/dsh-whale-battle/` 权限 |
| 经验加成一直是 0% | 今天没有新会话事件 | 正常：只有当天动过的会话文件才算 |
