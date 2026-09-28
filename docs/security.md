# GuruJi — Security

> Last updated: 2026-09-28 (Phase 12 review)

Sandbox specifics live in [code-execution.md](./code-execution.md); prompt
security lives in [ai.md](./ai.md). This document covers everything else and
states the overall posture.

---

## Threat model

What an attacker would actually try, in the order the risk deserves attention:

| # | Threat | Primary defence |
|---|---|---|
| 1 | Run malicious code on our infrastructure | Sandbox — [code-execution.md](./code-execution.md) |
| 2 | Read or modify another user's data | Ownership enforced in every query |
| 3 | Extract the system prompt or manipulate the mentor | Prompt layering, server-side context — [ai.md](./ai.md) |
| 4 | Steal credentials or session tokens | Argon2id, httpOnly cookies, token rotation |
| 5 | Exhaust our AI budget | Per-user rate limits and token budgets |
| 6 | Enumerate accounts | Uniform auth responses, uniform timing |
| 7 | Denial of service | Rate limits, queue backpressure, bounded queries |

Threat 1 dominates because it is the only one where a successful attack reaches
the host. It gets its own document and its own CI gate.

---

## Authentication

**Passwords.** Argon2id — memory cost 19456 KiB, time cost 2, parallelism 1,
per OWASP's current guidance. Minimum 12 characters, checked against a
common-password list: the NCSC 100k list, keeping the ~1,250 entries of 12+
characters, compared case-insensitively, on the server only
(`apps/api/src/auth/common-passwords.ts`, error `PASSWORD_TOO_COMMON`). Length
over composition rules: forced symbol requirements produce `Password1!` and
nothing else.

**Sessions.** Short-lived access JWT (15 min) plus a long-lived refresh token
(30 days) in an httpOnly, `Secure`, `SameSite=Strict` cookie.

The access token being short-lived is what makes a leaked one survivable. The
refresh token never touches JavaScript, which is what makes XSS not an instant
account takeover.

**Rotation and reuse detection.** Every refresh issues a new refresh token and
marks the old one replaced. Presenting an already-rotated token means it was
stolen — the entire token chain is revoked and the user is logged out
everywhere. This is the single highest-value auth control we have.

Refresh tokens are stored hashed. A database read must not yield usable
sessions.

**Login responses are uniform.** Unknown email and wrong password return the
same message, the same status and, as far as practical, the same timing.
Distinguishing them turns the endpoint into an account-enumeration oracle. The
timing holds because an unknown email is verified against a hash made at start-up
at the *configured* Argon2 cost — a hash hard-coded at one cost would drift the
moment `ARGON2_*` changed.

**Accepted risk — registration reveals a taken email.** `POST /auth/register`
answers `409 EMAIL_ALREADY_REGISTERED`. Closing this needs email verification
(answer "check your inbox" either way), which does not exist yet. Until then it
is bounded by the 5-per-15-minutes limit on the route, per IP and per email. It
is on the list below of things to settle before any public deployment.

---

## Authorisation

Two rules, no exceptions:

1. **`userId` always comes from the verified token** — never from a body, query
   or path parameter. An endpoint that accepts a client-supplied `userId` is a
   bug, regardless of what guard sits in front of it.
2. **Ownership is a `WHERE` clause, not an `if` statement.**

```ts
// correct — non-owned rows are simply not found
await prisma.submission.findFirst({ where: { id, userId } })

// wrong — leaks existence, and one missed branch is a data breach
const s = await prisma.submission.findUnique({ where: { id } })
if (s.userId !== userId) throw new ForbiddenException()
```

The second form is not merely less tidy: it distinguishes "does not exist" from
"not yours" through error type and timing, and every new call site is a fresh
chance to forget the check.

Admin routes are guarded by role *and* re-checked in the service layer. A guard
is a filter, not a proof.

---

## Input validation

Every endpoint validates at the edge, before any business logic:

- `class-validator` DTOs with explicit types and bounds
- `whitelist: true` and `forbidNonWhitelisted: true` — unknown properties are
  rejected, not silently dropped, so a mass-assignment attempt fails loudly
- Zod at the `packages/types` boundary, shared with the client. Request schemas
  parsed with Zod instead of a DTO are `.strict()`, so they refuse unknown
  fields the same way

Specific caps that matter:

