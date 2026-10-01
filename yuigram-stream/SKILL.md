---
name: yuigram-stream
description: >
  Use when showing a long answer — typically a language model's output — as it is written,
  with Yuigram's `yuigram/stream`: the `stream()` plugin and `StreamFlavour` for a bot,
  `message.stream(source, options)`, `streamTo(account, peer, source)` for an account, the
  source adapters (`fromOpenAI`, `fromAnthropic`, `fromOllama`, `fromLangChain`,
  `fromEventEmitter`, `fromBytes`), the reader's stop button, and rich streams.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  yuigram_revision: 3ea7356cfd7f6b09ac9647fe9d3fbaaa8a5cffa5
---

# Streaming an answer

The reader sees a draft growing while the answer is written; each time a message fills, it is
sent and the next one begins; the end is sent as a message with its formatting intact.

## A bot

```ts
import { Bot } from 'yuigram'
import { type StreamFlavour, stream } from 'yuigram/stream'

const streaming = Bot.fromToken<StreamFlavour>(process.env.BOT_TOKEN!)
streaming.extend(stream({ canStop: true }))

streaming.onMessage(async (message) => {
  const result = await message.stream(answer(message.text ?? ''), { parseMode: 'MarkdownV2' })
  message.log.info('streamed', { messages: result.messages.length, drafts: result.drafts, stopped: result.stopped })
})
```

- A source is an async iterable of text pieces or of a model SDK's stream events. The adapters
  read the common SDK shapes; check `list-exports.mjs yuigram/stream` for the installed ones.
- `canStop: true` gives the reader a stop button; `result.stopped` says whether it was pressed.
- `{ rich: 'markdown' }` streams a rich message that keeps blocks as they are written.
- The text must be valid for the parse mode at every point it is shown; escape what the model
  writes accordingly (MarkdownV2 reserves many characters).

## An account

```ts
import { streamTo } from 'yuigram/stream'

const outcome = await streamTo(account, '@example', answer('question'))
void outcome
```

## Checking it

Streaming can be rehearsed offline with `mockBot` (skill `yuigram-testing`). A run against
Telegram sends real drafts and messages to a real chat — only when the user asks for it.
