# Entry points and the names in them

What each entry point holds, by purpose. The lists are what applications use, not every export;
`tools/list-exports.mjs <entry>` prints the runtime values the installed package actually has.

## `yuigram`

| Purpose | Names |
| --- | --- |
| Clients | `Bot`, `Account`, `App`, `AccountRouter`, `Router` |
| Context types | `MessageContext`, `CallbackQueryContext`, `AnyEventContext`, `MtprotoContext`, `UnifiedContext`, `BaseContext` |
| Bot API filters | `f`, `filter`, `defineFilter`, `and`, `or`, `not`, `every`, `some` |
| Middleware | `when`, `Middleware`, `Propagation` |
| Account configuration | `bootstrapAt`, `serverKeysFromPem`, `serverRsaKey`, `AccountOptions`, `DcConfiguration` |
| Sessions | `session`, `createSession`, `userChatKey`, `SessionFlavor` |
| Storage | `memory`, `file`, `encrypted`, `web`, `namespaced`, `tiered`, `KV` |
| Conversations | `conversation`, `defineFlow`, `ConversationFlavour`, `ScenePosition`, `FlowRecord` |
| Buttons | `InlineKeyboard`, `Keyboard`, `defineCallbackData`, `pager`, `inlineKeyboard`, `callbackButton`, `urlButton` |
| Files (bot) | `media`, `download`, `downloadStream`, `downloadToFile`, `getFileUrl` |
| Files (account) | `documentFile`, `photoFile`, `thumbnailFile`, `uploadedPhoto`, `uploadedDocument`, `documentMedia`, `photoMedia` |
| Commands | `parseCommand`, `ParsedCommand`, `CommandContext` |
| Links and identifiers | `readLink`, `writeLink`, `LinkError`, `TelegramLink` (bot starts, groups and channels, mini apps, games, usernames, invites, messages, proxies, temporary profiles, …), `peerIdentity`, `botApiId` |
| Formatting | `html` (escaping template, for `parse_mode: 'HTML'`), `escapeHtml`, `escapeMarkdownV2`, `raw`, `fromHtml`, `fromMarkdown`, `toHtml`, `toMarkdown` |
| Outgoing calls | `retryOnFloodWait`, `throttle`, `rateLimit`, `limiter`, `withDefaults` |
| Plugins and events | `definePlugin`, `MiddlewareHost`, `defineEvent` |
| Errors | `YuigramError`, `TelegramError`, `BotApiError`, `RpcError`, `FloodError`, `NetworkError`, `PeerError`, `ValidationError`, `ConfigError`, `StorageOwnershipError`, `WaitTimeoutError`, `EffectUncertainError` |
| Logging | `createLogger` |
| Schema | `schemaInfo` (`botApi`, `tlLayer`), `BOT_API_VERSION` |

## Subpaths

| Entry point | Names |
| --- | --- |
| `yuigram/testing` | `mockBot`, `mockAccount`, `mockTransport`, fixtures such as `message`, `messageUpdate`, `callbackQueryUpdate`, `memberJoinedUpdate`, `floodWait`, `apiError`, `rpcError` |
| `yuigram/webhook` | `createWebhookHandler`, `nodeWebhook`, `expressWebhook`, `fastifyWebhook`, `webWebhook` |
| `yuigram/worker` | `serveAccounts`, `attachAccount`, `workerEndpoint`, `HostUnavailableError` |
| `yuigram/markup` | `Formatted`, `format`, `html`, `md`, `bold`, `italic`, `code`, `pre`, `link`, `spoiler`, `parseHtml`, `parseMarkdown`, `toHtml`, `toMarkdown`, `markup` |
| `yuigram/rich` | `Rich` and the block builders |
| `yuigram/stream` | `stream`, `streamTo`, `StreamFlavour`, `fromOpenAI`, `fromAnthropic`, `fromOllama`, `fromLangChain`, `fromEventEmitter`, `fromBytes` |
| `yuigram/web-app` | `readInitData`, `verifyInitData`, `verifyInitDataSignature`, `hashInitData`, `InitDataKey`, `InitDataError`, `InitData`, `InitDataSecret`, `WebAppUser`, `WebAppChat`, `TELEGRAM_INIT_DATA_KEYS` |
| `yuigram/dice` | `slotMachineReels`, `SlotMachineReels`, `SlotMachineSymbol` |
| `yuigram/account-filters` | `f` (`text`, `command`, `regex`, `chat`, `sender`, `incoming`, `outgoing`, `media`, `callback`, `callbackData`, `and`, `or`, `not`, …) |
| `yuigram/account-utils` | `decodeWaveform`, `encodeWaveform`, `strippedToJpeg`, `readInlineMessageId`, `writeInlineMessageId`, … |

`html` exists twice on purpose: the one from `yuigram` returns an escaped **string** for
`parse_mode: 'HTML'`; the one from `yuigram/markup` returns a `Formatted` value (text plus
entities), passed with `formatted.as('text')` or `formatted.as('caption')`.

## Not entry points

`@yuigram/core`, `@yuigram/bot-api` and `@yuigram/mtproto` are what `yuigram` is built from.
They appear in `node_modules` as its dependencies; applications import from `yuigram` instead.
`@yuigram/sqlite` and `@yuigram/redis` are the exception — separate packages, installed and
imported on their own.
