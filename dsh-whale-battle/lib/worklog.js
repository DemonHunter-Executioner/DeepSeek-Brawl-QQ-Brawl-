// 「今天你到底干了多少活」——读 DSH 自己的会话日志来算。
//
// 这是这个插件跟别的桌宠最不一样的地方：企鹅吃的是你真实的劳作量，不是挂机时长。
// 我们只数事件条数（步数、工具调用、失败次数），不解码任何对话正文，也不落盘原文。
//
// 会话文件是分帧 zstd（每追加一条事件就是一帧），所以按 magic 切开逐帧解压；
// 解不动就跳过——日志坏掉不该把宠物也拖死。
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const FRAME_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const MAX_FILES = 60
const MAX_FILE_BYTES = 24 * 1024 * 1024

/** path -> { mtimeMs, size, day, stats } */
const cache = new Map()

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function splitFrames(buffer) {
  const offsets = []
  for (let i = 0; i <= buffer.length - 4; i += 1) {
    if (buffer[i] === FRAME_MAGIC[0] && buffer[i + 1] === FRAME_MAGIC[1]
      && buffer[i + 2] === FRAME_MAGIC[2] && buffer[i + 3] === FRAME_MAGIC[3]) offsets.push(i)
  }
  if (offsets.length === 0) return [buffer]
  return offsets.map((start, index) => buffer.subarray(start, offsets[index + 1] ?? buffer.length))
}

export function listSessionFiles(home) {
  const root = path.join(home, 'sessions')
  const out = []
  const walk = (dir, depth) => {
    if (depth > 3) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full, depth + 1)
      } else if (/^session.*\.jsonl(\.zstd)?$/i.test(entry.name)) {
        try {
          const stat = fs.statSync(full)
          out.push({ file: full, mtimeMs: stat.mtimeMs, size: stat.size })
        } catch {}
      }
    }
  }
  walk(root, 0)
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_FILES)
}

function readFileStats(file, size) {
  if (size > MAX_FILE_BYTES) return null
  // Node 24 才有 zstd；没有就老老实实返回空统计，别让宠物因为运行时太旧而挂掉。
  if (file.endsWith('.zstd') && typeof zlib.zstdDecompressSync !== 'function') return null
  let text
  try {
    const buffer = fs.readFileSync(file)
    if (file.endsWith('.zstd')) {
      const parts = splitFrames(buffer)
      const chunks = []
      for (const part of parts) {
        try {
          chunks.push(zlib.zstdDecompressSync(part))
        } catch {
          // 半截帧 / 正在写的帧：跳过
        }
      }
      text = Buffer.concat(chunks).toString('utf8')
    } else {
      text = buffer.toString('utf8')
    }
  } catch {
    return null
  }

  const stats = { steps: 0, toolCalls: 0, toolErrors: 0, turns: 0, chars: 0, sessions: 1 }
  for (const line of text.split('\n')) {
    if (!line) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    switch (event?.type) {
      case 'assistant/message': {
        stats.steps += 1
        const content = event?.data?.message?.content
        if (Array.isArray(content)) {
          for (const part of content) if (part?.type === 'text' && typeof part.text === 'string') stats.chars += part.text.length
        }
        break
      }
      case 'tool/call':
        stats.toolCalls += 1
        break
      case 'tool/result':
        if (event?.data?.message?.isError) stats.toolErrors += 1
        break
      case 'turn/start':
        stats.turns += 1
        break
      case 'session':
        stats.sessionId = event?.data?.id || event?.id
        break
      default:
        break
    }
  }
  return stats
}

/**
 * 今天（本机时区）的真实工作量。带 mtime 缓存，反复请求不会反复解压。
 * @returns {{ steps:number, toolCalls:number, toolErrors:number, turns:number, chars:number, sessions:number, files:number, scannedAt:number }}
 */
export function todayWork(home) {
  const today = startOfToday()
  const files = listSessionFiles(home)
  const totals = { steps: 0, toolCalls: 0, toolErrors: 0, turns: 0, chars: 0, sessions: 0, files: 0, scannedAt: Date.now() }
  const seen = new Set()

  for (const item of files) {
    // 昨天及更早的文件不会贡献今天的劳作量；按 mtime 先筛掉，省一次解压。
    if (item.mtimeMs < today) continue

    const cached = cache.get(item.file)
    const unchanged = cached && cached.mtimeMs === item.mtimeMs && cached.size === item.size
    // 正在写的会话文件每写一条 mtime 就变；15 秒内复用上次结果，避免每开一次面板就重解压几 MB。
    const recentlyRead = cached && cached.readAt && Date.now() - cached.readAt < 15_000
    let stats = null
    if (unchanged || recentlyRead) {
      stats = cached.stats
    } else {
      stats = readFileStats(item.file, item.size)
      cache.set(item.file, { mtimeMs: item.mtimeMs, size: item.size, stats, readAt: Date.now() })
    }
    if (!stats) continue
    totals.files += 1
    for (const key of ['steps', 'toolCalls', 'toolErrors', 'turns', 'chars', 'sessions']) totals[key] += stats[key] || 0
    seen.add(keyOf(stats))
  }

  totals.sessions = seen.size
  return totals
}

function keyOf(stats) {
  return stats?.sessionId || Math.random().toString(36)
}

/** 劳作加成：0 ~ 0.5，喂给战斗经验。 */
export function workBonus(work) {
  const score = (work?.toolCalls || 0) + (work?.steps || 0) * 2 + (work?.turns || 0) * 2
  return Math.min(0.5, Math.round((score / 600) * 100) / 100)
}

/** 打工一次能挣多少（跟今天的真实调用量挂钩）。 */
export function workGold(work, level = 1) {
  const base = 16 + level * 3
  const fromWork = Math.min(90, Math.floor((work?.toolCalls || 0) / 3))
  return base + fromWork
}

export function clearWorkCache() {
  cache.clear()
}
