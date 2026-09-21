# Prompt: deferred Phase 1 screens, for a Gemini agent

Paste everything below the line into the Gemini agent, with the repository `C:\Users\DELL\fan_director_studio` open as its workspace.

---

You are a coding agent joining **Fan Director Studio**, a staging web app on Cloudflare Workers (a React 19 + Vite frontend, and a TypeScript Worker with D1 and Clerk auth). You'll build four small, already-designed screens and flows that were deferred from Phase 1. Another agent (Claude) is building a different feature, the AI Director, in parallel on another branch. Work carefully, stay inside your scope, and stop to ask the owner whenever this brief says so.

## 1. Read first, in this order

1. `docs/specs/11-Developer-Handoff-Phases-0-3.md`. This is the contract. Read at least:
   - §3 (the non-negotiable rules; breaking any fails the work);
   - §5.6 items 16–22 (decisions; don't reopen them);
   - §5.8 (email news consent);
   - §7 (architecture).
2. `worker/README.md`: the API you'll call, and exactly how consent and unsubscribe behave.
3. The designs you'll build, opened in a browser:
   - `docs/designs/html/23-news-consent-step.html`: states A, A2–A6, U1–U5, and "Not drawn here";
   - `docs/designs/html/16-sign-in.html`: states A3 and C.
4. `docs/reports/phase-1-report.md` §0 and `docs/reports/phase-2-report.md` §§1–5: what exists and how it was verified.
5. The code you'll touch:
   - `frontend/src/App.tsx`, `frontend/src/main.tsx`;
   - `frontend/src/auth/clerk.ts`, `frontend/src/config.ts`;
   - `frontend/src/components/layout/Header.tsx`, `AuthControls.tsx`;
   - `worker/src/consent.ts`, `worker/src/unsubscribe.ts`, `worker/src/auth.ts`, `worker/src/index.ts`, `worker/test/*`.
6. Clerk skills are in `.agents/skills/`: `clerk-react-patterns`, `clerk-custom-ui` and `clerk-testing` are the relevant ones. Check Clerk's current docs before relying on any API.

## 2. What exists

- **The product:** a design prototype for a creator-commission flow. A fan plans a custom video with a fictional creator, "Maya", and a "Scene Card" is priced from her catalog.
  - The **public demo** (a separate deployment) has no backend and must stay exactly as it is.
  - The **staging** build is the same frontend with a Clerk publishable key. `authEnabled` in `frontend/src/auth/clerk.ts` is the switch, and `capabilities` in `frontend/src/config.ts` builds on it.
- **Staging:** `https://fan-director-studio-staging.blendly.workers.dev`, with Clerk development instance `superb-crawdad-9550`. The Worker serves the frontend and the API under `/api/*`.
- **Consent and unsubscribe are already built and tested on the server** (Phase 1). The screens aren't built. The endpoints, with details in `worker/README.md`:
  - `GET /api/creators/:creatorId/consent` (fan) returns `{ status, wording: { version, label, helper }, onboarding: { show } }`. `onboarding.show` is true only straight after a fan's first sign-up.
  - `POST /api/creators/:creatorId/consent-onboarding` (fan) takes `{ choice: 'subscribe', wordingVersion }` or `{ choice: 'skip' }`. A second answer gives `409 already_answered`. `409 email_not_verified` is possible.
  - `POST /api/creators/:creatorId/consent` (fan, settings) takes `{ status: 'subscribed', wordingVersion }` or `{ status: 'unsubscribed' }`.
  - `GET /api/unsubscribe/:token` (anyone, read-only) returns `{ state: 'confirm' | 'already_unsubscribed' | 'invalid', creatorName? }`.
  - `POST /api/unsubscribe/:token` (anyone) returns `{ state: 'done' | 'already_unsubscribed' | 'invalid' }`, or `503 unsubscribe_failed`.
- **API conventions:**
  - Signed-in calls need `Authorization: Bearer <Clerk session token>`, from `useAuth().getToken()`. Cookies are never read.
  - Every POST must be same-origin.
- **The staging boutique's creator id is `cr_maya`.** Consent wording version `news-v1` is seeded.
- **Staging test fans:** the accounts named here were deleted on 2026-09-20 — this repository is public, and a Clerk test address plus its fixed code is a working sign-in. The current fan and creator accounts are in `docs/testing/local-test-accounts.md`, which `.gitignore` excludes. Never commit an address.
  - Test creators: `cr_staging_a` and `cr_staging_b`.
  - `worker/scripts/staging-checklist.mjs` signs in by Clerk sign-in ticket (`--as <email>`, development key only).
  - `worker/scripts/issue-unsubscribe-token.mjs` makes unsubscribe tokens, with the key in the environment. Ask the owner for it; never print it.

## 3. Your scope: four items, staging build only

1. **The news consent step (design 23, states A and A2–A6).**
   - It's a one-time step straight after a fan's first sign-up, shown before anything else, for the boutique they came from (`cr_maya`).
   - Show it only when the server returns `onboarding.show: true`.
   - The checkbox is **unticked** by default and optional.
   - The label and helper come **from the server's wording**, with `{creator}` replaced by the creator's name. Never hard-code them.
   - "Continue" with the box ticked sends `subscribe` plus the wording version. Leaving without Continue counts as a skip that **writes no row**; follow the design and §5.6 item 20.
   - Say "Saved" only after the server answers 200.
   - Draw the saving, save-failed, signed-out and already-answered states exactly as designed.
2. **The unsubscribe page (design 23, U1–U5).**
   - A public route, for example `/unsubscribe/:token`, that works signed out.
   - Loading it calls only GET, which never writes. Unsubscribing needs the **confirm button**, because mail scanners open links.
   - States: confirm, done, bad link, already unsubscribed, and couldn't unsubscribe.
3. **"Subscribe again" (design 23 U2/U4 and design 16 A3). STOP and ask the owner before building this one.** The design has the button on the unsubscribe page, which is opened from an email link with no sign-in. But doc 11 §5.6 item 18 says *"a forwarded link can only turn news off, never on."* Ask the owner to choose:
   - **(a)** "Subscribe again" requires signing in as that fan, then calls a signed-in endpoint that records `source: 'unsubscribe_page'`. This is recommended: it keeps the §5.6 rule and needs a small Worker change plus tests.
   - **(b)** Drop the button from the unsubscribe page; fans resubscribe in account settings (design 16 A3).
   - **(c)** Something else the owner prefers.

   Don't build a token-based "subscribe" in any case.
4. **Creator authenticator enrolment routing (design 16, state C).**
   - When a signed-in creator's `GET /api/creator/me` returns `403 second_factor_required` with `enrol: true`, route them to set up an authenticator app. Without `enrol`, they need to verify their authenticator code.
   - Use **Clerk's hosted screens** (UserProfile/SignIn). Design 23 "Not drawn here" says custom enrolment screens need a design first.
   - Note: the owner currently has the authenticator app switched off in Clerk. Build and test the routing with the API's responses (mock them in tests), and **tell the owner** that creators can't enrol until they switch it back on. Don't change Clerk settings yourself.

**Ask the owner whether design 16 state A3 (the news toggle in account settings) is in scope.** It isn't in the deferred list.

**Out of scope:**
- the AI Director and anything under `worker/src/ai/`;
- pricing, the catalog, `shared/domain/*`, `AIDirector.tsx`, `sceneCard.ts`;
- the creator request queue;
- any email sending;
- any Clerk dashboard change.

## 4. Non-negotiable rules (doc 11 §3, owner preferences)

- **No false claims.** The UI never says something was saved, sent or subscribed unless the server returned success. Never delete or soften an existing disclaimer.
- **The public demo must not change.** Everything you add renders only when `authEnabled` / `capabilities` is on. The demo's e2e suite must stay 24/24, unchanged.
- **Design before UI.** Build only what designs 23 and 16 draw. A state that isn't drawn needs owner approval first: list it and ask.
- **Secrets never enter the repo, the bundle, URLs, logs or browser storage.** Never ask for a secret's value; the owner sets secrets with `wrangler secret put`. Consent choices never go into Clerk metadata.
- **Adult content and AI stay off:** `ADULT_CATALOG_ENABLED` and `AI_ENABLED` are `"false"`. Don't touch them.
- **Honest reporting.** Never say something works unless you ran it; write "not verified" otherwise.

## 5. Working alongside the Claude branch

- Create branch **`phase-1-ui` from the latest `phase-2`** (pull first). Don't merge, rebase onto or edit the `phase-3` branch. The owner decides the merge order.
- **Migrations:** Phase 3 owns `worker/migrations/0003_*`. Don't add a migration without asking the owner. None of your four items should need one.
- **Files that are yours:** new pages and components for the consent step, the unsubscribe page and enrolment routing; `AuthControls.tsx`; new routes in `App.tsx`; `worker/src/consent.ts` and `worker/src/unsubscribe.ts`, only if item 3 option (a) is chosen.
- **Files that are shared** (`App.tsx`, `Header.tsx`, `worker/src/index.ts`, `worker/README.md`): make small, local edits only.
- **Files that are not yours:** `AIDirector.tsx`, `sceneCard.ts`, `frontend/src/state/*`, `shared/**`, `worker/src/ai/**`, `worker/src/rules/**`, `worker/src/drafts.ts`, `worker/src/catalog.ts`.

## 6. Tests and verification (all required before you report)

Run from the repository root:
- `npm test --prefix worker` and `npm run typecheck --prefix worker`: 170 today, plus any you add;
- `npm test --prefix frontend`: 77 today, plus unit tests for any new pure logic;
- `npm run lint --prefix frontend`: zero warnings;
- `npm run build --prefix frontend`;
- `npm run test:e2e --prefix frontend`: demo mode, 24/24 unchanged.

Add Playwright tests for your staging-only screens in a **separate** spec that runs only when `E2E_MODE=staging`; see `frontend/e2e/mode.ts`. Don't change the existing 24 tests.

Check every new screen **in a real browser at 375, 768 and 1280 px** against the design, including focus order and screen-reader status messages. A clean typecheck isn't evidence that a screen works.

**Deploying to staging needs the owner's OK**, asked once. The steps: `npm run build --prefix frontend`, then `npm run deploy:staging --prefix worker` (a guard runs first).

## 7. Machine gotchas (Windows, PowerShell 5.1)

- **Git:**
  - Commit with `git commit -F <file>`, and write that file as UTF-8 **without** a byte-order mark: `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`.
  - Commits are authored as blendly.tech@gmail.com (global config).
  - Don't push without the owner's OK, asked once per push.
- **Environment variables:** `$env:X = ''` *deletes* the variable. For a demo-mode build with an empty Clerk key, spawn the build from a Node script with `env: { VITE_CLERK_PUBLISHABLE_KEY: '' }`.
- **Local D1:** wrangler's local D1 fails on long paths, so use `--persist-to C:\fdsw`.
- **Disk:** the C: drive's free space swings; check `(Get-PSDrive C).Free` before e2e runs.
- **Dev server:** port 5173 may already be taken by the owner's dev server. The e2e suite reuses whatever runs there, so make sure it's in demo mode.

## 8. What to deliver

1. **First**, before any code: a short plan (files, routes, states per design, tests) and your questions to the owner (item 3, A3 scope, any undrawn state). Wait for the answers.
2. Build on `phase-1-ui` in small, verified commits.
3. **Finally**, write `docs/reports/phase-1-ui-report.md`:
   - what was built;
   - exact test commands and pass counts;
   - browser checks at 375, 768 and 1280 px;
   - each design state marked built or not built;
   - deviations;
   - open questions.

   Then STOP and wait for the owner's review.