| Input | Cap | Why |
|---|---|---|
| Submitted code | 64 KB | Storage and compile-bomb bound |
| AI message (every free-text field sent to the mentor) | 4,000 characters | Context-flooding and cost defence |
| Code sent to the mentor | 64 KB, the submission cap | Code is code, not a message |
| Analytics date range | 366 days | An unbounded range asks for the whole table |
| Page size | 50 | Prevents "give me everything" |
| Mistake journal note | 4,000 characters | Ordinary abuse bound |
| Any JSON body | 100 KB (8 MB for the runner's own callback) | Bounds every handler before validation |

---

## Injection

**SQL.** Prisma parameterises everything. `$queryRaw` requires a documented
justification at review, and interpolated raw SQL is rejected outright — use
`$queryRaw` tagged templates, never string concatenation.

**XSS.** React escapes by default. `dangerouslySetInnerHTML` appears in exactly
one place: rendering problem statements and AI explanations from Markdown. That
path sanitises with an allow-list — no `<script>`, no `<iframe>`, no event
handler attributes, no `javascript:` URLs. User-authored content (mistake
journal notes) is rendered as plain text.

**CSRF.** The API is token-authenticated with `SameSite=Strict` cookies for
refresh only, and CORS is an explicit origin allow-list — no wildcard, no
origin reflection. `SameSite=Strict` is what stops a cross-site request from
rotating a session: the browser does not send the cookie on one.

(An earlier version of this document said the refresh endpoint also requires the
access token. It does not, and it should not: refresh exists for the moment the
access token has expired, and demanding it would break exactly that.)

---

## Secrets

| Rule | Detail |
|---|---|
| No secret is ever `NEXT_PUBLIC_*` | That prefix ships the value to every browser. `GROQ_API_KEY` in particular is server-only, always |
| `.env` is git-ignored; `.env.example` documents every variable | With placeholders, never real values |
| Production secrets come from a secret manager | Not from plain environment variables on the host |
| Rotation is possible without a code change | Every secret is read from config, never hard-coded |

The Groq key exists only in the API process. The browser calls our API; our API
calls Groq. A key that reaches the client is a key that is already public.

---

## Rate limiting

Backed by Redis so limits hold across API instances.

| Scope | Limit | Protects |
|---|---|---|
| Global per IP | 100 / min, every route (`RATE_LIMIT_GLOBAL_PER_MINUTE`) | Baseline. Health check and the runner callback are exempt |
| Login / register | 5 / 15 min, per IP **and** per email | Credential stuffing |
| `POST /submissions` | 10 / min per user | Execution capacity |
| `/ai/*` | 20 / min per user + daily token budget | Cost |
| Password reset | 3 / hour per email, when it exists | Enumeration and spam — there is no reset flow yet |

AI and submission limits are **per user**, not per IP. Per-IP limits are
trivially defeated and would punish shared networks while missing the actual
abuse case, which is one authenticated account in a loop.

Behind a reverse proxy, `request.ip` is the proxy unless Express is configured
with `trust proxy`; without it every user shares one per-IP bucket. Set it at
deploy time.

---

## Transport and headers

HTTPS everywhere; HSTS in production. Helmet sets the standard headers, with a
Content-Security-Policy tight enough to be worth having:

- `default-src 'self'`
- `script-src` without `unsafe-eval` — **Monaco is configured to avoid it**;
  a CSP that permits `unsafe-eval` because one library is easier that way is not
  a CSP
- `frame-ancestors 'none'`
- `connect-src` limited to our API and WebSocket origins

---

## Logging

Structured JSON with a correlation id per request.

**Never logged:** passwords or hashes, access or refresh tokens, the Groq key,
full submitted code as a matter of routine (only on an explicit debug flag, in
non-production), or raw AI conversation content.

Errors are logged with full detail server-side and returned to the client as a
stable error code plus a generic message. A stack trace, an ORM error or a
provider message in an HTTP response is free reconnaissance.

---

## Dependencies

`pnpm audit` in CI — **there is no CI yet**; until there is, run it by hand
before a release. Lockfile committed and installs are `--frozen-lockfile`.

Transitive advisories are patched with `overrides` in `pnpm-workspace.yaml`,
staying within each package's major version. One is accepted: `deepmerge-ts`
inside the Prisma CLI, pinned exactly by Prisma, whose advisory needs
attacker-controlled input to merge — it only ever merges Prisma's own config.
pnpm v10 blocks post-install scripts by default; the allow-list in
`pnpm-workspace.yaml` is short, and adding to it requires a reason — an
arbitrary post-install script is code execution on every developer's machine and
in CI.

---

## Before any public deployment

Not required for local development; required before exposure, and listed so
they are decisions rather than omissions:

- A CI pipeline: build, tests, `pnpm audit`, `--frozen-lockfile`
- HSTS on the web app (the API sets it through Helmet; Next does not)
- `trust proxy` set for the real deployment topology
- Stronger sandbox isolation (gVisor / Firecracker) and dedicated execution hosts
- Secret manager wired up; no secrets in host environment variables
- Email verification enforced before submission privileges — which also closes
  the registration enumeration above
- Automated dependency scanning on a schedule, not just on push
- A written incident response path — who is paged, how a user is notified
- An external review of the sandbox specifically, because it is the one
  component where being wrong is not recoverable
