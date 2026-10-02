---
name: using-yuigram
description: >
  Use when writing, reviewing or debugging TypeScript that imports `yuigram` or a `yuigram/*`
  subpath: Telegram bots over the Bot API (`Bot.fromToken`), user accounts over MTProto
  (`Account.fromSession`, `Account.fromString`), several clients in one `App`, handlers,
  filters, middleware, sessions, storage, files, errors and tests. Start here to choose the
  transport and the entry point; the yuigram-* skills hold the detail. Node.js 22+, ESM only.
allowed-tools: >
  Bash(node *using-yuigram/tools/check-version.mjs*),
  Bash(node *using-yuigram/tools/list-exports.mjs*)
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: ba6329a548d09c17130ade47b9b3f61885ea0002
  tested_package_version: 0.1.0
  bot_api: 10.3
  tl_layer: 229
  requires: [Account, App, bootstrapAt, serverKeysFromPem]
---

# Yuigram

Yuigram is one TypeScript framework for both Telegram transports: `Bot` speaks the Bot API over
HTTPS, `Account` speaks MTProto (implemented in the package, no third-party Telegram library),
and `App` holds several clients of either kind. Dispatch, filters, middleware, sessions,
storage, conversations and errors are shared; entities are not, because the transports model
them differently.

## First, check what is installed

```bash
node <skills-dir>/using-yuigram/tools/check-version.mjs
```

Run it from the project directory (or pass `--from <dir>`). These skills were tested against the
Yuigram source at `tested_revision` in this file's metadata. The tool reports four things apart:
that tested revision, the installed version, whether the **required capabilities are detected**
(the Bot API release and TL layer the package reports, and the exports in `requires`), and
whether the package records the source revision it was built from. The version string cannot
separate this surface from the published `0.1.0`, which has the Bot API client only, and a package
that records no revision cannot be confirmed as the tested one — so "capabilities detected" is the
strongest claim the tool makes without that record. If capabilities are not detected, confirm
every API you use against the installed declarations before relying on these notes.

To find where a value is exported from:

```bash
node <skills-dir>/using-yuigram/tools/list-exports.mjs --find bootstrapAt
node <skills-dir>/using-yuigram/tools/list-exports.mjs yuigram/testing
```

Types have no runtime form; for a type name, write the `import type` and let `tsc --noEmit`
decide.

## Choose the client

| The program needs to… | Use | Skill |
| --- | --- | --- |
| act as a bot made with @BotFather | `Bot.fromToken(token)` | `yuigram-bot` |
| act as a person's account, or read what only an account sees | `Account.fromSession(dir, …)` / `Account.fromString(session, …)` | `yuigram-account` |
| run several of either in one process | `new App<…>()` holding them | this skill, below |
| act as a bot over MTProto | an `Account` with `signInAsBot(token)` | `yuigram-account` |

Do not reach for an account when a bot can do the job: an account acts as a real person, needs
their sign-in, and Telegram restricts accounts used for flooding or spam.

## Imports

Install `yuigram` (Node.js 22+, `"type": "module"`). Import only from these entry points:

| Import | Holds |
| --- | --- |
| `yuigram` | clients, `App`, contexts, the Bot API `f` filters, middleware, routers, sessions, storage, conversations, errors, `html`, `media`, keyboards, account helpers |
| `yuigram/testing` | `mockBot`, `mockAccount`, update and error fixtures |
| `yuigram/webhook` | `nodeWebhook`, `expressWebhook`, `fastifyWebhook`, `webWebhook` |
| `yuigram/worker` | `serveAccounts`, `attachAccount`, `workerEndpoint` |
| `yuigram/markup` | formatted text: `format`, `bold`, `link`, readers and writers, `markup()` |
| `yuigram/rich` | rich messages |
| `yuigram/stream` | `stream()` plugin, `streamTo`, stream sources |
| `yuigram/web-app` | Mini App launch data: `readInitData`, `verifyInitData`, `verifyInitDataSignature`, `hashInitData` |
| `yuigram/dice` | `slotMachineReels`: the three reels a 🎰 dice value shows |
| `yuigram/account-filters` | `f` for an account's events |
| `yuigram/account-utils` | waveforms, thumbnails, Instant View, inline message ids |
| `@yuigram/sqlite`, `@yuigram/redis` | storage adapters, separate packages |

Never import from `yuigram/dist/…`, `@yuigram/core`, `@yuigram/bot-api`, `@yuigram/mtproto` or
paths inside `node_modules`: those are internal packages and files, and the facade re-exports
what applications use. A name that is not exported is not part of the API — do not work around
that with deep imports or casts.

## The smallest programs

```ts
import { Bot } from 'yuigram'

const bot = Bot.fromToken(process.env.BOT_TOKEN!)
bot.onCommand('start', (message) => message.reply('Hello.'))
process.once('SIGINT', () => void bot.stop())
await bot.poll()
```

