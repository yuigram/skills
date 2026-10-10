---
name: yuigram-account
description: >
  Use when working with a Telegram user account (or a bot signed in over MTProto) through
  Yuigram's `Account`: `Account.fromSession`, `Account.fromString`, `new Account`, the required
  `apiId`/`apiHash`/`keys`/`bootstrap`/`storage` options, `serverKeysFromPem`, `bootstrapAt`,
  sign-in (`signIn`, `sendCode`, `signInWithCode`, `signInWithPassword`, `requestLoginToken`,
  `signInAsBot`), `exportSession`, storage ownership, account events and
  `yuigram/account-filters`, `event.reply`/`edit`/`forward`, `account.sendText`/`sendMedia`,
  peers and `PeerError`, `account.dialogs`/`history` walks, uploads and downloads,
  `withParams`, the raw `account.api`. Read `using-yuigram` first for safety rules.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: bc915aed6f992c0193a35ead50af130867d4f6de
  tl_layer: 229
---

# An account with Yuigram

An account is a person's Telegram identity over MTProto. Everything it does is done as that
person, and Telegram restricts accounts used for flooding, spam or fake engagement — the
restriction falls on the account, not on the program. Prefer a bot when a bot can do the job.

## Configuration

```ts
import { readFileSync } from 'node:fs'
import { Account, bootstrapAt, memory, serverKeysFromPem } from 'yuigram'

const keys = serverKeysFromPem(readFileSync(process.env.SERVER_KEYS!, 'utf8'))
const bootstrap = bootstrapAt({ dc: 2, host: '149.154.167.50', port: 443 })

// State in a directory on disk.
const onDisk = Account.fromSession('./me.session', {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH!,
  keys,
  bootstrap,
})

// A session string, and a store for what the account writes while it runs.
const fromEnv = Account.fromString(process.env.SESSION!, {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH!,
  keys,
  bootstrap,
  storage: memory(),
  name: 'me',
})
```

| Option | Notes |
| --- | --- |
| `apiId`, `apiHash` | The application's, from my.telegram.org. Required. |
| `keys` | Telegram's server public keys as PEM, from TDLib, Telegram's own library (`td/telegram/net/PublicRsaKeySharedMain.cpp`); the Yuigram repository's `examples/20-presence-watch/keys.ts` retrieves them at a pinned revision and checks the file's digest and the fingerprints — production `d09d1d85de64fd85`, test `b25898df208d2603`. Checked by fingerprint. Needed until each datacenter the account reaches has an authorization stored. Ask the user for the file; never invent or "fix" key material, and never take a key from a datacenter's own answer. |
| `bootstrap` | The first address, `bootstrapAt({ dc, host, port, testMode? })`. A hostname or bad port is a `ValidationError` immediately. The account learns the full list from Telegram and follows redirections itself. |
| `storage` | Required for `fromString` and `new Account`; `fromSession` makes a `file()` store in the directory. |
| `name` | Name in logs and for `app.client(name)`; also the account's area in its store. |
| `takeOverStorage` | Take an area a crashed previous run left claimed. |
| `storageGuard`, `storageLeaseMs`, `device`, `log`, `albumWindow` | Ownership guard, lease, what the server is told about the client, logging, album gathering. |
| `proxy` | An MTProxy, `mtproxy({ host, port, secret })` from `yuigram/mtproxy`. Below. |

`fromString` reads `'portable'` strings unless given `format: 'tl-v3'` — mtcute's version-3
string, the one foreign layout supported. An imported string carries the authorization only: the
account learns peers again and starts its update stream where Telegram is, so updates the other
library had not received are not fetched.

### Through an MTProxy

```ts
import { Account, bootstrapAt, memory } from 'yuigram'
import { mtproxy } from 'yuigram/mtproxy'

const proxied = Account.fromString(process.env.SESSION!, {
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH!,
  keys,
  bootstrap: bootstrapAt({ dc: 2, host: '149.154.167.50', port: 443 }),
  storage: memory(),
  proxy: mtproxy({ host: process.env.PROXY_HOST!, port: 443, secret: process.env.PROXY_SECRET! }),
})
```

- The secret decides the kind: 16 bytes (obfuscated), `dd…` (padded), `ee…` plus a domain
  (fake TLS). Hex, base64 or base64url. `mtproxy()` also takes a `tg://proxy` link as
  `readLink` returns it. An unreadable secret is a `ValidationError` at once.
