---
name: yuigram-bot
description: >
  Use when building or changing a Telegram bot with Yuigram's `Bot` (Bot API over HTTPS):
  `Bot.fromToken`, `poll()` options, `bot.webhook()` with the `yuigram/webhook` adapters,
  `on`/`onCommand`/`onText`/`onCallbackQuery` and the named `on…` registrations, message and
  callback contexts, the bound methods (`message.banChatMember`, `message.sendPhoto`), `f`
  filters, `Router`, middleware, `InlineKeyboard`/`Keyboard`, `media` sources, downloads,
  `bot.api` and `bot.api.call`, hooks, `throttle`, `retryOnFloodWait`, `rateLimit`, `t.me`
  links (`writeLink`, `readLink`), Mini App launch data (`yuigram/web-app`). Read
  `using-yuigram` first for imports and safety rules.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: ad7f68abccd77399840de0bc3374c05c1a01fd34
  bot_api: 10.3
---

# A bot with Yuigram

## Construct and run

```ts
import { Bot, createLogger } from 'yuigram'

const bot = Bot.fromToken(process.env.BOT_TOKEN!, {
  name: 'support',
  log: createLogger({ level: 'info' }),
  defaults: { '*': { parse_mode: 'HTML' } },
})

process.once('SIGINT', () => void bot.stop({ timeout: 10_000 }))
await bot.poll({ concurrency: 16, allowedUpdates: 'auto', dropPending: true })
```

- `poll()` resolves once the bot is running; the loop continues until `stop()`.
- One chat's updates run in order; different chats run in parallel up to `concurrency`
  (16 by default). `concurrency: 1` is strictly sequential.
- `allowedUpdates: 'auto'` subscribes to the kinds handlers are registered for. Telegram sends
  `message_reaction` and `chat_member` only when asked, so an explicit list that omits them is
  why such a handler "never fires".
- `stop({ timeout })` stops intake, drains handlers up to the timeout, and resolves to whether
  everything finished.
- Other options: `testMode` (Telegram's test environment), `baseUrl` + `local` (own Bot API
  server), `client` (own HTTP transport).

### Webhook instead of polling

```ts
import { createServer } from 'node:http'
import { nodeWebhook, webWebhook } from 'yuigram/webhook'

const handler = bot.webhook({ secretToken: process.env.WEBHOOK_SECRET })
createServer(nodeWebhook(handler, { path: '/hook' })).listen(8080)

export default { fetch: webWebhook(handler) }   // Fetch-style servers and edge runtimes
```

In a Koa application, `koaWebhook` is middleware. It uses `ctx.request.body` when a body parser
ran first and reads the request itself otherwise; Koa sends the response, and a handler that
throws goes to Koa's error handling. Koa is the application's dependency, not Yuigram's:

```ts
import Koa from 'koa'
import { koaWebhook } from 'yuigram/webhook'

new Koa().use(koaWebhook(bot.webhook({ secretToken: process.env.WEBHOOK_SECRET }), { path: '/hook' })).listen(8080)
```

A webhook deployment never calls `poll()`. Register the URL once with
`bot.api.setWebhook({ url, secret_token })`. Duplicate deliveries are dropped by `update_id`.

## Handlers and contexts

```ts
bot.onCommand('start', (message) => message.reply('Hello'))
bot.onCommand('say', (message) => message.reply(message.command.rest || 'Say what?'))
bot.onText(/^\d+$/, (message) => message.reply(`number ${message.text}`))
bot.onCallbackQuery(/^buy:/, async (query) => {
  await query.answer('Ordered')
  await query.edit('Thanks!')
})
bot.onChatMemberJoined((event) => event.reply('Welcome!'))
bot.on(['message', 'channel_post'], (event) => event.log.debug('post', { kind: event.kind }))
```

- Every event kind has a named registration (`onMessage`, `onMessagePinned`,
  `onForumTopicCreated`, …), equivalent to `on(kind, handler)`. Service messages are their own
  kinds — do not branch on a message's fields to detect a member joining.
- `onCommand('start')` matches `/start` and `/start@this_bot`, not a command addressed to another
  bot in a group.
- A message context: `chat` (always present), `sender` (absent on channel posts), `text`
  (optional), `date`, `raw`, `api`, `log`; actions `reply`, `send`, `edit`, `delete`, `react`,
  `download`, `downloadStream`.
