# Runtime and filesystem boundaries

Where Yuigram runs and what each capability needs from the runtime. "Run" below means the
project's runtime matrix executed it there against a local stand-in; "expected" means the code
uses nothing the runtime lacks but it was not executed separately. Nothing in the project has
been run against Telegram itself.

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
| Account (MTProto) | run | run | run | run locally in workerd | run |

Versions the matrix used: Node.js 22.20.0, Bun 1.4.2, Deno 2.9.6, workerd through Miniflare.
Signing in needs real credentials and has not been run in any of them.

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
  `memory()` or `web()`; `Account.fromSession` needs a directory. In a browser, `web()` is one
  place per origin; accounts in it are kept apart by their distinct `name`s, and Web Locks refuse
  a second page opening the same one.
- **A browser page cannot call the Bot API** directly; a page that needs a bot talks to a server
  that runs one.
- **Each subpath loads only when imported.** Import `yuigram/stream`, `yuigram/worker` and the
  others only where they are used.
