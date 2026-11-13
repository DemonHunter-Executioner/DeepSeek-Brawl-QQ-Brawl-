#!/usr/bin/env node
// 发布前自检：不联网、不依赖 DSH，跑一遍就知道这个包能不能被 DSH 装上。
//
//   node bin/check.mjs          全量检查（顺带把 client.js 重新生成一遍）
//   node bin/check.mjs --strict 额外要求 docs/ 里有截图
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const strict = process.argv.includes('--strict')

let failed = 0
const problems = []
function check(ok, label, hint) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !hint ? '' : `\n     → ${hint}`}`)
  if (!ok) {
    failed += 1
    problems.push({ label, hint })
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

/* ---------------------------------------------------------------- 文件 */

const REQUIRED = [
  'package.json',
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'icon.svg',
  'lib/game.js',
  'lib/store.js',
  'lib/routes.js',
  'lib/tools.js',
  'lib/worklog.js',
  'lib/desktop.js',
  'bin/build-client.mjs',
  'bin/build-pet.mjs',
  'assets/whale-idle.png',
  'pet-window/PetWindow.cs',
  '启动桌面鲸鱼.cmd',
  'src/client/00-head.js',
  'src/client/10-theme.js',
  'src/client/20-util.js',
  'src/client/30-whale.js',
  'src/client/40-kit.js',
  'src/client/45-data.js',
  'src/client/50-battle.js',
  'src/client/60-views.js',
  'src/client/70-panel.js',
  'src/client/80-overlay.js',
  'src/client/90-tail.js',
  'README.md',
  'LICENSE',
  'docs/PUBLISHING.md',
]
for (const file of REQUIRED) check(exists(file), `文件存在：${file}`, '检查 files/ 字段与仓库内容是否同步')

/* ------------------------------------------------------------ package.json */

let pkg = null
try {
  pkg = JSON.parse(read('package.json'))
} catch (error) {
  check(false, 'package.json 是合法 JSON', error.message)
}
if (pkg) {
  check(/^dsh-[a-z0-9-]+$/.test(pkg.name || ''), `包名合法：${pkg.name}`)
  check(/^\d+\.\d+\.\d+/.test(pkg.version || ''), `版本号合法：${pkg.version}`)
  check(pkg.type === 'module', 'type=module（ESM）')
  check(pkg.main === 'index.js', 'main 指向 index.js')
  check(Boolean(pkg.dsh), '有 dsh 字段')
  check(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml', 'dsh.bundle.patch 指向 cordis.patch.yml')
  check(pkg.dsh && pkg.dsh.client && pkg.dsh.client.platform === 'web', 'dsh.client.platform=web')
  check(pkg.dsh && pkg.dsh.client && Array.isArray(pkg.dsh.client.inject) && pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-layout'), 'client.inject 带 ui-layout（shell.overlay 来自它）')
  check(pkg.exports && pkg.exports['.'] === './index.js', 'exports["."] 指向 index.js')
  check(pkg.exports && pkg.exports['./client'] && pkg.exports['./client'].default === './client.js', 'exports["./client"] 指向 client.js')
  check(pkg.meta && pkg.meta.title, 'meta.title 有中文名')
  check(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, '零运行时依赖（不拖 node_modules 进 profile）')
  if (Array.isArray(pkg.files)) {
    for (const entry of pkg.files) {
      check(exists(entry.replace(/\/$/, '')), `files 里的路径真实存在：${entry}`)
    }
  } else {
    check(false, 'package.json 有 files 白名单')
  }
  check(Boolean(pkg.scripts && pkg.scripts.build && pkg.scripts.build.includes('build-client')), '有 build 脚本')
  check(Boolean(pkg.scripts && pkg.scripts.test && pkg.scripts.test.includes('test/')), 'test 脚本指向 test/')
}

/* --------------------------------------------------------------- 宿主 */

let host = null
try {
  host = read('index.js')
} catch {}
check(Boolean(host && /export\s+function\s+apply\s*\(/.test(host)), 'index.js 导出 apply(ctx, config)')
check(Boolean(host && /export\s+const\s+inject\s*=/.test(host)), 'index.js 声明了 inject')

/* ------------------------------------------------- 生成 client.js 并检查 */

let buildError = ''
try {
  execFileSync(process.execPath, [path.join(root, 'bin', 'build-client.mjs')], { stdio: 'inherit' })
} catch (error) {
  buildError = String(error?.message || error)
}
check(!buildError, 'client.js 能从 src/client 生成', buildError)

let client = ''
try {
  client = read('client.js')
} catch {}
check(client.includes('__ModuleLoader__.load('), 'client.js 用 __ModuleLoader__ 注册')
check(client.includes('shell.overlay'), 'client.js 挂到 shell.overlay')
check(client.includes('wb-whale'), 'client.js 里是新鲸鱼立绘')
check(client.length > 20_000, `client.js 不是占位（${(client.length / 1024).toFixed(1)} KB）`)
check(!/^\s*(import|export)\s/m.test(client), 'client.js 没有 ESM import/export（浏览器工厂里跑）')
check(!client.includes('dsh-penguin-battle') && !client.includes('pb-panel'), 'client.js 没有旧企鹅版的残留')
check(!/[^\n]*\bpenguin\b/i.test(client), 'client.js 里没有 penguin 字样')

/* ------------------------------------------------------------ patch 文件 */

let patch = null
try {
  patch = read('cordis.patch.yml')
} catch {}
check(Boolean(patch && /insert:/.test(patch)), 'cordis.patch.yml 有 insert 段')
if (patch && pkg) {
  check(patch.includes(pkg.name), `patch 里的 name 等于包名 ${pkg.name}`)
  check(Boolean(patch.match(/-\s*id:\s*([a-z0-9-]+)/i)), 'patch 里有 id')
}

/* ------------------------------------------------------------- 语法检查 */

const files = []
function walk(dir, depth) {
  if (depth > 3) return
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) walk(rel, depth + 1)
    else if (/\.(m?js)$/.test(entry.name)) files.push(rel)
  }
}
// src/client/* 是工厂闭包里的片段（00 开头、90 结尾），单独 node --check 必然报
// "Illegal return" —— 它们由 build-client.mjs 拼成 client.js 后统一做语法检查。
for (const dir of ['', 'lib', 'bin', 'test']) {
  if (fs.existsSync(path.join(root, dir))) walk(dir, 0)
}
const checkable = [...new Set(files)].filter((file) => !file.startsWith('src/'))
let syntaxChecked = 0
let syntaxFailed = 0
for (const file of checkable) {
  try {
    // stdio: inherit —— 有些沙箱环境不允许子进程走管道；失败时语法错误会直接打到终端。
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' })
    syntaxChecked += 1
  } catch {
    syntaxFailed += 1
    check(false, `node --check ${file}`, '看上面打印的语法错误')
  }
}
if (syntaxFailed === 0) check(true, `语法检查通过：${syntaxChecked} 个 JS 文件`)

/* --------------------------------------------------------------- 文档 */

check(read('README.md').length > 1500, 'README 不是占位文件')
check(/MIT License/i.test(read('LICENSE')), 'LICENSE 是 MIT')
check(exists('.gitignore'), '有 .gitignore')

const docsOk = exists('docs') && fs.readdirSync(path.join(root, 'docs')).some((name) => /\.(png|jpg|webp|gif)$/i.test(name))
if (strict) check(docsOk, 'docs/ 里有截图', '装进 DSH 后截一张鲸鱼面板图放进 docs/，README 会引用它')

/* --------------------------------------------------------------- 汇总 */

if (failed > 0) {
  console.error(`\n${failed} 项没通过：`)
  for (const problem of problems) console.error(` - ${problem.label}`)
  process.exit(1)
}
console.log('\n校验通过：文件齐全、元数据完整、client.js 可重新生成、所有 JS 通过 node --check。')
