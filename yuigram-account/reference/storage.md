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
with different names can share a store; two with the same name in one store collide, and that
is refused.

Before reading or writing, the account takes its area through a guard:

| Where | Guard | Excludes |
| --- | --- | --- |
| a browser page | Web Locks | every page and worker of the origin |
| `sqliteStore`, `redisStore` | a lease the store records and checks on every write | every process and machine reaching that database |
| elsewhere | a registry in the process | other accounts in this process only |

Over a plain directory shared by two processes, the claim record written into the store is what
refuses the second run; a stronger primitive (an advisory lock, a lock file) is passed as
`storageGuard`. A run that stopped without stopping — a crash — leaves its claim behind; the next
run refuses it with `StorageOwnershipError` until `takeOverStorage: true` says the previous run is
gone. Do not set `takeOverStorage` to get past an error without knowing the other run has ended.

## Choosing a store

- A server with a disk: `fromSession('./me.session', …)`. The files are written readable by their
  owner only, and a directory readable by others is reported.
- Several processes or machines: `sqliteStore` (`@yuigram/sqlite`) or `redisStore`
  (`@yuigram/redis`), which fence a superseded run's writes.
- Edge runtime or browser: `fromString` with `memory()` or `web()`; in a browser give each
  account its own `web()` prefix.
- Encryption at rest: `encrypted(store, secret)` around a string store, with the secret from the
  environment.

Framework sessions (`session()` for bot or account handlers) are a different thing in a different
store — skill `yuigram-state`.
