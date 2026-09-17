# Staging Worker (Phase 1)

The backend foundation from doc 11 §8 Phase 1: a Cloudflare Worker that serves
the built frontend and runs a small API under `/api/*`, with D1 for storage and
Clerk for sign-in.

It is **staging only**. The public demo at `fan-director-studio.*.workers.dev`
uses `frontend/wrangler.jsonc` and is not affected. The AI and adult-catalog
switches are off, no email is sent, and nothing here costs money until the owner
provisions it.

## Layout

| Path | What it is |
| --- | --- |
| `wrangler.jsonc` | Local development (top level) and `--env staging`. Database ids and origins are placeholders |
| `migrations/0001_foundation.sql` | All Phase 1 tables, indexes and append-only triggers |
| `src/index.ts` | Routing, same-origin check on writes, safe errors, the browse-session cookie |
| `src/auth.ts` | Clerk session verification, fan and creator identity, first-sign-up detection |
| `src/clerk.ts` | The few Clerk Backend API calls the Worker makes |
| `src/drafts.ts`, `src/validation.ts` | Owner-scoped DraftV2 save and reload |
| `src/consent.ts` | News consent: the one-time step after sign-up, and settings |
| `src/unsubscribe.ts` | Signed unsubscribe token; read-only GET, writing POST |
| `test/` | 79 tests: real RS256 tokens and real local D1; only Clerk's Backend API is faked |
| `scripts/staging-guard.mjs` | Blocks a staging deploy while placeholders remain or a switch is on |
| `scripts/scan-bundle.mjs` | Scans `frontend/dist` for secret signatures and, if set in the environment, secret values |
| `scripts/smoke.mjs` | Read-only checks against a running Worker |

## Commands

From the repository root:

```sh
npm ci --prefix worker
npm run typecheck --prefix worker
npm test --prefix worker
npm run build --prefix frontend && node worker/scripts/scan-bundle.mjs
```

Local run (needs `worker/.dev.vars`; copy `worker/dev.vars.example`):

```sh
cd worker
npx wrangler d1 migrations apply DB --local
npx wrangler dev --port 8787
node scripts/smoke.mjs http://localhost:8787
```

## API

Every response is JSON with `Cache-Control: no-store, private`. Errors are
`{ "error": "<code>" }` with a stable code and nothing echoed from the request.
Every `POST`/`PUT` must carry `Origin` equal to `APP_ORIGIN`, otherwise `403 cross_origin`.
Signed-in routes need `Authorization: Bearer <Clerk session token>`; cookies are never read for sign-in.

| Method | Path | Who | Result |
| --- | --- | --- | --- |
| GET | `/api/health` | anyone | `{ ok: true }` |
| POST | `/api/browse-session` | anyone | Sets an opaque `fds_browse` cookie for signed-out browsing. It authenticates nothing |
| GET | `/api/session` | fan | `{ signedIn: true, fanId }` |
| GET | `/api/creator/me` | creator | `{ creatorId, displayName }` |
| GET | `/api/creators/:creatorId/drafts/:draftId` | fan | The fan's own draft in that boutique, or `404 not_found` |
| PUT | `/api/creators/:creatorId/drafts/:draftId` | fan | Create (`expectedRevision: 0`) or update. `409 revision_conflict` returns `current` |
| GET | `/api/creators/:creatorId/consent` | fan | `{ status: 'subscribed' \| 'unsubscribed' \| 'none', wording, onboarding: { show } }` |
| POST | `/api/creators/:creatorId/consent` | fan | Settings: `{ status: 'subscribed', wordingVersion }` or `{ status: 'unsubscribed' }` |
| POST | `/api/creators/:creatorId/consent-onboarding` | fan | The step after sign-up: `{ choice: 'subscribe', wordingVersion }` or `{ choice: 'skip' }` |
| GET | `/api/unsubscribe/:token` | anyone | Read-only: `{ state: 'confirm' \| 'already_unsubscribed' \| 'invalid', creatorName? }` |
| POST | `/api/unsubscribe/:token` | anyone | Writes the withdrawal: `{ state: 'done' \| 'already_unsubscribed' \| 'invalid' }`; `503 unsubscribe_failed` if the write fails |

There is no route that submits, sends email, calls an AI model, issues
unsubscribe tokens or shows drafts to creators. Creator review of submitted
cards is Phase 4.

### Draft PUT body

```json
{
  "expectedRevision": 0,
  "catalogVersionId": "cv_…",
  "draft": {
    "selections": [{ "itemId": "…", "qty": 1 }],
    "fanDisplayName": null,
    "customRequest": null,
    "fanScript": null,
    "notes": [{ "id": 1, "text": "…" }],
    "budget": null
  }
}
```

All six draft fields are required, and any other key is rejected (`400
invalid_draft`), so the browser can't send prices, quotes, revisions, tenant
ids or boundary flags. The catalog version must be a published version of that
creator's catalog (`422 catalog_version_mismatch`), and it can't change on
update. Unknown items, hidden items or categories, adult items (the switch is
off) and quantities outside an item's limits give `422 selection_rejected`.
Bodies over 32 KB give `413`.

Responses carry `validation: "pending_phase_2"` and `boundaryFlags: null`:
category limits, requires/excludes, the rules layer and quotes are Phase 2.

### Auth rules

- The token must verify against `CLERK_JWT_KEY` (RS256 only), with issuer
  `CLERK_ISSUER`, `azp` in `CLERK_AUTHORIZED_PARTIES`, `v: 2`, valid
  `exp`/`nbf`, no `act` (impersonation), and `sts` absent or `active`.
- **Fans** are created on first sight. A suspended fan gets `403 account_paused`;
  a closed fan gets `403 account_closed`.