- Bound methods take Telegram's names and fill in what the update carried:
  `message.banChatMember({ user_id })`, `message.sendChatAction({ action: 'typing' })`,
  `message.forwardMessage({ chat_id })`. Use them instead of copying `chat_id` around.
- A callback query context: `data`, `answer(text?)`, `answerCallbackQuery({ … })`, `edit(text)`.
- Anything not in an update goes through `bot.api.<method>(params, { signal, timeout })`. A
  method newer than the installed schema: `bot.api.call('newMethod', params)`.

## Filters, middleware, routers

```ts
import { and, f, filter, type MessageContext, Router } from 'yuigram'

const adminInGroup = and(f.sender.id(ADMIN_ID), f.chat.anyGroup)
bot.on(adminInGroup, (message) => message.reply('yes, boss'))
bot.on(f.has.photo, (message) => message.react('🔥'))

const weekend = filter<MessageContext>('weekend', (m) => [0, 6].includes(new Date(m.date * 1000).getDay()), {
  kinds: ['message'],
})
bot.on(weekend, (message) => message.reply('Rest!'))

const admin = new Router({ name: 'admin' })
admin.use(async (event, next) => {
  if ('sender' in event && event.sender?.id === ADMIN_ID) await next()
})
admin.onCommand('stats', (message) => message.reply('…'))
bot.extend(admin)
```

- Name a composed filter before registering it; inline composition does not infer.
- `f` families: `text`, `caption`, `command`, `chat.*`, `sender.*`, `media.*`, `has.*` (one per
  optional message field), `entity.*`, `reply.*`, `forward.*`, `reaction.*`, `member.*`,
  `payment.*`, `callback.*`.
- `bot.use(middleware, { priority: 'high' | 'normal' | 'low' })`; middleware that does not call
  `next()` ends the chain. `when(filter, middleware)` runs it only on a match, with the narrowed
  context.
- A router's middleware runs only for updates the router handles, once per update. A router
  typed `new Router<SessionFlavor<Cart>>()` installs only on a bot with that session.
- Handler failures go to `bot.onError((error, event) => …)`; a router may have its own `onError`.

## Keyboards and files

```ts
import { InlineKeyboard, Keyboard, media } from 'yuigram'

const menu = new InlineKeyboard().text('Buy', 'buy:1').url('Docs', 'https://core.telegram.org/bots/api').row().text('Cancel', 'cancel')
await message.reply('Pick one', { reply_markup: menu })
await message.reply('Bye', { reply_markup: Keyboard.remove() })

await message.reply({ photo: media.path('./cat.jpg'), caption: 'cat' })
await message.reply({ document: media.buffer(bytes, 'report.pdf') })
await message.reply({ photo: media.id(fileId) })
```

- A keyboard is the markup itself: no `build()`. Callback data over 64 bytes is refused where the
  button is written. Typed callback data: `defineCallbackData` (skill `yuigram-state`).
- `media.path` streams from disk; `media.url` makes Telegram fetch it; `media.buffer`,
  `media.text`, `media.stream`, `media.blob` send what the program holds; `media.id` reuses a
  `file_id` (bots only).
- Downloads: `message.download()` (the file the message carries), `bot.download(target)`,
  `bot.downloadStream(target)`, `downloadToFile(bot.files, path, target)` for disk.
  `bot.getFileUrl(target)` returns a URL **containing the token** — never log or share it.
- A file name from Telegram is chosen by the sender; never turn it into a path unchecked.

## Outgoing calls: limits and retries

```ts
import { rateLimit, retryOnFloodWait, throttle } from 'yuigram'

const paced = throttle()                         // 30/s, 1/s per chat, 20/min per group by default
bot.hook(paced.hook)
bot.hook(retryOnFloodWait({ maxWait: 30 }))      // seconds; longer waits are rethrown
bot.use(rateLimit({ limit: 10, windowMs: 10_000 }))
```

Hooks wrap every outgoing call: `next()` sends, calling it twice retries, not calling it answers
without sending. `FloodError.retryAfter` is in seconds.

## Testing

Write tests with `mockBot` from `yuigram/testing` — see skill `yuigram-testing`. Do not start a
real bot to check a change unless the user asks for that run.

More: [reference/recipes.md](reference/recipes.md) — per-method defaults, cancelling, plugins,
shared limits, a local server, inline mode, uploading once, links a bot hands out, Mini App
launch data, commands in text and slot machines.
