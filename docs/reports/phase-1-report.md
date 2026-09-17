# Gate 1 report: backend foundation

Date: 2026-09-17. Branch: **staging/clerk-auth**, rebased onto `main` at **1d7d81f**.

**Status: ready for owner review. Gate 1's criteria are met locally but NOT in staging.**
Nothing is provisioned, deployed or sent, and no money was spent. Stop here: no Phase 2 work and no consent UI.

## 0. Why this report replaces Astra's

Astra's Gate 1 report described a `worker/` built in Astra's own cloud workspace
(rebased commit f8fd8b3). That code was never pushed, and the workspace was lost
when Astra's credits ran out. Only the report reached the repository, as
`docs/phase-1-report (1).md` on `main`. It has been removed from `main` (commit
fe2f793, not yet pushed).

Phase 1 was rebuilt on the owner's machine, with doc 11 and Astra's report as
the spec and every change from the Gate 1 review included. The
`docs/reports/phase-0-eval/` files Astra recovered are lost too. They were
historical offline evaluation files, superseded by the doc 11 item-id contract,
so they weren't recreated.

## 1. Built

- **Rebase (review item 2).** The Clerk commit 2a1f0c7 was rebased onto 1d7d81f
  without a merge. The only remaining `design-pdfs` mention is a `git show 2c60e43:…`
  instruction in `docs/specs/README.md`, which correctly reads the old path from an old commit.
  No path points to `docs/design-html/`.
- **`worker/`:** strict TypeScript and locked dependencies. It serves `frontend/dist` as
  assets with `run_worker_first: ["/api/*"]` and SPA fallback. Worker names are
  `fan-director-studio-development` (local) and `fan-director-studio-staging`.
  D1 ids and origins are placeholders; `scripts/staging-guard.mjs` blocks a deploy
  until they're replaced and checks that the AI and adult switches are `"false"`.
  Observability is off, because unsubscribe tokens travel in URLs.
- **`migrations/0001_foundation.sql`** holds the 11 doc 11 tables (`creator`, `catalog`,
  `catalog_version`, `fan_session`, `draft`, `ai_request`, `audit_event`,
  `compliance_status`, `performer`, `safety_case`, `marketing_consent`) plus the
  approved `fan`, `consent_wording` and `consent_onboarding`. It has foreign keys and
  creator, owner, status and time indexes. Triggers make published catalog content,
  consent wording, consent history and audit events immutable. Compliance flags
  default to false, and `performer.is_synthetic` must be 1.
- **Auth (`src/auth.ts`):** bearer tokens only, never the `__session` cookie. RS256
  signature, `exp`/`nbf`, issuer, `azp`, `v: 2`, no `act`, and `sts` absent or active.
  Fans are created on first sight; suspended and closed fans get no data. Creators need an
  owner-linked `active` row, TOTP enrolled, and `fva[1] >= 0` (Clerk's docs:
  `-1` = never verified).
- **Drafts (`src/drafts.ts`):** DraftV2 save and reload scoped to the fan **and** the
  creator's boutique, with an atomic `expectedRevision`. Payloads are strict: prices,
  quotes, tenant ids and boundary flags are rejected. The catalog version must be that
  creator's published version and can't change. Unknown, hidden and adult items and
  out-of-range quantities are rejected. Responses say `validation: "pending_phase_2"`.
- **Consent (`src/consent.ts`):** the one-time step after sign-up, and settings.
  The email is Clerk's verified primary address and the wording is stored by version.
  A skip writes no consent row. A second answer is refused. Success is returned only after the row is written.
- **Unsubscribe (`src/unsubscribe.ts`):** see §4.
- **Tests:** 79 in `worker/test/`, with real RS256 tokens and real local D1; only
  Clerk's Backend API is faked.
- **Scripts and docs:** `scan-bundle.mjs`, `smoke.mjs`, and `worker/README.md` with the API,
  provisioning steps and the staging checklist.

Endpoints:

| Method | Path |
| --- | --- |
| GET | `/api/health` |
| POST | `/api/browse-session` |
| GET | `/api/session` |
| GET | `/api/creator/me` |
| GET, PUT | `/api/creators/:creatorId/drafts/:draftId` |
| GET, POST | `/api/creators/:creatorId/consent` |
| POST | `/api/creators/:creatorId/consent-onboarding` |
| GET, POST | `/api/unsubscribe/:token` |

