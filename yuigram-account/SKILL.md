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
  tested_revision: 3ea7356cfd7f6b09ac9647fe9d3fbaaa8a5cffa5
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
| `keys` | Telegram's server public keys, from the PEM text Telegram's MTProto documentation publishes. Checked by fingerprint. Needed until each datacenter the account reaches has an authorization stored. Ask the user for the file; never invent or "fix" key material. |
| `bootstrap` | The first address, `bootstrapAt({ dc, host, port, testMode? })`. A hostname or bad port is a `ValidationError` immediately. The account learns the full list from Telegram and follows redirections itself. |
| `storage` | Required for `fromString` and `new Account`; `fromSession` makes a `file()` store in the directory. |
| `name` | Name in logs and for `app.client(name)`; also the account's area in its store. |
| `takeOverStorage` | Take an area a crashed previous run left claimed. |
| `storageGuard`, `storageLeaseMs`, `device`, `log`, `albumWindow` | Ownership guard, lease, what the server is told about the client, logging, album gathering. |

`fromString` reads `'portable'` strings unless given `format: 'tl-v3'`.

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

One store per account. The account keeps keys, addresses, peers and its place in the update
stream under `accounts:<name>:` and claims that area while running. Two accounts given one area
is a `StorageOwnershipError` — give each account its own store or `namespaced(store, 'first:')`.
See [reference/storage.md](reference/storage.md).

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
- Filters come from `yuigram/account-filters`. A Bot API `f` filter here is a compile error.
- Context: `chat`, `sender`, `target` (`PeerRef`: `{ kind: 'user' | 'chat' | 'channel', id: bigint }`),
  `message` (the TL value), `text`, `date` (may be `undefined`), `raw`, `api`, `here`, `log`.
- Actions: `reply`, `send`, `replyMedia`, `react`, `edit`, `delete`, `pin`, `unpin`, `download`,
  `forward(to)`, `copy(to)`, `answerCallback`, `answerInline`, `answerShipping`,
  `answerPrecheckout`, `decideJoin`, `fetchChat`, `fetchSender`.
- `event.here.messages.readHistory({ max_id: 0 })` calls the generated surface with the peer filled
  in; `event.api` is the whole surface.

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
