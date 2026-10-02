---
name: yuigram-testing
description: >
  Use when testing code built on Yuigram, or when deciding how to check a change to a bot or
  account without touching Telegram: `mockBot` and `mockAccount` from `yuigram/testing`,
  `send.command`/`send.message`, `calls.last`, scripted answers with `on`/`once`, update and
  error fixtures (`floodWait`, `apiError`, `rpcError`), and how to report what a test does and
  does not show.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: d1f9937b3411da398426736fd754ecf021c3fb09
---

# Testing Yuigram code

`yuigram/testing` runs the real pipeline — normalization, middleware, dispatch, contexts — and
replaces only the network. No token, no account, no connection to Telegram. Use it instead of
running a real bot or account to check a change.

## A bot

```ts
import { mockBot } from 'yuigram/testing'
import { expect, it } from 'vitest'

it('answers /start', async () => {
  const { bot, send, calls, dispose } = mockBot()
  bot.onCommand('start', (message) => message.reply('Hello'))

  await send.command('/start')

  expect(calls.last('sendMessage')?.params).toMatchObject({ text: 'Hello' })
  await dispose()
})
```

- `send` delivers updates (`send.command`, `send.message`, …); `calls` records outgoing calls;
  `sent` holds messages the bot sent; `errors` collects handler failures.
- Script an API answer — including a failure — with `on(method, answer)`. Fixtures such as
  `floodWait`, `apiError`, `message`, `callbackQueryUpdate` and `memberJoinedUpdate` build them,
  so `FloodError` and friends are raised exactly as in production.
- The bot under test is a real `Bot`: install the same plugins, routers and middleware as the
  application.

## An account

```ts
import { f } from 'yuigram/account-filters'
import { mockAccount } from 'yuigram/testing'
import { expect, it } from 'vitest'

it('answers ping', async () => {
  const mocked = mockAccount()
  mocked.account.on('message', f.text('ping'), (event) => event.reply('pong'))

  await mocked.send.message('ping')

  expect(mocked.calls.last('messages.sendMessage')?.query).toMatchObject({ message: 'pong' })
  await mocked.dispose()
})
```

The mock answers sending, editing and deleting messages, reading history, reactions, typing and
button presses as Telegram would. Any other method is refused with an error naming it; script it
with `mocked.on(method, answer)` or `once`. `send.press(…)` presses a button; `send.update(tl)`
delivers any TL update.

## What a passing test shows

A mock test shows the handlers, filters, middleware and the calls they make. It does not show
how Telegram answers, its limits or timing. Report results at that level — "the mock test
passes" — and never as "verified with Telegram". Run the tests before saying they pass; if they
cannot be run, say so and why. The `using-yuigram` skill's `reference/evidence.md` lists the
levels.

Do not replace a failing assertion with a weaker one, skip a test, or cast away a type error to
make a suite pass; a failure is information about the code or about these notes.
