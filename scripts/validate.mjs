#!/usr/bin/env node
// Check the repository's structure: every skill has a SKILL.md whose frontmatter names it,
// says when to use it, and pins the same Yuigram revision; tools a skill allows exist;
// relative links resolve; no file carries a machine-specific path.
//
//   node scripts/validate.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const fail = (file, message) => problems.push(`${relative(root, file) || '.'}: ${message}`)

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === '.git' || name === 'node_modules') return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function frontmatter(path) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'))
  if (match === null) return undefined
  const fields = {}
  let current
  for (const line of match[1].split('\n')) {
    const top = /^([a-z-]+):\s*(.*)$/.exec(line)
    if (top !== null) {
      current = top[1]
      fields[current] = top[2] === '>' ? '' : top[2]
      continue
    }
    if (current !== undefined) fields[current] = `${fields[current]} ${line.trim()}`.trim()
  }
  return fields
}

const skills = readdirSync(root).filter((name) => existsSync(join(root, name, 'SKILL.md')))
if (skills.length === 0) fail(root, 'no skills found')

const revisions = new Set()
for (const skill of skills) {
  const path = join(root, skill, 'SKILL.md')
  const fields = frontmatter(path)
  if (fields === undefined) {
    fail(path, 'no frontmatter')
    continue
  }
  if (fields.name !== skill) fail(path, `name '${fields.name}' does not match the directory '${skill}'`)
  if (!/^Use when /.test(fields.description ?? '')) fail(path, "description does not begin 'Use when'")
  const revision = /tested_revision:\s*([0-9a-f]{40})/.exec(fields.metadata ?? '')?.[1]
  if (revision === undefined) fail(path, 'metadata has no 40-character tested_revision')
  else revisions.add(revision)
  for (const tool of (fields['allowed-tools'] ?? '').matchAll(/node \*([^*]+)\*/g)) {
    if (!existsSync(join(root, tool[1]))) fail(path, `allowed tool '${tool[1]}' does not exist`)
  }
}
if (revisions.size > 1) fail(root, `skills pin different revisions: ${[...revisions].join(', ')}`)

const readme = readFileSync(join(root, 'README.md'), 'utf8')
for (const skill of skills) {
  if (!readme.includes(`[${skill}](${skill})`)) fail(join(root, 'README.md'), `does not list '${skill}'`)
}

for (const path of files(root)) {
  const text = readFileSync(path, 'utf8')
  if (/[A-Za-z]:\\Users\\|\/Users\/[a-z]|\/home\/[a-z]/.test(text)) fail(path, 'contains a machine-specific path')
  if (!path.endsWith('.md')) continue
  for (const link of text.replace(/```[\s\S]*?```/g, '').matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = link[1]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    if (!existsSync(resolve(dirname(path), target.split('#')[0]))) fail(path, `broken link '${target}'`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.log(problem)
  process.exit(1)
}
console.log(`${skills.length} skills, structure valid`)
