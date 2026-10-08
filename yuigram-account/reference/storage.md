# Where an account keeps its state

An account writes while it runs — a key with a lifetime, the datacenter list it is told, the
peers it meets, its place in the update stream — so it always needs a store, even when nothing
should outlive the process.

| Constructor | Store |
| --- | --- |
| `Account.fromSession(directory, options)` | `file(directory)`, made for you; the directory is the session |
| `Account.fromString(session, { …, storage })` | the store you pass; `memory()` when the session string is re-supplied on every start |
| `new Account({ …, storage })` | the store you pass; sign in afterwards |

## The area and its claim

Everything lives under `accounts:<name>:` in the store — `claim`, `auth:…`, `dcs:…`, `peers:…`,
`updates:…` — where `name` is the account's `name` option (`'account'` by default). Two accounts
with different names can share a store; two runs with the same name in one store collide, and
the second is refused where the mechanism below can see it.

Before reading or writing, the account takes its area through a guard:

| Where | Guard | Excludes |
| --- | --- | --- |
| a browser page | Web Locks | every page and worker of the origin |
| elsewhere | a registry in the process | other accounts in this process only |
| plus, with `sqliteStore` or `redisStore` | a lease the store records and checks in the same atomic step as each `set`/`delete` | every process and machine reaching that database; a superseded run's writes are refused by the store |

The claim record (`claim`: the name and a token per run) is **not a lock**. It is read and then
written, so over `file()` or any other persistent store without leases it refuses a run that
starts *after* another run's claim was written — but two processes that start together both
proceed, and a take-over in one process does not stop a run still writing in another. For several
processes on one account's data, use `sqliteStore` or `redisStore`, or pass a real cross-process
primitive (an advisory lock, a lock file) as `storageGuard`.

A crash leaves the claim behind. In a browser, over a leasing store (after the lease lapses,
`storageLeaseMs`, 30 s by default) and over `memory()`, the next run adopts it without a flag.
Over a plain directory the next run refuses with `StorageOwnershipError` until
`takeOverStorage: true` asserts the previous run has ended. Do not set `takeOverStorage` to get
past an error without knowing that run has ended: over a non-leasing store nothing stops it if it
has not.

## Choosing a store

- A server with a disk: `fromSession('./me.session', …)`. The files are written readable by their
  owner only, and a directory readable by others is reported.
- Several processes or machines: `sqliteStore` (`@yuigram/sqlite`) or `redisStore`
  (`@yuigram/redis`), which fence a superseded run's writes.
- Edge runtime or browser: `fromString` with `memory()` or `web()`; in a browser,
  `indexedDb()` from `yuigram/indexeddb` when `localStorage` is too small. Both are one place per
  origin, so accounts in a page share it; their distinct `name`s keep them apart, and Web Locks
  keep a second page from running the same one.
- Encryption at rest: `encrypted(store, secret)` around a string store, with the secret from the
  environment.

Framework sessions (`session()` for bot or account handlers) are a different thing in a different
store — skill `yuigram-state`.
