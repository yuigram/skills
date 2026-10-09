#!/usr/bin/env node
// SPDX-License-Identifier: MIT

// Say whether the yuigram a project has installed offers what these skills rely on.
//
//   node <skills>/using-yuigram/tools/check-version.mjs [--from <project-dir>]
//
// Four separate things are reported, because they answer different questions:
//
//   tested source     the Yuigram revision the skills were written and checked against
//   installed         the package version the project resolves
//   capabilities      whether the installed package reports the same Bot API release and
//                     TL layer and exports every name the skills require
//   provenance        whether the installed package says which source revision it was built
//                     from; when it does not, the exact revision cannot be established
//
// Exits 0 when the required capabilities are detected, 1 when they are not, and 2 when yuigram
// is not installed. Exit 0 does not mean the installed package is the tested revision.

import { load, locate, pin, projectDir } from './_package.mjs'

const from = projectDir()
const found = locate(from)
if (found === undefined) {
  console.log(`installed:     yuigram is not installed in ${from}`)
  console.log('               install it (npm install yuigram), or pass --from <project-dir>')
  process.exit(2)
}

const expected = pin()
const main = await load(found, 'yuigram')
const problems = []

const botApi = main.schemaInfo?.botApi
const tlLayer = main.schemaInfo?.tlLayer
const required = expected.requires ?? []
const missing = required.filter((name) => !(name in main))

console.log(
  `tested source: yuigram revision ${expected.tested_revision} ` +
    `(version string ${expected.tested_package_version}, Bot API ${expected.bot_api}, TL layer ${expected.tl_layer})`,
)
console.log(`installed:     yuigram ${found.manifest.version} at ${found.dir}`)
console.log(`reports:       Bot API ${botApi ?? 'unknown'}, TL layer ${tlLayer ?? 'unknown'}`)

if (String(botApi) !== expected.bot_api) {
  problems.push(`it was generated from Bot API ${botApi ?? 'unknown'}, not ${expected.bot_api}`)
}
if (String(tlLayer) !== expected.tl_layer) {
  problems.push(`it speaks TL layer ${tlLayer ?? 'unknown'}, not ${expected.tl_layer}`)
}
if (missing.length > 0) {
  problems.push(`it does not export ${missing.join(', ')}`)
}

console.log(
  `capabilities:  ${problems.length === 0 ? 'detected' : 'not detected'} ` +
    `(required: ${required.join(', ')})`,
)

// npm records the commit a package was published from as `gitHead` when it knows it. Nothing
// else is consulted: a source checkout's own history is not the installed package.
const recorded = typeof found.manifest.gitHead === 'string' ? found.manifest.gitHead : undefined
if (recorded === undefined) {
  console.log('provenance:    unknown — the package records no source revision, so it cannot')
  console.log('               be confirmed as the tested revision')
} else if (recorded === expected.tested_revision) {
  console.log(`provenance:    built from ${recorded}, the tested revision`)
} else {
  console.log(`provenance:    built from ${recorded}, not the tested revision`)
}

if (problems.length === 0) {
  console.log('result:        required capabilities detected')
  process.exit(0)
}

console.log('result:        required capabilities not detected')
for (const problem of problems) console.log(`  - ${problem}`)
console.log('These skills describe a different surface from the one installed. Confirm each API')
console.log('against the installed declarations (list-exports.mjs, and the TypeScript compiler)')
console.log('before relying on the notes.')
process.exit(1)