- Every connection goes through the proxy; none falls back to a direct one, and
  `obfuscated: false` beside `proxy` is refused. A fake-TLS proxy whose answer does not prove
  the secret fails with `FakeTlsError`; `greetingTimeout` bounds its greeting.
- The secret is a credential: never log it or put it in code. The proxy object never shows it.
- Node, Bun and Deno only; in a browser `mtproxy()` throws `ConfigError`.
- Tested against a local proxy, not a real one: treat a first run through a real proxy as
  unverified, and run it only with the user.

## Lifecycle

`await account.connect()` (or `start()`) connects and starts receiving updates; `stop({ timeout })`
drains and disconnects. `account.state` is the lifecycle state; `account.connectionStatus` is
`'offline' | 'connecting' | 'updating' | 'connected'`, and `onConnectionStatus(listener)` returns
an unsubscribe function.

Signing in is separate from connecting — see [reference/sign-in.md](reference/sign-in.md).
`account.logOut()` revokes the authorization and clears what belonged to it.

## Sessions are credentials

`exportSession()` returns a string that **is** a signed-in account, and the `fromSession`
directory holds the same. Code reads them from the environment or a protected file; it never
prints them, logs them, commits them, or sends them anywhere. Do not ask the user to paste one.

## Storage ownership

One area per account name. The account keeps keys, addresses, peers and its place in the update
stream under `accounts:<name>:` and claims that area while running, so accounts with different
`name`s can share a store. A second run with the same name (the default is `'account'`) is
refused with `StorageOwnershipError` within one process, within a browser origin, and across
processes over `sqliteStore`/`redisStore`, whose leases are checked atomically with each write.
Over a plain directory shared by processes the claim is not a lock: it refuses only a run that
starts after the other's claim was written. See [reference/storage.md](reference/storage.md).

## Events

```ts
import { Propagation } from 'yuigram'
import { f } from 'yuigram/account-filters'

account.on(f.text('ping'), (event) => event.reply('pong'))
account.on('message', f.command('stats', { prefixes: '.' }), (event) => event.reply('…'), { group: 0 })
account.on(f.and(f.chat('user'), f.incoming), (event) => {
  event.log.debug('private message', { from: String(event.sender?.id) })
  return Propagation.Continue
}, { group: 1 })
account.catch((error, event) => event.log.error('handler failed', { kind: event.kind, error }))
```

- Kinds shared with bots: `message`, `message_edited`, `message_deleted`, `message_reaction`.
  Account-only kinds start with `mtproto:` (`mtproto:typing`, `mtproto:user_status`,
  `mtproto:callback_query`, `mtproto:album`, `mtproto:join_request`, `mtproto:raw`, …). An
  unknown kind is refused at registration.
- `account.on(kind, filter, handler, { group })`: in each group the first matching handler runs;
  return `Propagation.Continue` to let the next one run too.
- What this account's own calls do — a send, an edit, a pin, a handler's `reply` — does not come
  back to its handlers: the caller has the answer. `f.outgoing` matches messages the account sent
  from another of its clients.
- Filters come from `yuigram/account-filters`. A Bot API `f` filter here is a compile error.
- Context: `chat`, `sender`, `target` (`PeerRef`: `{ kind: 'user' | 'chat' | 'channel', id: bigint }`),
  `message` (the TL value), `text`, `date` (may be `undefined`), `raw`, `api`, `here`, `log`.
- Actions: `reply`, `send`, `replyMedia`, `react`, `edit`, `delete`, `pin`, `unpin`, `download`,
  `forward(to)`, `copy(to)`, `answerCallback`, `answerInline`, `answerShipping`,
  `answerPrecheckout`, `decideJoin`, `fetchChat`, `fetchSender`.
- `event.here.messages.readHistory({ max_id: 0 })` calls the generated surface with the peer filled
  in; `event.api` is the whole surface.
- A user's status: `event.presence` on `mtproto:user_status` (the user is `event.target`) and
  `user.presence` on a `UserView` are the same model — `state` (`'online'`, `'offline'`,
  `'recently'`, `'last-week'`, `'last-month'`, `'long-ago'`), `onlineUntil` / `lastSeen` in Unix
  **seconds**, `hiddenByMe`. Telegram pushes these updates for some users only and offers no
  subscription: read with `account.peersOf([...])` on a slow timer as well, never treat silence
  or an expired `onlineUntil` as offline, and do not derive a time for a vague state.

## Peers and sending

