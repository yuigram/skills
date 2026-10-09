# Yuigram skills

English · [Русский](README.ru.md)

Skills for coding agents that write, review or debug code built on
[Yuigram](https://github.com/yuigram/yuigram), the TypeScript framework for the Telegram Bot API
and MTProto. Each skill is a directory with a `SKILL.md`: a short description that tells an agent
when to load it, instructions, and focused reference files it opens only when needed.

> **Status: local.** This repository is not published yet. It is intended to live at
> `https://github.com/yuigram/skills`; until then, install it from a local copy as described below.

## Skills

| Skill | Use it for |
| --- | --- |
| [using-yuigram](using-yuigram) | The entry point: choosing a client and an entry point, imports, safety rules, evidence levels. Holds the version check and export lookup tools. |
| [yuigram-bot](yuigram-bot) | Bots over the Bot API: construction, polling and webhooks, contexts, filters, routers, keyboards, files, limits and retries. |
| [yuigram-account](yuigram-account) | Accounts over MTProto: configuration, sign-in, session strings, storage ownership, events, peers, sending, lists, files, call options. |
| [yuigram-state](yuigram-state) | Sessions, stores, SQLite and Redis, conversations and durable flows, callback data. |
| [yuigram-formatting](yuigram-formatting) | `html` with `parse_mode`, formatted values from `yuigram/markup`, rich messages, account formatters. |
| [yuigram-testing](yuigram-testing) | `mockBot`, `mockAccount`, fixtures, and how to report what a test shows. |
| [yuigram-stream](yuigram-stream) | Streaming an answer as a draft, on a bot or an account. |
| [yuigram-worker](yuigram-worker) | An account hosted in a worker and driven from another thread. |

## Compatibility

The skills were tested against the Yuigram source at revision
`1f8412259861b10511f1726ea667ec4c7a0824df` (Bot API 10.3, TL layer 229) — the surface with
`Account`, `App` and `bootstrapAt`, prepared as version `1.0.0` and not published yet; npm's
`yuigram@0.1.0` is the Bot API client alone. A version string does not identify a source
revision, so an installation is checked by what it reports and exports, not by its version:

```bash
node <skills-dir>/using-yuigram/tools/check-version.mjs
```

Run it from a project with `yuigram` installed (or pass `--from <project-dir>`). It prints four
things separately — the tested source revision, the installed version, whether the required
capabilities are detected, and the package's provenance — and exits `0` when the required
capabilities are detected, `1` when they are not (the skills then describe a different surface),
and `2` when `yuigram` is not installed. Exit `0` does not establish that the installation *is* the
tested revision: packed and published packages record no source revision today, so provenance is
reported as unknown unless the package's manifest carries one (`gitHead`). `list-exports.mjs` lists an entry point's
runtime exports or finds where a name is exported. Both tools need Node.js 22, read only the
installed package, and make no network requests.

## Installation

Agents load skills from a skills directory; which one depends on the agent — see its
documentation. Copy or link the skill directories there from your local copy of this repository:

```bash
cp -R /path/to/yuigram-skills/using-yuigram /path/to/yuigram-skills/yuigram-* <skills-dir>/
```

Linking keeps them current with the local copy:

```bash
for skill in /path/to/yuigram-skills/using-yuigram /path/to/yuigram-skills/yuigram-*; do ln -s "$skill" <skills-dir>/; done
```

On Windows, `Copy-Item -Recurse` in PowerShell does the same as `cp -R`. Install the skills
together: the focused skills refer to `using-yuigram` for imports and safety rules.

**Once the repository is published** (not yet available), the copy will come from a clone instead:

```bash
git clone https://github.com/yuigram/skills yuigram-skills
```

## What the skills tell an agent

- Import only from `yuigram`, its declared subpaths, `@yuigram/sqlite` and `@yuigram/redis` —
  never from internal packages or files.
- Keep tokens, API hashes, session strings, login codes and passwords out of output, logs, commits
  and conversations; programs read them from the environment.
- Do not connect to Telegram, sign in, or send messages unless the user asks for that run; test
  with the mock clients instead.
- Report checks at the level actually reached — type-checked, mock run, runtime run, live run — and
  never report one that did not happen. Do not silence a failure to make it pass.

## Language

Instructions are written in English: the language of Yuigram's identifiers, documentation and
error messages, and the convention skill collections follow, so an agent reads one vocabulary in
the skill and in the code. Agents use them whatever language the conversation is in. This
introduction is also available [in Russian](README.ru.md).

## Maintaining

When Yuigram changes, update `tested_revision` (and `tested_package_version`, `bot_api`,
`tl_layer`, `requires`) in every `SKILL.md` that has them, then check the repository:

```bash
node scripts/validate.mjs
node scripts/extract-examples.mjs <project-with-yuigram>/skill-examples
```

`validate.mjs` checks the structure: names, descriptions, the shared pin, the tools each skill
allows, links. `extract-examples.mjs` writes every TypeScript example to its own module; compile
them with `tsc --noEmit` in a project where `yuigram` is installed, declaring the names that
fragments assume as the script's header describes. An example that no longer compiles is a skill
that is out of date.

## Licence

[MIT](LICENSE).
