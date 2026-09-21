# Testing Fan Director Studio by hand

These documents are the owner's test scripts. Each one is a numbered list with an
expected result for every step, so a run either passes or produces something
specific to report back.

Read them in this order:

| # | Document | What it covers | How long |
| --- | --- | --- | --- |
| 01 | [Demo e2e suite](01-demo-e2e.md) | The automated suite against the public demo build | ~3 min |
| 02 | [Staging e2e suite](02-staging-e2e.md) | The same suite against the deployed staging site | ~3 min |
| 03 | [Creator account setup](03-creator-account-setup.md) | One-time: a Clerk creator account linked to `cr_maya` (no authenticator needed) | ~10 min |
| 04 | [The Phase 4 round trip](04-round-trip-staging.md) | Fan sends → creator reviews → approval → payment, by hand on staging | ~30 min |
| 05 | [Browser checks](05-browser-checks.md) | The Phase 4 screens at 375, 768 and 1280 px | ~20 min |

Do 03 before 04: the round trip's creator half cannot run without it.

## What is already true, and what isn't

**Verified, 2026-09-20:**

- Worker suite 381/381, frontend unit tests 144/144, lint and both typechecks clean
  (at commit `2185098`).
- The public demo's rendered HTML is identical to the previous commit on 10 routes
  at two widths; the CSS gained four unused utility rules.
- Staging is deployed with the Phase 4 code and the second-factor waiver. Version
  `c0d02366-82cd-422e-b250-859133692335`.
  Migration 0004 is applied to the remote staging D1 (`commission`,
  `commission_version`, `commission_message`, `draft.submitted_at`).
- The staging e2e suite passed against the deployed site: 24 passed, 5 skipped.

**Not verified — these documents exist to close them:**

- The demo suite has not been re-run since the e2e files were last edited (doc 01).
- No signed-in run of anything on staging: no request has ever been sent there, and
  `commission` holds 0 rows (docs 03, 04).
- No signed-in browser check of the creator screens (doc 05).

## The environment

| Thing | Value |
| --- | --- |
| Staging site | <https://fan-director-studio-staging.blendly.workers.dev> |
| Clerk instance | `superb-crawdad-9550` (development) |
| Staging D1 | `fan-director-staging` |
| Pilot creator | `cr_maya` ("Maya") |
| Public demo | Untouched by any of this. Never deploy to it while testing |

## Three traps that have already cost time

1. **`npm run test:e2e` reuses a dev server that is already running.** If one is up
   with a Clerk key, the demo suite silently runs in staging mode and fails on copy
   that is correct. Kill anything on port 5173 first (doc 01 step 1).
2. **A staging deploy serves whatever is in `frontend/dist`.** Always rebuild the
   frontend before deploying, or the old bundle ships with the new Worker.
3. **Photos are dead links.** Three of the four reference photos 404, by design. A
   missing image is not a test failure; the app draws its own fallback.

## When something fails

Capture, in this order, and hand it back for development:

1. The URL and what you clicked.
2. The exact words on screen (a screenshot is ideal).
3. The request id if one is shown ("Request A1D04E21").
4. The failing request in the browser's Network tab: the path, the status code and
   the JSON body.

A failure is more useful than a retry. Nothing in Phase 4 deletes anything, so a
half-finished round trip can be left where it stands.
