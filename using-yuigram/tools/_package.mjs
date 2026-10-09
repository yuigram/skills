// SPDX-License-Identifier: MIT

// Shared by the tools in this directory: find the `yuigram` a project has installed, load one
// of its entry points, and read the compatibility pin from this skill's SKILL.md.
//
// Nothing here reaches the network, reads credentials or writes anything.

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The project directory: `--from <dir>` if given, otherwise the working directory. */
export function projectDir(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--from')
  return resolve(at === -1 ? process.cwd() : (argv[at + 1] ?? process.cwd()))
}

/**
 * The installed package, resolved the way the project would resolve it.
 *
 * Returns the package directory and its manifest, or `undefined` when the project does not
 * have `yuigram` installed.
 */
export function locate(from) {
  const require = createRequire(join(from, 'noop.js'))
  let entry
  try {
    entry = require.resolve('yuigram')
  } catch {
    return undefined
  }

  for (let dir = dirname(entry); ; dir = dirname(dir)) {
    const path = join(dir, 'package.json')
    if (existsSync(path)) {
      const manifest = JSON.parse(readFileSync(path, 'utf8'))
      if (manifest.name === 'yuigram') return { dir, manifest }
    }
    if (dirname(dir) === dir) return undefined
  }
}

/** The entry points the installed package declares, as `yuigram` and `yuigram/<subpath>`. */
export function entryPoints(found) {
  return Object.keys(found.manifest.exports ?? { '.': {} }).map((key) =>
    key === '.' ? 'yuigram' : `yuigram/${key.slice(2)}`,
  )
}

/** Load one entry point of the installed package. */
export async function load(found, specifier) {
  const key = specifier === 'yuigram' ? '.' : `./${specifier.slice('yuigram/'.length)}`
  const target = found.manifest.exports?.[key]
  const file = typeof target === 'string' ? target : (target?.import ?? target?.default)
  if (file === undefined) throw new Error(`the installed yuigram has no entry point '${specifier}'`)
  return await import(pathToFileURL(join(found.dir, file)).href)
}

/** The `metadata` block of this skill's SKILL.md frontmatter, as flat strings and lists. */
export function pin() {
  const skill = join(dirname(fileURLToPath(import.meta.url)), '..', 'SKILL.md')
  // A checkout may have turned line endings into CRLF; the frontmatter is read either way.
  const text = readFileSync(skill, 'utf8').replace(/\r\n/g, '\n')
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? ''
  const block = /^metadata:\n((?:[ ]{2}.*\n?)*)/m.exec(frontmatter)?.[1] ?? ''
  const values = {}
  for (const line of block.split('\n')) {
    const match = /^ {2}([a-z_]+):\s*(.*)$/.exec(line)
    if (match === null) continue
    const raw = match[2].trim().replace(/^['"]|['"]$/g, '')
    values[match[1]] = raw.startsWith('[') ? raw.slice(1, -1).split(',').map((v) => v.trim()) : raw
  }
  return values
}
