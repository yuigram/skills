# Bot recipes

Short, checked patterns for tasks that come up repeatedly. `bot` is a `Bot`, `message` a
`MessageContext`.

## Per-method defaults

```ts
import { Bot, type MethodDefaults } from 'yuigram'

const defaults: MethodDefaults = {
  '*': { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  sendDocument: { disable_notification: true },
}
const quiet = Bot.fromToken(process.env.BOT_TOKEN!, { defaults })
```

`'*'` applies only to methods that take the parameter. What a call passes wins, including
`false`, `null` and `undefined`.

## Cancelling a call

```ts
const controller = new AbortController()
setTimeout(() => controller.abort(), 5_000)
await bot.api.sendMessage({ chat_id: 1, text: 'hi' }, { signal: controller.signal })
```

## Ending middleware early

```ts
import type { AnyEventContext, Middleware } from 'yuigram'

const ignoreBots: Middleware<AnyEventContext> = async (event, next) => {
  if ('sender' in event && event.sender?.is_bot === true) return
  await next()
}
bot.use(ignoreBots)
```

## An event of the application's own

```ts
import { defineEvent } from 'yuigram'

const orderPaid = defineEvent<{ readonly orderId: string }>('order_paid')
bot.on(orderPaid, (event) => event.log.info('paid', { order: event.payload.orderId }))
await bot.emit(orderPaid, { orderId: 'A-17' })
```

It runs through the bot's middleware and handlers like an update — the place for a payment
provider's webhook to hand an order to the bot.

## A plugin

```ts
import { definePlugin, type MiddlewareHost } from 'yuigram'

export function metrics() {
  let handled = 0
  return {
    plugin: definePlugin({
      name: 'metrics',
      install(target: MiddlewareHost) {
        target.use(async (_event, next) => {
          handled++
          await next()
        })
      },
    }),
    get handled() {
      return handled
    },
  }
}

const counter = metrics()
bot.extend(counter.plugin)
```

A plugin is installed on the dispatch path, before the first update reaches a handler, so what
`install` returns is not a property of the bot; keep readable state where the plugin was made.
Declaring `MiddlewareHost` as the target lets it install on a `Router` too.

## Inbound limits shared between processes

```ts
import { openDatabase, sqliteCounter } from '@yuigram/sqlite'
import { limiter } from 'yuigram'

const limits = limiter({ counter: sqliteCounter(await openDatabase('./bot.db')) })
bot.use(limits.middleware({ limit: 20, windowMs: 60_000 }))
```

`redisCounter` from `@yuigram/redis` does the same across machines.

## A local Bot API server

```ts
import { Bot } from 'yuigram'

const local = Bot.fromToken(process.env.BOT_TOKEN!, { baseUrl: 'http://127.0.0.1:8081', local: true })
```

A local server's files are paths on its disk, so read them with the `download` function given
`local.files`, not with the bot's own `download` method, which says so if asked.

## Inline mode

```ts
import { inline } from 'yuigram'

bot.on('inline_query', (query) =>
  query.answerInlineQuery({
    results: [
      inline.article('Yuigram', { message_text: 'A Telegram framework' }),
      inline.photo('https://example.com/cat.jpg', { caption: 'a cat' }),
    ],
  }),
)
```

The `inline` builders fill in each result's `type` and a unique `id`; `inline.cached.*` builds
results from files Telegram already holds, and `inline.button` the control above the results.
Inline queries reach a bot only when inline mode is enabled for it in @BotFather.

## Uploading a file once

```ts
import { openDatabase, sqliteStore } from '@yuigram/sqlite'
import { media, mediaCache } from 'yuigram'

const cache = mediaCache({ storage: sqliteStore<string>(await openDatabase('./bot.db'), { table: 'media' }) })
bot.extend(cache)

bot.onCommand('logo', async (message) => {
  await message.sendPhoto({ photo: media.path('./logo.png') })   // uploaded the first time, then sent by identifier
})
```

The cache keys a file by the bot, the media kind and its source (path, URL, content digest, or a
`cacheKey` the caller gives). A cached identifier Telegram refuses is dropped and the original
file sent once more; nothing is cached from a failed call. Two sends of the same file at once
upload it once.

## Links a bot hands out

`writeLink` writes a `t.me` link in the form Telegram publishes, and `readLink` reads one back
from any of its hosts (`t.me`, `telegram.me`, `telegram.dog`, `tg:`); both are pure and come from
`yuigram`. A link that breaks Telegram's rules is a `LinkError` when written; when read, a
malformed value is passed over, and text that is no Telegram link reads as `undefined`.

