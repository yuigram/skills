---
name: yuigram-formatting
description: >
  Use when sending formatted text with Yuigram: the escaping `html` template from `yuigram`
  with `parse_mode`, `escapeHtml`/`escapeMarkdownV2`/`raw`, formatted values from
  `yuigram/markup` (`format`, `bold`, `link`, `Formatted.as`, `parseHtml`, the `markup()`
  hook), rich messages from `yuigram/rich`, and an account's `fromHtml`/`fromMarkdown`/`toHtml`/
  `toMarkdown`. Covers why interpolated user text must never become markup.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: 376e34fd708fee7383ff0b8908ffdb8b57f99351
---

# Formatting with Yuigram

The rule everywhere: **text that came from a person is text, never markup.** A user named `<b>`
must not be able to break or restyle a message. Every template here escapes what is
interpolated and keeps what the developer wrote.

## A bot, with `parse_mode`

```ts
import { html } from 'yuigram'

await message.reply(html`Hello, <b>${message.sender?.first_name ?? 'there'}</b>!`, { parse_mode: 'HTML' })
```

`html` from `yuigram` returns an escaped **string**; pair it with `parse_mode: 'HTML'`.
`undefined` interpolates as the text "undefined", so give optional values a fallback. For text
built some other way: `escapeHtml`, `escapeMarkdownV2`, `escapeMarkdown`; `raw(text)` splices
already-formatted text without escaping it twice.

## A bot, with formatted values

```ts
import { bold, format, link } from 'yuigram/markup'

const line = format`Hi, ${bold(name)}. ${link('Docs', 'https://core.telegram.org/bots/api')}`
await message.sendMessage({ ...line.as('text') })
await message.sendPhoto({ photo: media.url('https://example.com/cat.jpg'), ...line.as('caption') })
```

A `Formatted` value is text plus entities. `as('text')` gives `text` and `entities`,
`as('caption')` gives `caption` and `caption_entities` — typed, no cast. Builders: `bold`,
`italic`, `underline`, `strikethrough`, `spoiler`, `code`, `pre`, `link`, `mentionUser`,
`customEmoji`, `blockquote`. `html` and `md` from `yuigram/markup` read markup into a `Formatted`
value, strictly by default, refusing with an offset (`MarkupParseError`).

`bot.extend(markup())` accepts a `Formatted` value in any field where Telegram takes text and
entities, for payloads assembled at run time. Do not combine it with `parse_mode`; that is
refused.

## Rich messages

`yuigram/rich` builds rich messages from blocks, or reads them from rich Markdown and HTML, and
works with the streaming plugin (`message.stream(source, { rich: 'markdown' })`). Check the
installed exports (`list-exports.mjs yuigram/rich`) before using a builder by name.

## An account

MTProto has no `parse_mode`; the client builds the entities.

```ts
import { fromHtml, fromMarkdown, toHtml } from 'yuigram'

await account.sendText('@example', fromHtml`Hello, <b>${name}</b>`)
await account.sendText('@example', fromMarkdown`*bold* and _italic_`)

for await (const view of account.history('@example', { limit: 1 })) {
  if (view.text !== undefined) console.log(toHtml({ text: view.text, entities: view.entities ?? [] }))
}
```

- The account readers are lenient by default (markup a developer types); `fromHtml.with({ mode:
  'strict' })` refuses what Telegram would. `whitespace: 'collapse' | 'dedent'` for HTML,
  `'dedent' | 'trim'` for Markdown.
- Markdown here is MarkdownV2, so text escaped for a bot is safe for an account.
- A `tg://user?id=N` mention is sent with the access hash the account holds; a mention of a
  person the account has never seen is refused with `PeerError` before sending.
