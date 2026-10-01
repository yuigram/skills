#!/usr/bin/env node
// List what an entry point of the installed yuigram exports, or find which entry point
// exports a name.
//
//   node <skills>/using-yuigram/tools/list-exports.mjs                 entry points
//   node <skills>/using-yuigram/tools/list-exports.mjs yuigram/testing values one entry exports
//   node <skills>/using-yuigram/tools/list-exports.mjs --find mockBot  where a value comes from
//   ... [--from <project-dir>]
//
// Only runtime values are visible this way. Types and interfaces have no runtime form: a name
// that is not found may still be a type, and the compiler is what settles it.

import { entryPoints, load, locate, projectDir } from './_package.mjs'

const argv = process.argv.slice(2)
const from = projectDir(argv)
const found = locate(from)
if (found === undefined) {
  console.log(`yuigram is not installed in ${from}`)
  process.exit(2)
}

const entries = entryPoints(found)
const findAt = argv.indexOf('--find')

if (findAt !== -1) {
  const name = argv[findAt + 1]
  if (name === undefined) {
    console.log('usage: list-exports.mjs --find <name>')
    process.exit(2)
  }
  const where = []
  for (const entry of entries) {
    if (name in (await load(found, entry))) where.push(entry)
  }
  if (where.length === 0) {
    console.log(`'${name}' is not a runtime value of any entry point.`)
    console.log('It may be a type — import it with `import type` and let the compiler confirm it.')
    process.exit(1)
  }
  console.log(`'${name}' is exported by: ${where.join(', ')}`)
  process.exit(0)
}

const positional = argv.filter((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--from')
const entry = positional[0]

if (entry === undefined) {
  console.log(`yuigram ${found.manifest.version} — entry points:`)
  for (const name of entries) console.log(`  ${name}`)
  process.exit(0)
}

if (!entries.includes(entry)) {
  console.log(`'${entry}' is not an entry point of the installed yuigram. Entry points:`)
  for (const name of entries) console.log(`  ${name}`)
  process.exit(1)
}

const names = Object.keys(await load(found, entry)).sort()
console.log(`${entry}: ${names.length} runtime exports`)
for (const name of names) console.log(`  ${name}`)