Changes from Astra's endpoint list:

- Drafts moved under `/api/creators/:creatorId/` so the tenant is explicit.
- `GET /api/creator/drafts/:id` is removed (§5).
- `POST /api/creators/:creatorId/unsubscribe-link` is removed. Tokens are
  issued only by `issueUnsubscribeToken()` for the future sender, so there is
  no HTTP surface for minting them.

## 2. Verification (owner's machine, 2026-09-17)

Commands run in a clean worktree of the branch:

| Command | Result |
| --- | --- |
| `npm run typecheck --prefix worker` | Passed |
| `npm test --prefix worker` | **79/79 passed**, 4 files |
| `npm test --prefix frontend` | **67/67 passed**, 2 files |
| `npm run lint --prefix frontend` | Passed, exit 0, no diagnostics |
| `npm run build --prefix frontend` | Passed |
| `npm run test:e2e --prefix frontend` | **24/24 passed** (run on port 5174 because 5173 was in use) |
| `wrangler d1 migrations apply DB --local` | Applied, 40 commands |
| `wrangler deploy --env staging --dry-run` | Passed; assets and staging bindings resolved; AI and adult switches `"false"`; **not deployed** |
| `node worker/scripts/staging-guard.mjs` | Blocks as intended: placeholder D1 id, origin and issuer |
| `node worker/scripts/scan-bundle.mjs` | 5 files, no secret signatures. No real secret values exist on this machine to compare |
| `wrangler dev` + `node worker/scripts/smoke.mjs` | 7/7 ok |
| `wrangler dev`, real signed token | GET, GET → `confirm`; POST → `done`; POST, GET → `already_unsubscribed`. D1 had exactly one `unsubscribed` row with `unsubscribe_page` |

The mutation checks passed:

- Removing the signature check made 3 tests fail.
- Making GET write made 2 tests fail.

Both changes were reverted.

**Local environment notes:**

- Wrangler's local D1 fails with "internal error" when the state path passes
  Windows' 260-character limit. The deep worktree path triggered it, and
  `--persist-to` with a shorter path fixed it.
- Astra's `uv_interface_addresses` failure did not happen here.

## 3. Gate 1 completion criteria

| Criterion | Status |
| --- | --- |
| Two test creators cannot read each other's drafts | **Met locally.** Drafts are scoped to the creator's boutique: creator A's draft is 404 under creator B, and two creator identities get 404. Not yet in staging |
| One fan cannot read another's draft by guessing its id | **Met locally.** GET, update and create-overwrite all return 404 with no data, and the owner's draft is unchanged |
| Save and reload works in staging | **NOT MET.** Passes against local D1; staging isn't provisioned |
| Every existing test still passes | **Met on this machine:** 67 unit + 24 browser tests, lint and build |
| Auth as approved | **Partly met.** Worker enforcement is tested. Clerk instance settings (email link only, TOTP, SMS off) are unverified |
| Consent and signed unsubscribe | **Met locally** with fixture wording. Real wording and a real Clerk email lookup are pending |
| No backend secrets in the frontend bundle | **Met for the signatures.** A value comparison needs the owner's real secrets |

## 4. Unsubscribe (review items 4 and 5)

**GET never changes consent.** `GET /api/unsubscribe/:token` checks the token and
returns `confirm`, `already_unsubscribed` or `invalid` (design 23 U1, U4, U3). It
performs no write. **POST** appends one `unsubscribed` row with
`source: 'unsubscribe_page'`, copying the email and wording version of the
current grant. It returns `done`, or `already_unsubscribed` if there is nothing
to withdraw. A failed write returns `503 unsubscribe_failed` (U5). The insert is a
single conditional statement, so two presses write one row. POST also requires a
same-origin `Origin`. Tests show GET, repeated GET, GET with a bad token, and
other methods all write nothing.

**The token is HMAC-signed, not a random id.**

- **Format:** `v1.<payload>.<signature>`, base64url. The payload is
  `{"f": fanId, "c": creatorId, "t": issuedAtSeconds}`, with no email.
