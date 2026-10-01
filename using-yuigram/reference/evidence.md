# Evidence levels

A claim about Yuigram code is only as strong as the check behind it. Name the level reached, and
do not describe a lower one as a higher one.

| Level | How it is reached | What it shows | What it does not show |
| --- | --- | --- | --- |
| Type-checks | `tsc --noEmit` against the installed package | the names exist and the shapes fit | that anything runs, or what Telegram does |
| Mock run | a test with `mockBot` / `mockAccount` | the real dispatch, middleware, contexts and the calls made, with only the network replaced | how Telegram answers, timing, limits |
| Runtime run | the program executed in a given runtime against a local stand-in (the project's runtime matrix, a local Bot API stand-in) | the code loads and works in that runtime | Telegram's behaviour |
| Live run | the program run against Telegram, ideally its test environment | Telegram accepts and answers the calls | other environments, other accounts, future server behaviour |

## Reporting

- Say which commands ran and what they printed: "the suite passed (12 tests)", not "it works".
- A check that was skipped, refused or not available is reported as such, with the reason.
- Never report a test, a type check or a live run that did not happen. If running it needs
  something you do not have — credentials, a runtime, the user's approval — say what is needed.
- Code written but not run is "written, not run".

## Live runs need the user

A live run acts on real accounts: connecting an account records a new session on it, sign-in
creates an authorization, and sends are visible to people. Do one only when the user asks for
that run, with credentials they provide through the environment or a file — never pasted into
the conversation. The Yuigram repository's own live checks (`tools/live`, documented in
`docs/live-verification.md`) refuse to run without an explicit variable for each kind of change;
do not set those variables on the user's behalf.
