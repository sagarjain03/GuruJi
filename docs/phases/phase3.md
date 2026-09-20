# Phase 3 — Code editor

> **Status:** done · 2026-09-19
> **One sentence:** you can now write code against a problem, in four languages,
> and it is still there when you come back.
>
> **Verified in a real browser.** Playwright was pulled forward from Phase 12
> for exactly this, and it immediately found two bugs nothing else could. See
> [What the browser found](#what-the-browser-found).

---

## What you can actually do now

```
┌─────────────────────────────────────────────────────────────┐
│  1. Open a problem      → statement left, editor right       │
│  2. Pick a language     → its starter code appears           │
│  3. Type                → "unsaved" … "saving" … "saved"     │
│  4. Switch language     → the other attempt is untouched     │
│  5. Reload              → your code comes back               │
│  6. Drag the divider    → or use the arrow keys              │
└─────────────────────────────────────────────────────────────┘
```

What you cannot do is run it. That is Phase 4, and the test panel says so
instead of offering a Run button that does nothing.

---

## Two things the plan asked for that could not be built

Both were flagged before starting, not discovered afterwards.

**`Submission` does not exist yet.** The phase list put "submission history
panel" and `GET /problems/:slug/submissions` in Phase 3, but the table they read
from arrives in Phase 4. Both moved to Phase 4.

**`Draft` was not in the database design.** `docs/database.md` described twenty-odd
models and none of them held unsubmitted code. The model was added, and the
document was updated in the same change rather than left describing a schema
that no longer exists.

---

## Monaco without `unsafe-eval`

`docs/security.md` has said from the start that `script-src` carries no
`unsafe-eval` and that "Monaco is configured to avoid it". Two things were true
when this phase started: Monaco was not installed, and **the web app had no CSP
at all**. A promise with nothing enforcing it is a comment.

So this phase added both, and the editor is set up so the policy can be honest:

**It loads from our own bundle.** `@monaco-editor/react` fetches Monaco from
jsdelivr by default. `loader.config({ monaco })` hands it an instance that is
already bundled, so nothing is fetched. `script-src 'self'` would block that
fetch anyway — which is the right failure mode: the editor visibly fails to load
rather than a third-party script silently succeeding.

**Only the grammars are imported, never the language services.**

```ts
import('monaco-editor/languages/definitions/cpp/register')     // Monarch only
import('monaco-editor/languages/definitions/python/register')
import('monaco-editor/languages/definitions/javascript/register')
```

Those register lazy tokenizers. The TypeScript and JSON *services* — the parts
that compile source in a worker, and the reason Monaco is usually cited as
needing `unsafe-eval` — are never referenced. Grepping the production bundle for
`typescriptServices` and `tsWorker` returns nothing.

The trade is real and worth stating: syntax colouring, no IntelliSense. For a
box you type a submission into, colours are the part that matters.

**The worker is same-origin.** Monaco's fallback builds its worker from a
`blob:` URL. `new Worker(new URL('./monaco.worker.ts', import.meta.url))` makes
the bundler compile one into our own origin instead, which is what
`worker-src 'self'` needs. A bare package specifier inside `new URL` does not
resolve — hence the one-line local module that re-exports Monaco's worker.

### Monaco 0.56 moved everything

The paths in every guide online — `monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution` —
do not exist in 0.56. The package now has an `exports` map of `"./*": "./esm/vs/*.js"`,
so the `esm/vs/` prefix resolves to `esm/vs/esm/vs/` and nothing is found. The
working specifiers are `monaco-editor/editor/editor.api` and
`monaco-editor/languages/definitions/<lang>/register`.

---

## Drafts

### One per language, not one per problem

The unique key is `(userId, problemId, language)`. Switching from C++ to Python
to sanity-check an idea must not destroy the C++ attempt — that is the one
behaviour a draft feature can get wrong in a way that makes people stop trusting
it.

### The current code is derived, not copied into state

```
local edit  ??  saved draft  ??  the problem's starter code
```

The obvious alternative — fetch the draft, then `setState` in an effect when it
arrives — has a specific failure: it overwrites whatever was typed while the
request was still in flight. Deriving has no such window.

### Autosave

Debounced at 1.2 seconds, upserted rather than inserted, and written straight
into the query cache on success instead of invalidating. Invalidating would
refetch every language's draft on every keystroke pause, for an answer the
response already contained.

A `pagehide` listener flushes a pending edit when the tab closes, because a
1.2-second timer does not survive the page going away.

The indicator says `unsaved` / `saving…` / `saved`, and `not saved` in red when
a save fails. Autosave is invisible when it works, which is exactly when a user
cannot tell whether it works.

---

## The bugs this phase caught

### 1. `prisma migrate dev` does not regenerate the client

This is the same failure that appeared in Phase 2 and was misdiagnosed there as
a mid-write read. It is not. Applying the `Draft` migration succeeded and the
API then failed to typecheck against a `PrismaClient` with no `draft` property,
because `packages/database/generated` — the type source for the whole workspace
— still described the previous schema.

Fixed at the source: `pnpm db:migrate` is now
`prisma migrate dev && prisma generate && tsc -b`, so applying a migration and
publishing the types it implies cannot drift apart. The Phase 2 write-up has
been corrected.

### 2. `AuthModule` exported the guard but not the thing it needs

`EditorModule` imported `AuthModule` for `AccessTokenGuard` and Nest refused to
start:

```
Nest can't resolve dependencies of the AccessTokenGuard (?, ConfigService).
Please make sure that the argument JwtService at index [0] is available in the
EditorModule module.
```

Exporting a provider does not export its dependencies. `AuthModule` now exports
`JwtModule` alongside the guard, so any module that imports it can actually
construct one. This was caught by the e2e suite refusing to boot — the unit
tests and the typechecker both thought it was fine.

---

## What the browser found

Phase 3 was declared done with the editor never once rendered. `pnpm build`,
`pnpm typecheck`, `pnpm lint` and fifty tests all passed against a page that had
two defects a single keystroke would have exposed.

Playwright was installed, seven tests written, and both fell out within an hour.

### 1. The editor ate what you typed

`@monaco-editor/react`'s `value` prop is **controlled**. The parent re-renders on
every keystroke — that is what autosave state does — and each render pushed the
string back into the Monaco model, racing the person typing.

Typing `int cpp_marker = 1;` produced:

```
int r = 1;
```

Characters were dropped mid-word, silently, with no error anywhere. The fix is
to treat Monaco as uncontrolled: `defaultValue` set once per mount, and a `key`
that changes only when the content is legitimately replaced from outside —
switching language, or resetting to starter code.

### 2. Switching language threw away what you had just written

The autosave effect is keyed on `language`, so changing language cancelled the
pending timer — and nothing flushed it. Type a line of C++, switch to Python to
check something, and the C++ was gone. Under a second of work, lost, in the one
feature whose entire purpose is not losing work.

The comment above that code claimed the ref existed "so a language switch can
flush the pending save". It did not. The comment described an intention; the code
never had it.

`useDrafts` now saves the language you are leaving, immediately, on switch.

### Two test bugs worth recording

Both looked like product bugs first.

**`/saved/i` also matches `unsaved`.** The assertion waiting for the save
indicator passed instantly, on the *unsaved* state, before anything had been
written. It is now an exact match.

**A fresh browser context per test signed itself out.** Each context replayed the
same stored refresh cookie; the token rotates on use, and replaying a rotated one
is treated as theft and revokes the chain. The first test passed and every test
after it landed on the login page. That is the Phase 1 reuse detection working
exactly as designed — so the suite uses one context and runs serially.

There is also one account per run rather than one per test, because signing up
six times trips the register rate limiter, which is likewise correct.

**The saved session was captured mid-rotation.** The setup project wrote the
cookie jar to disk while `SessionGate`'s refresh call was still in flight, so
roughly one run in three saved a token the server had already consumed. Every
test then failed on the login page, intermittently, which reads like a broken
page and is not. The setup now waits for the refresh *response* before capturing
state. Two consecutive clean runs.

This one is worth remembering beyond the test suite: **rotating credentials and
snapshotted state do not mix**. Anything that stores a session for later reuse —
a fixture, a cached login, a saved cURL — has the same failure.

---

## Browser tests

```bash
pnpm dev                       # api + web must be running
pnpm --filter @guruji/web test:e2e
```

Seven tests, one worker, serial:

| Test | What it proves |
|---|---|
| Monaco renders | the editor paints, with no CSP violation and no page error |
| No CDN | every request during a page load stays on our own origin |
| Split resizes | the divider works **from the keyboard**, not only by dragging |
| The exit criterion | type, switch language, reload — both languages survive |
| Test panel | samples show, custom input accepts text |
| Preferences persist | font size survives a reload |

They expect `pnpm dev` to already be running. Starting the whole stack per run
is slower and less reliable than reusing the one on screen.

## Running it yourself

```bash
pnpm infra:up
pnpm db:migrate        # applies 20260919083338_phase3_drafts
pnpm dev
```

Open a problem, type, switch language, reload.

> Note: the API dev server was restarted during this phase because rebuilding
> `packages/database` while it is watching kills it. If `/api/health` does not
> answer, restart `pnpm dev`.

---

## Gate 3 — the finish line

| Check | Result |
|---|---|
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm build` | clean, 8 routes |
| `pnpm test` | 50 passed (45 API, 5 database) |
| `test:e2e` | 7 passed in Chromium |
| TS language service in bundle | absent |
| Requests leaving our origin | none |
| Drafts in Postgres after the run | both languages, byte for byte |

---

## What comes next

**Phase 4 — Code runner.** The highest-risk phase in the project, and the one
whose exit criteria do not get waived. The Phase 1 spike already found the defect
that matters: killing the `docker run` client does not kill the container. The
worker runs detached and kills by id.
