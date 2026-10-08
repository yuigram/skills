# Runtime and filesystem boundaries

Where Yuigram runs and what each capability needs from the runtime. "Run" below means the
project's runtime matrix executed it there against a local stand-in; "expected" means the code
uses nothing the runtime lacks but it was not executed separately. Against Telegram itself, only
one example has been run, by hand, under Node.js 22 on production: an account signing in and
receiving updates, and a bot over long polling. The project's prepared live procedure has not
been run.

| Capability | Node 22+ | Bun | Deno | Workers / edge | Browser |
| --- | --- | --- | --- | --- | --- |
| Bot API call over `fetch`, cancellation | run | run | run | run | expected, but Telegram sends no CORS headers |
| Fetch-shaped webhook (`webWebhook`) | run | run | run | run | — |
| Long polling | run | expected | expected | not applicable: needs a long-lived process | — |
| Files by path (`media.path`, `downloadToFile`) | run | expected | expected (permissions) | no | no |
| `memory()` | run | run | run | run | expected |
| `file()` | run | run | run (`--allow-read`, `--allow-write`) | no | no |
| `encrypted()` | run | run | run | no | no |
| `@yuigram/sqlite` | run | run (`node:sqlite`) | run (`node:sqlite`) | no | no |
| `web()` (`localStorage`) | caller supplies the storage | expected | expected | no | run |
| `indexedDb()` | over an implementation passed as `factory` (tests use fake-indexeddb) | no | no | no | run (Chromium) |
| Account (MTProto) | run | run | run | run locally in workerd | run |
| Account through `mtproxy()`, fake TLS included | run | run | run | no | no: `ConfigError` |

Versions the matrix used: Node.js 22.20.0, Bun 1.4.2, Deno 2.9.6, workerd through Miniflare.
The matrix has no credentials, so it signs in nowhere; signing in has run only in that one hand
run, under Node.js. The MTProxy row ran against a local proxy from Yuigram's test suite in front of
the mock datacenter: no real MTProxy, and nothing through one to Telegram.

## What follows for code you write

- **A bot that never touches a path bundles no filesystem code.** Its `download`,
  `downloadStream` and `getFileUrl` methods use the transport only. Writing to disk is
  `downloadToFile(bot.files, path, target)`, a separate function, so keep it out of code meant for
  an edge runtime.
- **A bot bundle contains no MTProto.** Importing `Bot` from `yuigram` does not pull in the
  account client; keep it that way by not importing account helpers into bot-only code.
- **An edge function cannot poll.** Use `bot.webhook()` with `webWebhook`, and register the URL
  with `bot.api.setWebhook({ url, secret_token })`.
- **An account off a server** uses `Account.fromString(session, { …, storage })` with
  `memory()`, `web()` or `indexedDb()`; `Account.fromSession` needs a directory. In a browser,
  `web()` and `indexedDb()` are one place per origin; accounts in it are kept apart by their
  distinct `name`s, and Web Locks — not IndexedDB's transactions — refuse a second page opening
  the same one.
- **An MTProxy needs TCP.** `mtproxy()` works where an account opens its own sockets (Node, Bun,
  Deno); in a browser it throws `ConfigError`.
- **A browser page cannot call the Bot API** directly; a page that needs a bot talks to a server
  that runs one.
- **Each subpath loads only when imported.** Import `yuigram/stream`, `yuigram/worker` and the
  others only where they are used.
