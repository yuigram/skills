# Signing an account in

Connecting proves nothing about who the account is; signing in does. They are separate calls
because they fail differently: an unreachable network is not a mistyped code.

## The driven flow

```ts
import { createInterface } from 'node:readline/promises'

async function ask(question: string): Promise<string> {
  const input = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await input.question(question)).trim()
  } finally {
    input.close()
  }
}

await account.connect()
await account.signIn({
  phone: () => ask('Phone: '),
  code: () => ask('Code: '),
  password: () => ask('2FA password: '),
})
```

`signIn` first asks Telegram whether the stored authorization is still signed in — a session
revoked from another device looks signed in locally — and asks the person only for what is
needed: nothing for a live session, a password only when the account has one. A number with no
account is reported rather than mistaken for a failure.

The prompts run where the person is. The code and password are typed by them; a program never
stores, logs or forwards them, and an assistant never asks for them in a conversation.

## The steps, for flows driven by something else

| Method | For |
| --- | --- |
| `sendCode(phone)`, then `signInWithCode({ phone, phoneCodeHash, code })`, then `signInWithPassword(password)` when asked | a web form or queue that collects each answer separately; the hash comes from the state `sendCode` returns |
| `requestLoginToken()` | QR sign-in: display the token, ask again until it is approved |
| `signInQr(options)` | the QR flow driven end to end |
| `signInAsBot(token)` | a bot over MTProto |
| `resendCode({ phone, phoneCodeHash })` | the code again, by whatever means Telegram offers next; keep the hash it returns. Calling `sendCode` again starts over and invalidates the hash |

Each step reports how far it got (`SignInState`) rather than throwing at a fork in the flow.

## After signing in

- `await account.exportSession()` gives the portable string; `{ format: 'tl-v3' }` gives the
  version-3 TL record other MTProto libraries write. Either is a signed-in account.
- `await account.me()` is the signed-in user.
- `await account.logOut()` revokes the authorization and clears the keys, the place in the update
  stream and the peers — which belonged to that authorization. The call goes first, so a refused
  sign-out leaves the store as it was.

## Test environment

Telegram's test environment has its own accounts and datacenters. Use its addresses with
`bootstrapAt({ dc, host, port, testMode: true })` and its server key. Test numbers of the form
`+99966 X YYYY` need no SIM; their code is `X` repeated five times. Prefer it for any live run
the user asks for.
