---
name: yuigram-worker
description: >
  Use when a Yuigram account should run on another thread — a Node.js worker thread, a
  dedicated web worker, or a `SharedWorker` that every tab of a page attaches to — and be driven
  from the main thread: `serveAccounts` in the worker, `attachAccount` and `workerEndpoint` on
  the caller's side, `onEvent` (`host-lost`, `stopped`), `detach`, `HostUnavailableError`.
metadata:
  project: yuigram
  source: https://github.com/yuigram/yuigram
  tested_revision: 8dbee2f4e199688190aa13f92548bc037670f394
---

# An account in a worker

The connection, encryption and update processing run on the worker's thread; the caller drives
the account through a port. Importing `yuigram` never creates a worker — everything here is in
`yuigram/worker`.

## The worker

```ts
import { parentPort } from 'node:worker_threads'
import { Account, bootstrapAt, ConfigError, memory } from 'yuigram'
import { serveAccounts } from 'yuigram/worker'

serveAccounts(
  {
    create: (name) => {
      const session = process.env.SESSION
      if (session === undefined) throw new ConfigError('SESSION is not set')
      return Account.fromString(session, {
        name,
        apiId: Number(process.env.API_ID),
        apiHash: process.env.API_HASH!,
        keys,
        bootstrap: bootstrapAt({ dc: 2, host: '149.154.167.50', port: 443 }),
        storage: memory(),
      })
    },
    onLastDetached: 'stop',
  },
  parentPort,
)
```

`create(name)` makes the account a caller asks for by name, once; later callers attach to the
same one. `onLastDetached: 'stop'` stops it when nobody is attached.

## The caller

```ts
import { Worker } from 'node:worker_threads'
import { attachAccount, HostUnavailableError, workerEndpoint } from 'yuigram/worker'

const worker = new Worker(new URL('./host.js', import.meta.url))
const me = await attachAccount(workerEndpoint(worker), { account: 'me' })

me.onEvent((event) => {
  if (event.kind === 'host-lost') console.error('the worker is gone')
})
me.on('message', async (event) => {
  if (event.text === 'ping') await event.reply('pong')
})

await me.start()
process.once('SIGINT', () => void me.detach().then(() => worker.terminate()))
```

- What may cross the port is a fixed table of calls, getters and streams; the protocol logs no
  arguments or results.
- Sign-in prompts run on the caller's side, where the person is; the answer crosses as the
  result of a callback.
- A worker that stops answering surfaces as `HostUnavailableError`; a refusal from `create`
  (such as a `ConfigError`) reaches the caller as that error.
- In a browser, a `SharedWorker` lets every tab of the page share one account and one
  connection; which platforms provide which workers is in the Yuigram repository's
  `docs/runtimes.md` §6.
