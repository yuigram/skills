#!/usr/bin/env node
// Write every TypeScript block in the skills to its own module, so they can be compiled against
// an installed yuigram.
//
//   node scripts/extract-examples.mjs <project-dir>/skill-examples
//
// The blocks are fragments in places: names such as `bot`, `account`, `message` or `keys` stand
// for objects made in an earlier block. Declare them in a `globals.d.ts` beside the output, for
// example `declare const bot: import('yuigram').Bot`, then run `tsc --noEmit` in a project that
// has yuigram (and @yuigram/sqlite for the storage examples, vitest for the test examples)
// installed.

import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = process.argv[2]
if (out === undefined) {
  console.log('usage: extract-examples.mjs <output-dir>')
  process.exit(2)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const markdown = (dir) =>
  readdirSync(dir).flatMap((name) => {
    if (name === '.git' || name === 'node_modules') return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdown(path) : path.endsWith('.md') ? [path] : []
  })

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

let count = 0
for (const path of markdown(root)) {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
  const stem = relative(root, path).replace(/[\\/]/g, '_').replace(/\.md$/, '')
  let index = 0
  for (const block of text.matchAll(/^```ts\n([\s\S]*?)^```/gm)) {
    index++
    count++
    const code = block[1]
    const module = /^\s*(import|export)\s/m.test(code) ? code : `${code}\nexport {}\n`
    writeFileSync(join(out, `${stem}_${index}.ts`), module)
  }
}

console.log(`${count} examples written to ${out}`)
