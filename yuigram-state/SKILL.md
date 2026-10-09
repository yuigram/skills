---
name: yuigram-state
description: >
  Use when a Yuigram bot or account keeps state between updates: `session()` with
  `SessionFlavor`, `userChatKey` and custom keys, `createSession`, the `KV` contract and the
  stores (`memory`, `file`, `encrypted`, `web`, `namespaced`, `tiered`, `@yuigram/sqlite`,
  `@yuigram/redis`), conversations (`conversation` scenes, `conversation.wait`, durable flows
  with `defineFlow`, `flow.ask`, `flow.effect`), typed callback data (`defineCallbackData`,
  `pager`), and shared counters (`limiter`). Not for an account's own authorization storage —
  that is `yuigram-account`.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: 9e90bf76629c12f69fcfd313409cbf6cfcce24b8
---

# State in Yuigram

Framework state (a cart, a form's step) and an account's authorization (its signed-in key) are
different things in different stores. This skill is the first. Never put framework state in an
account's store or the reverse.

## Sessions

```ts
import { Bot, file, type SessionFlavor, session, userChatKey } from 'yuigram'

interface Cart {
  items: string[]
}

const bot = Bot.fromToken<SessionFlavor<Cart>>(process.env.BOT_TOKEN!).extend(
  session<Cart>({ storage: file('./sessions'), key: userChatKey, initial: () => ({ items: [] }) }),
)

bot.onMessage(async (message) => {
  message.session.items.push(message.text ?? '')
  await message.reply(`${message.session.items.length} items`)
})
```

- The type rides on the client's type parameter: `Bot.fromToken<SessionFlavor<Cart>>`. Do not use
  declaration merging; there is no global session type.
- `storage`, `key` and `initial` are required. `key` decides whose state it is:
  `userChatKey` (a user in one chat — the usual choice), `(event) => event.sender?.id` (a user
  everywhere), `(event) => event.chat?.id` (a chat). Return `undefined` to skip loading; a
  `bigint` is written in full. A key that needs more of the update uses
  `createSession<Context, Value>` with the context stated.
- Mutating in place marks the session dirty; it is written when the handlers finish. Read-only
  updates write nothing. Updates with the same key run one at a time.
- `ttl` (seconds), `commit: 'success'` to write only after handlers succeed, `property` to use
  another name than `session`. `message.sessionHandle` exposes `dirty`, `isNew`, `set`, `merge`,
  `touch`, `save`.

## Stores

`KV` is `get`, `set`, `delete` (with optional `has`, `clear`, `keys`), all async.

| Store | Use |
| --- | --- |
| `memory()` | tests, development, state that should not survive the process |
| `file(dir)` | one process with a disk |
| `encrypted(stringStore, secret)` | values encrypted at rest (secret from the environment) |
| `web()` | a browser page |
| `indexedDb({ database })` from `yuigram/indexeddb` | a browser page or worker with more state than `localStorage` holds |
| `namespaced(store, 'prefix:')` | an area of a shared store |
| `tiered(front, back)` | a fast layer over a slow one |
| `sqliteStore(db, { table })` from `@yuigram/sqlite` | several processes on one machine |
| `redisStore(client, { namespace })` from `@yuigram/redis` | several machines |

```ts
import { openDatabase, sqliteStore } from '@yuigram/sqlite'

const database = await openDatabase('./bot.db')
const carts = sqliteStore<Cart>(database, { table: 'carts' })
```

```ts
import { indexedDb } from 'yuigram/indexeddb'

const browserState = indexedDb<Cart>({ database: 'my-app' })
await browserState.set('cart', { items: [] })
await browserState.close()
```

A write to `indexedDb()` resolves when its transaction completes; a failed one rejects with
`StorageError`. It does not keep two tabs from running one account — Web Locks do that, as for
`web()`.

The adapters install no driver: SQLite takes a `node:sqlite`, `better-sqlite3` or `bun:sqlite`
connection (`openDatabase` uses Node's own), Redis sends commands through the application's
client. Never put a store's credentials in code.

## Conversations

```ts
import {
  Bot,
  type ConversationFlavour,
  conversation,
  type MessageContext,
  memory,
  type ScenePosition,
} from 'yuigram'

interface Signup {
  name?: string
}
type Step = MessageContext & ConversationFlavour<Signup>

const signupBot = Bot.fromToken<ConversationFlavour<Signup>>(process.env.BOT_TOKEN!)
const conversations = conversation<Step, Signup>({
  storage: memory<ScenePosition<Signup>>(),
  scenes: [
    {
      name: 'signup',
      initial: () => ({}),
      steps: [
        async (message, scene) => {
          if (scene.fresh) return void (await message.reply('Your name?'))
          scene.state.name = message.text
          scene.next()
        },
        async (message, scene) => {
          await message.reply(`Hello, ${scene.state.name}.`)
          scene.leave()
        },
      ],
    },
  ],
})
signupBot.extend(conversations)
signupBot.onCommand('start', (message) => message.conversation.enter('signup'))
```

- A scene's steps receive the same person's next message; `scene.fresh` marks the first call of
  a step. `scene.next()`, `scene.leave()`, `scene.cancel()`; `beforeStep` and `onLeave` hooks.
  `scope` is `'chat+user'` by default (`'chat'`, `'user'`, `'chat+topic'` exist).
- `message.conversation.wait({ match, transform, validate, onInvalid, timeout, nullOnTimeout })`
  waits for the next matching message inline. Waits live in memory and are cancelled when the
  client stops.
- Durable flows (`defineFlow`, `flow.ask(id, prompt, options)`, `flow.effect(id, fn)`) survive a
  restart: give `conversation({ flows: { storage, define: [flow] } })` a persistent store, call
  `controls.flows.resume()` at start and `controls.flows.shutdown()` before stopping. Wrap every
  side effect in `flow.effect` so a resumed flow does not repeat it; an effect whose outcome is
  unknown raises `EffectUncertainError`.
- The same plugin installs on an `Account`.

## Callback data

```ts
import { defineCallbackData, InlineKeyboard } from 'yuigram'

const add = defineCallbackData('add').literal('item', ['tea', 'coffee']).number('count')
const keyboard = new InlineKeyboard().add(add.button('Tea', { item: 'tea', count: 1 }))

bot.onCallbackQuery(async (query) => {
  const pressed = query.data === undefined ? undefined : add.unpack(query.data)
  if (pressed === undefined) return
  await query.answer(`${pressed.item} × ${pressed.count}`)
})
```

Fields: `string`, `number`, `boolean`, `literal`. `unpack` returns `undefined` for data from
another schema or an older release — buttons outlive deployments, so handle it. The packed data
must fit Telegram's 64 bytes. `pager(name, { pageSize })` pages a list with buttons and refuses
presses from someone else. On an account, `f.callbackData(schema, fields)` from
`yuigram/account-filters` selects presses.