There is no `sendMessage(chatId, …)`: addressing a peer needs an access hash issued to this
account. Name a peer by `@username` or by a `PeerRef` an update carried; an unknown peer is a
`PeerError`, never a guess.

```ts
const sent = await account.sendText('@example', 'hello')
if (sent.id !== undefined) await account.editMessage('@example', sent.id, 'hello again')
await account.deleteMessages('@example', [42], { revoke: false })   // only from this account's view
await account.forwardMessages({ from: '@source', to: '@archive', ids: [42] })
const peer = await account.resolve('@example')                       // the InputPeer for raw calls
```

`SentMessage.id` may be `undefined` when Telegram's short answer did not name it — the message was
still sent. Formatting: `fromHtml`/`fromMarkdown` (skill `yuigram-formatting`).

A link is read without a connection; finding what it names is a request:

```ts
import { readLink } from 'yuigram'

const found = await account.getMessageByLink('https://t.me/example/42') // MessageView | undefined
const link = readLink('https://t.me/contact/AbC_d-9')
if (link?.kind === 'contact') await account.api.contacts.importContactToken({ token: link.token })
if (link?.kind === 'proxy') console.log(link.server, link.port) // never log link.secret
```

`readLink` also describes `socks` proxies, invites, chat folders, stories and boosts. An MTProxy
secret or a SOCKS5 password in a link is a credential for that proxy: keep it out of logs.
`getMessageByLink` refuses a private `t.me/c/…` link to a channel this account has not met.

## Lists

```ts
for await (const dialog of account.dialogs()) console.log(String(dialog.peer?.id), dialog.unreadCount ?? 0)
for await (const message of account.history('@example', { limit: 20 })) console.log(message.text)
```

`dialogs`, `history`, `search`, `members`, `forumTopics`, `reactions`, `chatEvents` and others are
async iterators that fetch page after page; the `…Page` variants (`dialogsPage`, `historyPage`)
read one page for code that decides how far to go. Stop iterating with `break`.

## Files

```ts
import { documentFile, type UploadSource, uploadedDocument } from 'yuigram'

const source: UploadSource = { size: bytes.length, read: async (offset, length) => bytes.subarray(offset, offset + length) }
const uploaded = await account.upload({ source, name: 'report.pdf' })
await account.sendMedia('@example', uploadedDocument(uploaded, { mimeType: 'application/pdf' }), 'the report')

account.on('message', async (event) => {
  const carried = await event.download()          // the file this message carries
  void carried
})
for await (const chunk of account.downloadIterable(documentFile(document))) void chunk
```

`event.download()` repairs an expired file reference itself. `account.download(request)`,
`downloadTo({ …request, write })` and `downloadIterable(request)` take a request built by
`documentFile`, `photoFile` or `thumbnailFile`. Delivery nodes (CDN) are off unless
`cdn: true` is passed — a trust decision for the user, not a speed option.

## File and inline message identifiers

A bot's `file_id` and an account's file reference describe the same files, and Yuigram reads and
writes the identifier format:

```ts
import { fileIdOfDocument, inputDocumentOf, looksLikeFileId, readFileId, uniqueFileId } from 'yuigram'

const identity = readFileId(fileId)                 // refuses a malformed or unknown version
const sameFile = uniqueFileId(identity)             // the same for every copy of the file; never stale
const input = inputDocumentOf(fileId)               // an InputDocument an account can send
const text = fileIdOfDocument(document)             // the other way, for a document an account saw
void [looksLikeFileId(fileId), sameFile, input, text]
```

An identifier carries a file reference that can expire; sending a stale one is refused by
Telegram, and the fix is to fetch the message again (which `event.download()` does by itself).
`readInlineMessageId` and `writeInlineMessageId` from `yuigram/account-utils` convert an
`inline_message_id` string and its TL form.

## Calls and cancellation

`account.api.<namespace>.<method>({ … })` is the generated TL surface (field names as in the
schema, `random_id` included). `account.api.call({ _: 'namespace.newMethod', … })` reaches a
method newer than the installed schema. Per-call options go through a view:

```ts
const patient = account.withParams({ timeout: 60_000 })
await patient.call({ _: 'help.getConfig' })
```

`signal` there stops waiting for a connection; it cannot recall a call already sent —
MTProto has no such operation.

## Testing and running

Use `mockAccount` from `yuigram/testing` (skill `yuigram-testing`). Connecting, signing in or
sending on a real account happens only when the user asks for that run, with credentials they
provide through the environment.
