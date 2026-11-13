#!/usr/bin/env node
// 编译桌面小窗：用 Windows 自带的 .NET Framework csc.exe，不需要装任何 SDK。
//
//   node bin/build-pet.mjs                  → dist/pet-window.exe（开发用）
//   node bin/build-pet.mjs --out <绝对路径>    → 指定输出（插件运行时用 %LOCALAPPDATA%）
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)

function arg(name) {
  const index = process.argv.indexOf(name)
  return index > -1 ? process.argv[index + 1] : ''
}

const outArg = arg('--out')
const out = outArg
  ? path.resolve(outArg)
  : path.join(root, 'dist', 'pet-window.exe')
const source = path.join(root, 'pet-window', 'PetWindow.cs')
const icon = path.join(root, 'assets', 'tray.ico')

const candidates = [
  'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',
  'C:/Windows/Microsoft.NET/Framework/v4.0.30319/csc.exe',
]
const csc = candidates.find((file) => fs.existsSync(file))

if (!csc) {
  console.error('找不到 .NET Framework 的 csc.exe（Windows 自带，理论上一定有）。')
  process.exit(1)
}
if (!fs.existsSync(source)) {
  console.error('缺少 pet-window/PetWindow.cs')
  process.exit(1)
}

// 先渲染帧（如果没生成过）
if (!fs.existsSync(path.join(root, 'assets', 'whale-idle.png'))) {
  console.error('缺少 assets/whale-idle.png：先跑 python bin/render-pet-frames.py')
  process.exit(1)
}

fs.mkdirSync(path.dirname(out), { recursive: true })

const args = [
  '/nologo',
  '/target:winexe',
  '/codepage:65001',
  '/optimize+',
  `/out:${out}`,
  '/r:System.dll',
  '/r:System.Core.dll',
  '/r:System.Drawing.dll',
  '/r:System.Windows.Forms.dll',
  '/r:System.Web.Extensions.dll',
]
if (fs.existsSync(icon)) args.push(`/win32icon:${icon}`)
args.push(source)

try {
  execFileSync(csc, args, { stdio: 'inherit' })
} catch {
  console.error('编译失败（看上面的 csc 报错）')
  process.exit(1)
}

const size = fs.statSync(out).size
console.log(`已生成 ${path.relative(root, out)}：${(size / 1024).toFixed(1)} KB`)
