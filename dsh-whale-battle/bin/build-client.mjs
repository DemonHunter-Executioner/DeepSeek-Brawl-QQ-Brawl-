#!/usr/bin/env node
// 把 src/client/*.js 按顺序拼成 client.js。
//
// 为什么不用打包器：DSH 的浏览器半区只接受一个自包含的 `client.js`（模块工厂形式），
// 不允许 ESM import，也不该为了一个插件往用户机器上拖 node_modules。这些源文件
// 都是同一个工厂闭包里的片段，拼起来就是一个文件——零依赖，改起来还是分文件的。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(here)
const srcDir = path.join(root, 'src', 'client')
const outFile = path.join(root, 'client.js')

const ORDER = [
  '00-head.js',
  '10-theme.js',
  '20-util.js',
  '30-whale.js',
  '40-kit.js',
  '45-data.js',
  '50-battle.js',
  '60-views.js',
  '70-panel.js',
  '80-overlay.js',
  '90-tail.js',
]

const files = ORDER.map((name) => {
  const file = path.join(srcDir, name)
  if (!fs.existsSync(file)) {
    console.error(`缺少源文件：src/client/${name}`)
    process.exit(1)
  }
  return { name, text: fs.readFileSync(file, 'utf8').replace(/\s+$/, '') }
})

// 粗校验：源文件里不该出现 ESM 语法，拼出来的闭包也不该少括号
for (const file of files) {
  if (/^\s*(import|export)\s/m.test(file.text)) {
    console.error(`src/client/${file.name} 里有 ESM import/export —— 浏览器半区只能挂在工厂闭包里`)
    process.exit(1)
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const banner = [
  '/*',
  ' * dsh-whale-battle · 浏览器半区（自动生成，不要直接改这个文件）',
  ' *',
  ' * 源文件：src/client/*.js  →  node bin/build-client.mjs  →  client.js',
  ' * 生成时间不写进文件，保证构建可重复（CI 会用 git diff 检查产物是否最新）。',
  ` * 版本：${pkg.version}`,
  ' */',
  '',
].join('\n')

const body = files.map((file) => file.text).join('\n\n')
const output = `${banner}${body}\n`

if (fs.existsSync(outFile)) {
  const previous = fs.readFileSync(outFile, 'utf8')
  if (previous === output) {
    console.log(`client.js 已是最新（${files.length} 个源文件，${output.split('\n').length} 行）`)
    process.exit(0)
  }
}

fs.writeFileSync(outFile, output, 'utf8')
console.log(`已生成 client.js：${files.length} 个源文件 → ${output.split('\n').length} 行 / ${(output.length / 1024).toFixed(1)} KB`)
