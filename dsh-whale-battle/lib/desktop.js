// 桌面小窗的启动/编译/关闭。
//
// 小窗是一个独立的 WinExe（C# WinForms + 分层透明窗口），不依赖 Electron：
//   · 首次使用时用 Windows 自带的 csc.exe 把 pet-window/PetWindow.cs 编译到 %LOCALAPPDATA%
//   · 之后只需要 spawn（detached + stdio ignore），它会自己轮询 /dsh-whale-battle/state
//   · 关掉 DSH 后它连不上接口，会自己在几次失败后退出
//
// 为什么不由浏览器半区来开：网页拿不到"置顶透明窗口"这种能力，只能由宿主进程开进程。
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sourceFile = path.join(pluginDir, 'pet-window', 'PetWindow.cs')
const assetsDir = path.join(pluginDir, 'assets')

const CSC_CANDIDATES = [
  'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
  'C:/Windows/Microsoft.NET/Framework/v4.0.30319/csc.exe',
]

export function stateDirOf() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  return path.join(local, 'dsh-whale-battle')
}

export function exePathOf() {
  return path.join(stateDirOf(), 'pet-window.exe')
}

function pidPathOf() {
  return path.join(stateDirOf(), 'pet.pid')
}

function logPathOf() {
  return path.join(stateDirOf(), 'pet.log')
}

export function assetsPathOf() {
  return assetsDir
}

function readPid() {
  try {
    const pid = Number(fs.readFileSync(pidPathOf(), 'utf8').trim())
    return Number.isFinite(pid) && pid > 0 ? pid : 0
  } catch {
    return 0
  }
}

function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** 编译产物是否比源码新。 */
export function buildState() {
  const exe = exePathOf()
  if (!fs.existsSync(exe)) return { built: false, exe, reason: 'missing' }
  try {
    const newer = fs.statSync(exe).mtimeMs >= fs.statSync(sourceFile).mtimeMs
    return { built: newer, exe, reason: newer ? 'ok' : 'stale' }
  } catch (error) {
    return { built: false, exe, reason: String(error?.message ?? error) }
  }
}

/** 需要时用系统自带的 csc 编译，返回 { ok, exe, error }。 */
export function ensureBuilt(logger = () => {}) {
  const state = buildState()
  if (state.built) return { ok: true, exe: state.exe }
  if (process.platform !== 'win32') return { ok: false, error: '桌面小窗目前只支持 Windows' }
  const csc = CSC_CANDIDATES.find((file) => fs.existsSync(file))
  if (!csc) return { ok: false, error: '找不到 .NET Framework 的 csc.exe（Windows 自带）' }
  if (!fs.existsSync(sourceFile)) return { ok: false, error: '缺少 pet-window/PetWindow.cs' }
  if (!fs.existsSync(path.join(assetsDir, 'whale-idle.png'))) {
    return { ok: false, error: '缺少 assets/whale-idle.png' }
  }

  fs.mkdirSync(stateDirOf(), { recursive: true })
  const args = [
    '/nologo',
    '/target:winexe',
    '/codepage:65001',
    '/optimize+',
    `/out:${state.exe}`,
    '/r:System.dll',
    '/r:System.Core.dll',
    '/r:System.Drawing.dll',
    '/r:System.Windows.Forms.dll',
    '/r:System.Web.Extensions.dll',
  ]
  const icon = path.join(assetsDir, 'tray.ico')
  if (fs.existsSync(icon)) args.push(`/win32icon:${icon}`)
  args.push(sourceFile)

  logger(`[鲸鱼大作战] 编译桌面小窗：${path.basename(sourceFile)} → ${state.exe}`)
  const result = spawnSync(csc, args, { windowsHide: true, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.stdout || result.error?.message || '').trim()
    logger(`[鲸鱼大作战] 编译失败：${detail || `exit ${result.status}`}`)
    return { ok: false, error: detail || `csc 退出码 ${result.status}` }
  }
  if (!fs.existsSync(state.exe)) return { ok: false, error: '编译完成但没有生成 exe' }
  return { ok: true, exe: state.exe }
}

export function status() {
  const pid = readPid()
  const alive = isAlive(pid)
  const state = buildState()
  let log = ''
  try {
    log = fs.readFileSync(logPathOf(), 'utf8').split('\n').slice(-5).join('\n')
  } catch {}
  return { running: alive, pid: alive ? pid : 0, exe: state.exe, built: state.built, assets: assetsDir, log }
}

/** 只问「在不在跑」，给 /state 每次轮询用，不碰磁盘以外的东西。 */
export function isRunning() {
  return isAlive(readPid())
}

/** 启动（已在跑就直接返回）。 */
export function open(baseUrl, logger = () => {}) {
  if (process.platform !== 'win32') return { ok: false, error: '桌面小窗目前只支持 Windows' }
  const current = readPid()
  if (isAlive(current)) return { ok: true, already: true, pid: current, ...status() }
  const build = ensureBuilt(logger)
  if (!build.ok) return { ok: false, error: build.error }

  const child = spawn(
    build.exe,
    ['--base', baseUrl, '--assets', assetsDir, '--state', stateDirOf()],
    { detached: true, stdio: 'ignore', windowsHide: true },
  )
  child.unref()
  if (!child.pid) return { ok: false, error: '启动桌面小窗失败' }
  try {
    fs.mkdirSync(stateDirOf(), { recursive: true })
    fs.writeFileSync(pidPathOf(), String(child.pid))
  } catch {}
  logger(`[鲸鱼大作战] 桌面小窗已启动 pid=${child.pid}`)
  return { ok: true, pid: child.pid, base: baseUrl, ...status() }
}

/** 关掉（找不到进程也算成功）。 */
export function close(logger = () => {}) {
  const pid = readPid()
  if (pid && isAlive(pid)) {
    try {
      process.kill(pid)
    } catch {
      try {
        spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true })
      } catch {}
    }
    logger(`[鲸鱼大作战] 桌面小窗已关闭 pid=${pid}`)
  }
  try {
    fs.unlinkSync(pidPathOf())
  } catch {}
  return { ok: true, running: false }
}