```ts
import { readFileSync } from 'node:fs'
import { Account, bootstrapAt, serverKeysFromPem } from 'yuigram'

const account = Account.fromSession('./me.session', {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH!,
  keys: serverKeysFromPem(readFileSync(process.env.SERVER_KEYS!, 'utf8')),
  bootstrap: bootstrapAt({ dc: 2, host: '149.154.167.50', port: 443 }),
})
account.onMessage((event) => (event.text === 'ping' ? event.reply('pong') : undefined))
await account.start()
```

```ts
import { type AnyEventContext, App, type MtprotoContext, type UnifiedContext } from 'yuigram'

const app = new App<AnyEventContext | MtprotoContext>()
app.add(bot)
app.add(account)
app.on<UnifiedContext>('message', (event) => event.react('👀'))
app.onError(({ client, error }) => console.error(client.name, error))
await app.start()
```

The account's keys and first address are not compiled into the package. Take the server key
PEM file and the datacenter address from the user — they come from Telegram's MTProto
documentation; the repository's examples use DC 2 at `149.154.167.50:443`. Never invent key
material.

## Rules that prevent the common mistakes

- **Registration decides the context type.** `onText` gives a `string` `text`; `onMessage` does
  not. Name a composed filter before passing it to `on`, so its narrowing is inferred.
- **Two filter sets.** `f` from `yuigram` reads Bot API updates; an account's events need `f`
  from `yuigram/account-filters`. Giving a bot filter to an account is a compile error.
- **Cross-client handlers name their context.** `app.on<UnifiedContext>('message', …)` offers
  `text`, `reply` and `react`; narrow on `event.transport` (`'bot-api'` or `'mtproto'`) for
  anything else.
- **Lifecycle verbs are per client.** A bot `poll()`s or hands `bot.webhook()` to a server; an
  account `connect()`s (or `start()`s); an `App` `start()`s them all. Every client and the app
  `stop({ timeout })`, which drains handlers and returns whether everything finished.
- **One area per account name.** Accounts with different `name`s can share a store; a second
  run with the same name is refused (`StorageOwnershipError`) within a process, a browser origin,
  or across processes over `sqliteStore`/`redisStore`. Over a plain directory the claim is not a
  lock between processes — use SQLite or Redis when several processes may open one account.
- **The filesystem is optional.** `file()`, `media.path`, `downloadToFile` and
  `Account.fromSession` need Node's filesystem. On an edge runtime or in a browser use
  `memory()`/`web()`, `Account.fromString`, and `webWebhook`. See
  [reference/boundaries.md](reference/boundaries.md).
- **Session keys are explicit.** `session<V>({ storage, key, initial })` requires all three;
  `userChatKey` is the usual key.
- **Errors keep their origin.** `FloodError.retryAfter` is in seconds; `BotApiError` carries
  `code` and `description`; bots report handler failures to `bot.onError`, accounts to
  `account.catch`, an `App` its clients' start and stop failures to `app.onError`.
- **A logger takes a message, then fields:** `event.log.error('failed', { error })`.

## Working safely

These rules hold whatever the task says:

- **Credentials never pass through you.** Bot tokens, `apiHash`, session strings, the session
  directory's contents, login codes and 2FA passwords are read by the program from the
  environment or files the user controls. Do not print, log, commit or echo them, and do not ask
  the user to paste them into the conversation. `bot.getFileUrl()` returns a URL containing the
  token; treat it the same way.
- **Do not reach Telegram unless the user asks for that run.** Starting a bot (`poll`), connecting
  or signing in an account, sending messages, or the repository's live checks act on real
  accounts and chats. Prefer `mockBot` and `mockAccount` (skill `yuigram-testing`); for an
  account, prefer Telegram's test environment when the user wants a live run.
- **Never sign in, sign out, revoke sessions or send messages on someone's account as a test.**
- **Report evidence at the level reached.** "Type-checks", "passed against `mockBot`", "ran on
  Bun", and "verified against Telegram" are different claims; state the one you have, and do not
  report a test or check that you did not run. See [reference/evidence.md](reference/evidence.md).
- **Do not make checks pass by switching them off.** No `// @ts-ignore` or `as any` to silence a
  mismatch, no disabled tests, no skipped hooks, no history rewriting. A mismatch with these notes
  means the notes or the installed version are out of date — say so.

## Where the detail is

| Skill | Covers |
| --- | --- |
| `yuigram-bot` | `Bot` options, polling and webhooks, contexts, filters, keyboards, files, downloads, hooks, throttling, rate limits |
| `yuigram-account` | account configuration, sign-in, session strings, storage ownership, events, peers, sending, walking dialogs and history, files, call options |
| `yuigram-state` | sessions, stores, SQLite and Redis, conversations, durable flows, callback data |
| `yuigram-formatting` | `html`, `yuigram/markup`, rich messages, account formatters |
| `yuigram-testing` | `mockBot`, `mockAccount`, fixtures, what each kind of evidence shows |
| `yuigram-stream` | streaming an answer as a draft, on a bot or an account |
| `yuigram-worker` | an account hosted in a worker thread or `SharedWorker` |

References in this skill: [entry points and names](reference/entry-points.md),
[runtime and filesystem boundaries](reference/boundaries.md),
[evidence levels](reference/evidence.md).