- **Signature:** HMAC-SHA256 over the ASCII string `v1.<payload>`.
- **Secret:** a Worker secret, `UNSUBSCRIBE_SIGNING_KEY`, of 32+ random bytes in base64. In staging it is
  set **only** with `wrangler secret put UNSUBSCRIBE_SIGNING_KEY --env staging`.
  Locally it lives in the gitignored `worker/.dev.vars`. It's listed in
  `secrets.required` and appears nowhere in `wrangler.jsonc` or the repository.
- **Rejecting an altered token:** before any database read, the Worker checks:
  - exactly three parts;
  - the version is `v1`;
  - canonical base64url, with no padding or alternative encodings;
  - a 32-byte signature.

  Then `crypto.subtle.verify` (constant time) checks the signature. Any change to
  the payload, the signature or the version, or a key other than the Worker's,
  fails verification and returns `{ "state": "invalid" }`, the same response for
  every failure. It never names a fan or creator. A validly signed token for a
  creator that doesn't exist is also `invalid`. Tests cover a forged payload (which
  would unsubscribe another fan), a changed signature, a different key, and
  truncated, re-versioned and padded tokens.
- **Rotation:** the `v1` prefix lets a second key be accepted during a changeover.

**One behaviour differs from Astra's report, for the owner to confirm.** Astra
bound a token to one grant, so an old link couldn't withdraw a later
resubscription. This rebuild binds the token to the fan and creator, so **any
unsubscribe link means "stop" for that pair**, including after a resubscription.
Reasons:

- A fan who presses Unsubscribe in any of their news emails wants the news to stop.
- Unsubscribe links are expected to keep working for emails already sent.
- Design 23's U2 and U4 offer "Subscribe again" on the same page, which implies
  the link stays usable.

The risk is small: someone with a forwarded email could turn a fan's news off,
but never on.

## 5. `GET /api/creator/drafts/:id` (review item 6)

**Removed.** In Phase 1 there is no such thing as a creator-owned draft. Drafts
belong to fans and are scoped to one creator's boutique. Astra's route returned a
draft saved by the creator's own identity acting as a fan in their own boutique.
It existed only to test "two creators cannot read each other's drafts". That
criterion is now tested as tenant isolation on the fan draft routes:

- a draft saved in creator A's boutique is 404 through creator B's path;
- each creator's identity gets 404 for the other's boutique draft;
- another creator's catalog version is rejected.

`GET /api/creator/me` remains, so the TOTP and `fva` enforcement is tested on a
real creator route. Creator review of submitted cards is Phase 4.

## 6. Sign-up detection (review item 7)

The step shows only if all of these hold:

- the session is the user's only live session;
- the session's `created_at` is within 60 seconds of the user's `created_at`;
- no `consent_onboarding` row exists;
- a consent wording version exists.

Any Clerk error, or any doubt, means "not a first sign-up": no step and no consent write,
with settings still available. Tests cover 2 seconds (shown), 61 seconds and 2 hours
(not shown), a second live session, a Clerk outage, and two tabs.
`worker/README.md`'s staging checklist asks the owner to record Clerk's real
user and session `created_at` for a first sign-up and for an ordinary sign-in.

## 7. Designs

The post-sign-up consent step and its states (A–A6) and the unsubscribe page
(U1–U5) are drawn in **design 23**
(`docs/designs/html/23-news-consent-step.html`). It **awaits the owner's review**,
including its wording. No UI for it was built. The endpoints return the states
design 23 needs. Its "Subscribe again" button (U2, U4) has no endpoint yet; that
waits for design approval. Creator authenticator enrolment routing will follow
the approved design 16 when frontend integration resumes.

## 8. Owner setup still needed

All of it follows `worker/README.md` ("Owner provisioning" and "Staging checklist"):

- Wrangler login, D1 databases, real origins and issuer.
- The three secrets, set with `wrangler secret put`.
- Remote migrations, then the staging deploy.
- Clerk settings: email-link-only fans, TOTP with backup codes for creators, SMS off.
  Pro is needed before live creators, and written confirmation from Clerk is a launch item.
- Approve design 23's wording, then insert it as a `consent_wording` version.
- Run the staging checklist, including the sign-up timestamps, and record the results
  before approving Gate 1.

## 9. Cost and release state

- AI and provider calls: **0**. No email was sent and no plan was bought.
- No remote Cloudflare or Clerk resources were used.
- The AI and adult-catalog switches are off.
- The branch is pushed, not merged. **Stop at Gate 1; don't start Phase 2.**