- **Creators** must have an `active` row in `creator` linked to their Clerk user
  id (the owner does this when inviting), an authenticator app enrolled
  (`totp_enabled`), and a second factor verified in this session (`fva[1] >= 0`;
  Clerk uses `-1` for "never"). Otherwise the result is `403 second_factor_required`
  (with `enrol: true` if TOTP isn't set up) or `403 not_a_creator`.

### News consent

- Each grant or withdrawal appends a row. Triggers block updates and deletes.
- The email is Clerk's **verified primary** address from the Backend API. If it
  isn't verified: `409 email_not_verified`, and no row is written.
- The browser sends only the wording **version**. An unknown version gives
  `422 unknown_wording`. No real wording exists until the owner approves design
  23's copy and inserts it (see below), so grants fail until then.
- **The one-time step** shows only when all of these hold: wording exists, the fan hasn't
  answered, and `isFirstSignUp` says this is straight after a first sign-up.
  Skipping writes no consent row. A second answer gives `409 already_answered`.
- **Settings** withdrawals don't depend on Clerk: they copy the email and
  wording version from the current grant.

### Unsubscribe token

`v1.<payload>.<signature>`, base64url, where the payload is
`{"f": fanId, "c": creatorId, "t": issuedAtSeconds}` and the signature is
HMAC-SHA256 over `v1.<payload>` with the Worker secret `UNSUBSCRIBE_SIGNING_KEY`.

- The format, version, canonical base64url and the 32-byte signature are checked,
  using `crypto.subtle.verify`, **before any database read**. A failure gives
  `invalid`, with the same response for every kind of failure.
- There's no email in the token and no expiry, because links in old emails must keep working.
- A link means "stop": it withdraws whatever is current for that fan and
  creator, including a later resubscription.
- **GET never writes** (mail scanners open links). **POST** writes one row with
  `source: 'unsubscribe_page'` in a single conditional statement, so two presses
  can't write two rows.
- Tokens are made by `issueUnsubscribeToken()` for the future sender. RFC 8058
  `List-Unsubscribe-Post` belongs to the sending spec.
- Rotating the key: add a `v2` key and accept both during the changeover.

## Owner provisioning (staging)

Nothing below has been done. Each step needs the owner's Cloudflare or Clerk account.

1. **Wrangler login:** `npx wrangler login`, then `npx wrangler whoami`.
2. **D1:** `npx wrangler d1 create fan-director-staging` (and `fan-director-development`
   if wanted). Put each id into `wrangler.jsonc`.
3. **Origins:** set staging `APP_ORIGIN` and `CLERK_AUTHORIZED_PARTIES` to the
   staging URL, and `CLERK_ISSUER` to the Clerk instance's Frontend API URL.
4. **Secrets**, only ever with `wrangler secret put`, never in files:
   ```sh
   npx wrangler secret put CLERK_JWT_KEY --env staging
   npx wrangler secret put CLERK_SECRET_KEY --env staging
   npx wrangler secret put UNSUBSCRIBE_SIGNING_KEY --env staging
   ```
5. **Migrate:** `npx wrangler d1 migrations apply DB --env staging --remote`.
6. **Build and deploy:** `npm run build --prefix frontend`, then
   `npm run deploy:staging --prefix worker` (runs the guard first).
7. **Invite a synthetic test creator:** insert a `creator` row with `status = 'active'`
   and its Clerk user id, plus its `catalog` and a published `catalog_version`.

## Staging checklist (Gate 1)

Record the date and result of each item in the Gate 1 report.

**Clerk instance settings**
- [ ] Fans: sign-in by **email link only**. No password, no SMS, no social sign-in.
- [ ] Creators: **authenticator app (TOTP)** with backup codes. **SMS second factor off.**
      (`fva` shows how recently a second factor was verified, not which one, so SMS must be disabled in the instance.)
- [ ] Application name, sender name and email templates contain nothing explicit.
- [ ] Session token version is 2 (`v: 2`).

**Sign-up detection (the 60-second check)**
- [ ] Create a **new** fan account from a creator's boutique. In the Clerk Dashboard (or
      `GET /v1/users/{id}` and `GET /v1/sessions?user_id=…`), write down the user's
      `created_at` and the session's `created_at`. They must be within 60 seconds,
      and `GET /api/creators/:id/consent` must return `onboarding.show: true`.
- [ ] Sign out, then sign that fan **in again** by email link. Write down the new session's
      `created_at`. `onboarding.show` must be `false`.
- [ ] If the real gap after a first sign-up is ever over 60 seconds (for example a slow
      email-link verification), the step won't show. That's the safe failure: report
      the numbers rather than widening the window without an owner decision.

**Auth and isolation**
- [ ] A creator without TOTP gets `403 second_factor_required` from `/api/creator/me`.
- [ ] A creator with TOTP gets their profile after entering the code.
- [ ] Two test fans: fan B gets `404` for fan A's draft id; save and reload works for fan A.
- [ ] Two test creators: a draft in creator A's boutique is `404` under creator B.

**Consent and unsubscribe**
- [ ] Insert the approved wording (label **and** helper text) as a new `consent_wording` version.
- [ ] Subscribe from the one-time step; check the row has the verified email, `source: signup`, IP and user agent.
- [ ] Open an unsubscribe link with GET (a browser address bar or `curl`): **no new row**.
- [ ] POST it: exactly one `unsubscribed` row with `source: unsubscribe_page`.

**Bundle and smoke**
- [ ] `node worker/scripts/scan-bundle.mjs` with the real secret values in the environment: clean.
- [ ] `node worker/scripts/smoke.mjs https://<staging-url>`: all ok.
- [ ] `npm run test:e2e --prefix frontend`: 24/24.
