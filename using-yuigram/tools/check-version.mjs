#!/usr/bin/env node
// Compare the yuigram a project has installed with the surface these skills were written
// against. Exits 0 when they agree, 1 when they do not, 2 when yuigram is not installed.
//
//   node <skills>/using-yuigram/tools/check-version.mjs [--from <project-dir>]
//
// The version string alone cannot tell the two apart: the surface these skills describe was
// built while the manifests still said 0.1.0, and the published 0.1.0 is the Bot API client
// without accounts. So the check reads what the package reports about itself — the Bot API
// release and TL layer it was generated from — and looks for exports that only the newer
// surface has.

import { load, locate, pin, projectDir } from './_package.mjs'

const from = projectDir()
const found = locate(from)
if (found === undefined) {
  console.log(`yuigram is not installed in ${from}`)
  console.log('install it (npm install yuigram), or pass --from <project-dir>')
  process.exit(2)
}

const expected = pin()
const main = await load(found, 'yuigram')
const problems = []

console.log(`installed: yuigram ${found.manifest.version} at ${found.dir}`)
console.log(
  `skills:    written against yuigram revision ${expected.yuigram_revision} ` +
    `(Bot API ${expected.bot_api}, TL layer ${expected.tl_layer})`,
)

const botApi = main.schemaInfo?.botApi
const tlLayer = main.schemaInfo?.tlLayer
console.log(`reported:  Bot API ${botApi ?? 'unknown'}, TL layer ${tlLayer ?? 'unknown'}`)

if (String(botApi) !== expected.bot_api) {
  problems.push(`the installed package was generated from Bot API ${botApi}, not ${expected.bot_api}`)
}
if (String(tlLayer) !== expected.tl_layer) {
  problems.push(`the installed package speaks TL layer ${tlLayer}, not ${expected.tl_layer}`)
}

const missing = (expected.requires ?? []).filter((name) => !(name in main))
if (missing.length > 0) {
  problems.push(
    `the installed package does not export ${missing.join(', ')}; it predates the surface ` +
      'these skills describe (the published 0.1.0, for one, has no Account or App)',
  )
}

if (problems.length === 0) {
  console.log('result:    compatible')
  process.exit(0)
}

console.log('result:    differs')
for (const problem of problems) console.log(`  - ${problem}`)
console.log('Treat the skills as possibly out of date: confirm each API against the installed')
console.log('declarations (list-exports.mjs, and the TypeScript compiler) before relying on it.')
process.exit(1)
