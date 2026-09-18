# Gate 1 report — backend foundation

Date: 2026-09-17. Base: `main` at **dc86106**. Branch: **staging/clerk-auth**.

**Status: GATE 1 APPROVED by the owner on 2026-09-18.** Staging is deployed and verified, with six of seven criteria met there. The seventh ("auth as approved") was approved with a follow-up: the owner will change the remaining Clerk settings later (password off, Google off, email link instead of code, backup codes on; §0.3). The authenticator app and SMS settings are confirmed correct by the owner. Phase 2 has not started and needs its own go-ahead.

Sections 1–7 below are the original rebuild report of 2026-09-17, kept as written. Where they conflict with §0, §0 is current. In particular, §1's endpoint table predates the Gate 1 review: drafts now live at `/api/creators/:creatorId/drafts/:id`, and the creator draft route and the unsubscribe-link route were removed (doc 11 §5.6 item 18).

## 0. Staging verification (2026-09-18)

**Environment.**
- Site: `https://fan-director-studio-staging.blendly.workers.dev` (Cloudflare account blendly.tech@gmail.com; the public demo is on a different account). Worker version `ad6e2ca4`.
- D1 `fan-director-staging` (`5411bfbd…`), all migrations applied. Secrets `CLERK_JWT_KEY`, `CLERK_SECRET_KEY`, `UNSUBSCRIBE_SIGNING_KEY` set.
- Clerk **development** instance `superb-crawdad-9550`.
- Seeds: `staging-synthetic.sql` (creators `cr_staging_a`/`cr_staging_b`, bound to real Clerk test users) and `consent-wording-v1.sql` (`news-v1`, design 23 as approved).

**Method.** `worker/scripts/staging-checklist.mjs` drove each scenario in a real Chromium window against the deployed site. Every API call used a fresh Clerk session token as a bearer header, with no cookies.
- Sessions came from **Clerk sign-in tickets** (`--as`, development key only), because no emailed-link sign-in reached the test window.
- These are genuine Clerk sessions that the Worker verified end to end. They prove the Worker's behaviour, **not** the Clerk sign-in screens.
- Raw results are in the git-ignored `worker/.staging-evidence.json`.
- Test fans: `fan_a+clerk_test@example.com` and `fan_b+clerk_test@example.com`.

### 0.1 Results

| Check | Result |
| --- | --- |
| `smoke.mjs` against staging | 7/7 ok |
| Creator A and creator B, no authenticator: `GET /api/creator/me` | `403 second_factor_required`, `enrol: true`, both |
| Session token | `v: 2`; `azp` = staging origin; `iss` = the Clerk instance |
| Fan A first sign-up (user and session created 0 s apart): news step | `onboarding.show: true`, wording `news-v1` |
| Fan A subscribes, then answers again | `200 subscribed`, then `409 already_answered` |
| **Fan A saves a draft, then reloads it** | **`200`, revision 1, reload identical** |
| Hidden item / `a_minutes` qty 21 | `422 selection_rejected` / `422 selection_rejected` |
| Save with a stale revision | `409 revision_conflict`, current draft returned |
| Fan A's draft id under creator B | `404` |
| Creator A's catalog version used under creator B | `422 catalog_version_mismatch` |
| Fan B reads / writes fan A's draft (twice, on two sign-ins) | `404` / `404`; fan A's draft unchanged afterwards |
| Fan B never answers; first sign-up (0 s gap) | `onboarding.show: true` |
| Fan B signs in again, previous session signed out (78 s gap) | `onboarding.show: false`: the 60-second rule alone hides the step |
| Fan A's second sign-in (26 s gap) | `show: false`, but this is **not** timing evidence: fan A had answered and still had a live session |
| Unsubscribe token for fan A + creator A: GET twice | `confirm` both times; **no row written** (checked in D1) |
| POST twice | `done`, then `already_unsubscribed`; **exactly one** `unsubscribed` row, source `unsubscribe_page` |
| Tampered token | `invalid` |
| Consent rows | Each has the email from Clerk, an IP and the user agent; `source` `signup` then `unsubscribe_page` |
| `scan-bundle.mjs` with the three real secret values in the environment | 5 files, no signatures or values found |
| `npm run test:e2e --prefix frontend` | **24/24** (after pinning the suite to demo mode; see §0.2) |
| `npm test --prefix frontend` / lint / build | 67/67 / clean / ok |
| `npm test --prefix worker` / typecheck | 82/82 / clean |

