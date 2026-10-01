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