```ts
import { LinkError, readLink, writeLink } from 'yuigram'

writeLink({ kind: 'bot-start', bot: 'shop_bot', payload: 'ref_42' })
// 'https://t.me/shop_bot?start=ref_42'
writeLink({ kind: 'group-bot', bot: 'shop_bot', admin: ['delete_messages', 'pin_messages'] })
// 'https://t.me/shop_bot?startgroup&admin=delete_messages+pin_messages'
writeLink({ kind: 'mini-app', bot: 'shop_bot', payload: 'cart', mode: 'compact' })
// 'https://t.me/shop_bot?startapp=cart&mode=compact'

const link = readLink('https://t.me/shop_bot?start=ref_42')
if (link?.kind === 'bot-start') console.log(link.bot, link.payload)

try {
  writeLink({ kind: 'bot-start', bot: 'shop_bot', payload: 'has space' })
} catch (error) {
  if (!(error instanceof LinkError)) throw error // a start parameter is 1–64 base64url characters
}
```

The start parameter comes back to the bot as the text after `/start`:
`bot.onCommand('start', (message) => …message.command.rest…)`. It is whatever the person's link
said, so treat it as untrusted input. Other kinds: `channel-bot` (needs at least one right),
`attach`, `attach-in-chat`, `game`, `username`, `share`, `invite`, `message`, `phone`.

## Mini App launch data

A Mini App sends `Telegram.WebApp.initData` to the server; `yuigram/web-app` reads it apart from
checking it. Only a value returned by a `verify…` function was checked.

```ts
import { InitDataError, InitDataKey, verifyInitData, verifyInitDataSignature } from 'yuigram/web-app'

// The bot's own server: `hash`, under a key derived once from the token. Never in a page.
const key = await InitDataKey.fromToken(process.env.BOT_TOKEN!)

export async function userOf(initData: string) {
  try {
    return (await verifyInitData(initData, { key, maxAge: 3600 })).user
  } catch (error) {
    if (error instanceof InitDataError) return undefined // error.problem: 'mismatch', 'expired', …
    throw error
  }
}

// A third party, or the page: Telegram's Ed25519 `signature`, with the bot's id and no token.
export const checked = (initData: string) =>
  verifyInitDataSignature(initData, { botId: 123456789, maxAge: 3600 })
```

- `maxAge` (seconds) is required: a valid proof does not stop the same text being sent again
  within it. `Infinity` accepts any age and should be a stated decision.
- A valid proof says Telegram issued the data to this bot's Mini App for that user at
  `auth_date` — not who is presenting it, and not what the user may do. Authorize separately.
- `readInitData` parses only. Fields keep Telegram's names (`auth_date`, `start_param`, `user`).
- In the application's own tests, `hashInitData(fields, { token })` gives the `hash` to append so
  the endpoint accepts a fixture, under a token made up for the test. Never compare hashes by
  hand to check launch data; that is `verifyInitData`'s job.
- Problems: `'malformed'`, `'mismatch'`, `'unsigned'` (older data with no `signature`),
  `'expired'`, `'future'`, `'unsupported'` (no Web Crypto, or no Ed25519). Messages never repeat
  the data or the token; do not log `initData` yourself.
- `publicKey: 'test'` for bots in the test environment. The entry point runs on the Web Crypto
  API alone. If `list-exports.mjs yuigram/web-app` finds no such entry, the installed build
  predates it.

## Commands in text, and slot machines

`parseCommand` is the parser `onCommand` matches with, for text read outside an update; it answers
the same `ParsedCommand` a handler gets as `message.command`, or `undefined`:

```ts
import { parseCommand } from 'yuigram'
import { slotMachineReels } from 'yuigram/dice'

parseCommand('/give@shop_bot 10 gold')
// { name: 'give', mention: 'shop_bot', rest: '10 gold', args: ['10', 'gold'] }
parseCommand('see /help') // undefined: the command must open the text

bot.onMessage((message) => {
  if (message.dice?.emoji !== '🎰') return
  const [left, center, right] = slotMachineReels(message.dice.value) // 'bar' | 'grapes' | 'lemon' | 'seven'
  if (left === center && center === right) return message.reply(`three of ${left}`)
})
```

- `parseCommand` reads the text alone (not entities) and ignores whitespace around it. It does not
  decide whom a `/cmd@name` is for — `onCommand` does; with the parser alone, compare `mention`
  with the bot's username, ignoring case.
- A 🎰 value is 1–64: three of a kind at 1, 22, 43 and 64 (three sevens). Anything else is a
  `ValidationError`. Other dice need no decoding — their value is the face.

## Telegram behaviour worth knowing

- **Answer a button press promptly.** Until `query.answer()` is called the button shows a
  spinner, and Telegram stops accepting an answer after a short window.
- **Some updates arrive only when asked for.** `message_reaction` and `chat_member` are not sent
  unless subscribed; `allowedUpdates: 'auto'` subscribes to what handlers are registered for.
- **Formatting is either markup or entities.** Yuigram's `markup()` hook refuses a formatted
  value combined with `parse_mode`, rather than letting one silently win.
- **Entity offsets are UTF-16 code units**, which is what a JavaScript string index is; build
  formatted text with `yuigram/markup` rather than computing offsets by hand.