### 0.2 Found and fixed during verification

- **Staging guard:** it now blocks a deploy when the frontend's publishable key belongs to a different Clerk instance than `CLERK_ISSUER`. That exact mismatch was present, and every sign-in would have failed with 401 (cce8e53).
- **e2e:** a Clerk key in `frontend/.env.local` switched the dev server the suite starts into staging mode, which failed 2 demo-mode tests. `playwright.config.ts` now gives that server an empty key (ef6bad5).
- **Checklist script:** its `--as` option refuses any Clerk key that isn't a development key, because sign-in tickets work on production instances too (d5a8ae8).

### 0.3 Not verified or not met

- **Clerk instance settings differ from the approved ones** (read from the instance's public configuration, 2026-09-18):
  - password is **on and required** (approved: off);
  - Google sign-in is **on** (approved: off);
  - the email first factor is **code**, not link;
  - **backup codes are off**.
  - Correct already: authenticator app on as second factor, SMS off.
  - **Fans on email link only is therefore NOT met.**
- **Creator with an authenticator gets 200:** the owner added and verified an authenticator on creator A and chose not to run this check. Not verified. The Worker's side (it refuses without a second factor) is verified above and covered by unit tests.
- **The real sign-in screens and email-link timing:** not exercised (see Method). Doc 11 §5.6 item 19 already requires re-running the first-sign-up check on the production instance before creators go live.
- **The `CLERK_SECRET_KEY` in use was pasted into a chat transcript.** Replace it and re-upload before anyone real signs up on this instance.

### 0.4 Gate 1 criteria (current)

| Criterion | Status and evidence |
| --- | --- |
| Two creators cannot access each other's drafts | **Met.** No creator draft route exists (removed in the Gate 1 review), and fan drafts are tenant-checked on staging (`404` and `422` above) |
| One fan cannot retrieve another's draft by ID | **Met on staging.** Fan B: `404` on read and write, twice; fan A's draft unchanged |
| Save/reload works in staging | **Met on staging.** Save `200` revision 1; reload identical |
| Every existing test still passes | **Met.** e2e 24/24, unit 67/67, worker 82/82, lint, typecheck, build (2026-09-18) |
| Auth as approved: fan email links; creator authenticator and backup codes | **NOT MET.** The Worker's enforcement is verified on staging; the Clerk settings differ (§0.3) |
| Consent and signed unsubscribe | **Met on staging** with approved wording `news-v1` |
| No backend secrets in the frontend bundle | **Met.** Scan clean against the real values |

## 1. Built and recovered

- Rebased the existing Clerk commit `2a1f0c7` onto `dc86106` without a merge. Its rebased commit is `f8fd8b3`. No new frontend changes were authored; the existing key-gated Clerk controls remain. Public-demo config and disclaimers are unchanged.
- Recovered all ten `docs/reports/phase-0-eval/` files byte-for-byte from `/workspace/scratch/f86120702689/fan_director/`. They are historical offline evaluation artifacts, not the current Phase 3 contract. Their README/schema reflect that earlier phase; Doc 11's item-ID contract now governs future work. No live evaluation was rerun.
- Added `worker/` with locked npm dependencies, strict TypeScript, staging/development Wrangler configurations and API routing before static assets. Worker names: `fan-director-studio-development` and `fan-director-studio-staging`. Real databases have **not** been provisioned; UUIDs are placeholders and the deployment script rejects them. AI and adult-catalog switches are false.
- `worker/migrations/0001_foundation.sql`: `creator`, `catalog`, `catalog_version`, `fan_session`, `draft`, `ai_request`, `audit_event`, `compliance_status`, `performer`, `safety_case`, `marketing_consent`; plus stable `fan` identity mapping, immutable `consent_wording` and one-time `consent_onboarding`. Foreign keys, creator/owner/status/time indexes, immutable published catalog content, append-only consent history, false compliance defaults and synthetic-only performers.
- `worker/src/auth.ts`: Clerk signature/time/issuer/authorized-party/session validation; bearer-only private API; no auth-cookie trust or client metadata authorization. Every creator route checks `fva`, administrator-invited creator identity and actual TOTP enrollment. Email is obtained only from Clerk's verified primary address. Suspended/closed fans cannot access private fan data.
- `worker/src/drafts.ts`: owner-scoped DraftV2 save/reload with atomic revision checks, no tenant/version reassignment, strict payloads, no browser prices or boundary flags, and rejection of hidden, unknown or adult selections. Phase 2 semantic/rules/quote validation is explicitly pending.
- `worker/src/consent.ts`: versioned exact label/helper evidence, optional signup skip, one-time signup completion, settings updates, signed one-click unsubscribe and owner-only token issuance. No email is sent. Replayed links do not add duplicate withdrawals; old grants cannot withdraw a later resubscription.
- `worker/src/index.ts`, `validation.ts`, `types.ts`: route authorization, same-origin mutations, bounded streaming bodies, safe stable errors, no-store/private response headers, anonymous browse-session cookies that cannot authenticate.
- `worker/test/backend.test.ts`: actual RSA-signed JWT checks plus real local D1 SQL; only Clerk Backend API user/session lookup is mocked. `worker/scripts/` contains staging guards, bundle scanning and a compiled-Worker runtime smoke check. `worker/README.md` documents API schemas, endpoint behavior and exact provisioning steps.

Endpoints:

| Method | Path |
| --- | --- |
| GET | `/api/health` |
| POST | `/api/browse-session` |
| GET | `/api/session` |
| GET | `/api/creator/me` |
| GET | `/api/creator/drafts/:id` |
| GET, PUT | `/api/drafts/:id` |
| GET, POST | `/api/creators/:creatorId/consent` |
| POST | `/api/creators/:creatorId/consent-onboarding` |
| POST | `/api/creators/:creatorId/unsubscribe-link` |
| GET, POST | `/api/unsubscribe/:signedToken` |

Creator draft reads expose only that creator identity's **own** draft in their own boutique. They never expose another fan's unsent draft; creator review of submitted cards is Phase 4.

## 2. Verification evidence

Commands below run from the repository root unless stated otherwise.

| Command | Result |
| --- | --- |
| `npm run typecheck --prefix worker` | Passed |
| `npm test --prefix worker` | **53/53 passed**, one test file |
| `npm test --prefix frontend` | **67/67 passed**, two test files |
| `npm run lint --prefix frontend` | Passed, no diagnostics |
| `npm run build --prefix frontend` | Passed, TypeScript + Vite build |
| `npm run test:e2e --prefix frontend` | **Blocked: 24/24 could not launch**, Chromium headless shell v1243 missing; no application assertion executed |
| `npx --prefix frontend playwright install chromium` | Failed after repeated 30-second download timeouts from `cdn.playwright.dev` |
| `worker/node_modules/.bin/wrangler d1 migrations apply DB --local --config worker/wrangler.jsonc` | Migration applied successfully; 32 SQL commands |
| `worker/node_modules/.bin/wrangler deploy --env staging --dry-run --config worker/wrangler.jsonc --outdir dist` | Passed; bundle produced, assets and staging bindings resolved; **not deployed** |
| `node worker/scripts/runtime-smoke.mjs` | Passed: bundled Worker executed in workerd; health 200 and unauthenticated private draft 401 |
| `node worker/scripts/scan-bundle.mjs` | 5 frontend files scanned; no credential signatures or available secret values found |
| `PYTHONPATH=/workspace/scratch/f86120702689/eval-deps python docs/reports/phase-0-eval/check.py --self-test` | 11 offline checks passed; live provider results not run |
| `PYTHONPATH=/workspace/scratch/f86120702689/eval-deps python docs/reports/phase-0-eval/mock_check.py` | 4 hostile outputs rejected; 3 routing/budget checks passed; 0 live calls |
| `worker/node_modules/.bin/wrangler whoami` | Not authenticated |
| `worker/node_modules/.bin/wrangler dev --config worker/wrangler.jsonc --port 8787` | Environment failure: `uv_interface_addresses` system error; local HTTP server did not start |

Backend assertions cover altered/expired/not-yet-valid/wrong-issuer/wrong-origin/pending/impersonated JWTs, cookie-only denial, missing/negative/malformed second factor, noninvited users, missing TOTP enrollment, creator/fan isolation, concurrent revisions, account suspension, body caps, catalog tenant mismatch, selection tampering, primary-email verification/failure, one-time/concurrent signup consent, skipping and ordinary sign-in, immutable evidence, signed-link tampering, replay, later resubscription, and nonexistent send/submission/AI routes.

No real secrets are present in this workspace; therefore the dist scan cannot claim comparison against owner-held credentials. The scanner compares them by value when supplied through backend environment variables, without printing them. Clerk SDK diagnostic strings mentioning secrets are not secret values. No additional UI was built, so new 375/768/1280 visual verification is not applicable; inherited frontend browser regressions remain blocked as above.

## 3. Gate 1 completion criteria

| Criterion | Status and evidence |
| --- | --- |
| Two creators cannot access each other's drafts | **Met locally**: signed identities, TOTP checks and real D1 queries; actual staging identities not verified |
| One fan cannot retrieve another's draft by ID | **Met locally**: read/update/create-overwrite attempts return 404 without data |
| Save/reload works in staging | **NOT MET**: local D1 save/reload and concurrency pass; Cloudflare auth and provisioned staging DB absent |
| Every existing test still passes | **NOT MET in this workspace**: 67 unit tests, lint/build pass; 24 browser tests cannot launch |
| Auth as approved, fan email links and creator authenticator/backup codes | **Partly met**: Worker enforcement is tested; actual Clerk instance settings, email-link delivery, TOTP/backup-code login and Pro availability are **not verified** |
| Consent and signed unsubscribe | **Met locally** with synthetic wording; approved real wording and live Clerk email lookup pending |
| No backend secrets in frontend bundle | **Met for available evidence**, signature scan clean; actual owner credentials unavailable |

## 4. Deviations and limits

1. Deployment/configuration is incomplete because there is no authenticated Cloudflare account, no Clerk secret or issuer setting, and no signing key here. Provisioning commands are in `worker/README.md`. No temporary Cloudflare account or other Worker was used.
2. Clerk `fva` says when factors were verified, not which method was used. The Worker checks nonnegative second-factor age and TOTP enrollment; **SMS must be disabled in the actual Clerk instance**. Email-link-only fan login likewise requires instance configuration; the token alone does not prove a first-factor strategy. These are genuine Gate 1 verification blockers.
3. Signup-only detection uses Clerk's sole session, session/account creation times within 60 seconds, and an application one-time row. Verify Clerk's real timestamps and first-session flow in staging. Failure is conservative: no signup step/consent write; settings remain available.
4. No production consent wording was invented. Only isolated test fixtures contain a label/helper. Consent writes fail until a real approved version is inserted administratively. Endpoint success always follows a committed row.
5. Safety cases are schema-only with a restricted-evidence reference; there is no evidence store, review route or reporting. Rules-triggered case creation is later-phase work. No real performers or fan traffic are enabled.
6. Draft saves are Phase 1 persistence, not boundary approval or a quote. Responses explicitly mark validation pending Phase 2; no submission endpoint exists. Quantities, groups, scenario text and pricing require Phase 2 checks before live use.
7. The unsubscribe endpoint accepts GET for the specified one-click link. Email scanners can trigger GETs. No sender exists yet; RFC 8058 email-header integration belongs in the future sending spec. Tokens are random-row-ID capabilities, never emails; request observability is disabled.
8. Existing Clerk frontend code was retained by the requested rebase. No consent screen, failure state, new visible flow, or live frontend persistence claim was introduced.

## 5. Owner setup and outstanding decisions

No product decisions are reopened. To complete Gate 1 verification:

- Authenticate Wrangler on the owner machine, provision separate development/staging D1 databases, replace placeholder IDs, set exact Clerk issuer/origin and owner-held backend secrets, apply staging migrations and deploy only the staging Worker.
- Configure and verify email-link-only first factor, authenticator/backup second factor, SMS disabled, and creator invitation provisioning. Owner purchases Pro before live creator accounts; written Clerk approval remains a launch requirement.
- Supply the approved consent label **and helper text** as an immutable version. Seed only synthetic test creators/catalogs; verify first signup versus ordinary sign-in and real verified-primary-email lookup.
- Run the remote persistence/auth/consent smoke checks and 24 browser regressions with Chromium installed. Record the results before approving Gate 1.

## 6. Designs needed

Still waiting for the post-signup consent step and its saving, write-failed, invalid/altered unsubscribe, already-unsubscribed and skip states, plus exact versioned label/helper copy. No UI was added for these states. Auth enrollment routing must use the approved design when frontend integration resumes.

## 7. Cost and release state

AI/provider calls: **0**, spend **$0**. No email sent. No paid plan purchased. No remote Cloudflare resources, migrations or deploys were performed, so this work incurred no known remote usage charges. Existing live-evaluation spend is unchanged; its **$8** ceiling was not used. Worker AI remains off and no provider adapter exists.

The staging branch is rebased, not merged. Commit/push outcome is reported in the handoff response after this report is committed. **Stop at Gate 1; do not start Phase 2.**
