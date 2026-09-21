# 02 — The e2e suite against staging

The same suite, pointed at the deployed staging site. It runs signed out, so it
proves two things: staging never borrows the demo's disclaimers, and every
commission endpoint refuses a caller with no session.

**Expected: 24 passed, 5 skipped, 0 failed.** This exact result was seen on
2026-09-20 against version `b5b677f0-74b1-45a2-8567-563e5f3c4c4a`.

## 1. Run it

```powershell
cd C:\Users\DELL\fan_director_studio\frontend
$env:E2E_MODE = "staging"
$env:E2E_BASE_URL = "https://fan-director-studio-staging.blendly.workers.dev"
npx playwright test
```

No local dev server is started or used: `E2E_BASE_URL` sends every request to the
deployed site.

When you are done, clear the variables so the next run is a demo run:

```powershell
Remove-Item Env:E2E_MODE, Env:E2E_BASE_URL
```

## 2. What the 5 skipped tests are, and why

| Test | Why it is skipped here |
| --- | --- |
| a total set in the Director survives into Review and Confirmation | Drives the demo's radio groups; staging's Director is design 17 + 20 |
| undoing once in the Director reverts exactly one change | The staging Director has no undo control |
| re-clicking the selected option does not add an undo step | Same |
| browser Back and Forward never reopen the menu on the creator queue | Opens the demo's fixed request; staging's queue is empty when signed out |
| the Director's Save idea button never claims anything was saved | Staging really saves for a signed-in fan, so "Not saved — demo" would be the false claim |

The first of those has a staging counterpart that does run:
`staging: a choice made in the Director is the total Review shows`.

## 3. What passing proves

- The four `staging: sent requests` tests: `/api/commissions`,
  `/api/commissions/:id`, `/api/creator/commissions` and
  `/api/creator/commissions/:id` all answer **401** with no session; a POST from
  another origin is refused **403 `cross_origin`** before any token is read, and the
  same POST from the site's own origin without a session is **401**.
- `/requests` asks you to sign in and claims nothing; the creator queue shows no
  one else's requests.
- The entrance's price ranges equal what the catalog API derives — not the demo's
  hardcoded ranges.
- The mobile menu says "Staging — your draft is saved to your account…", never the
  demo's "nothing you make here is saved or sent".

## 4. If it fails

| Symptom | Almost certainly |
| --- | --- |
| Every test fails instantly | The site is down, or the URL is wrong. Open it in a browser first |
| The API tests expect 401 and get 404 | The Worker is running older code. The Phase 4 deploy did not land |
| The entrance ranges differ | The staging catalog changed. Report the two numbers |
| A copy test fails | Wording drifted. Capture both strings, expected and actual |
