# Prompt: Phase 3 (AI Director), for a new Claude Code window

Paste everything below the line into a new Claude Code session opened in `C:\Users\DELL\fan_director_studio`.

---

You're starting Phase 3 (the AI Director) of Fan Director Studio. Phase 2 is finished, and its Gate 2 report is `docs/reports/phase-2-report.md`. Plan Phase 3, get the owner's approval of the plan, build it, and stop at Gate 3. Don't write feature code until the owner approves your plan.

## First: confirm Gate 2

The owner asked for this prompt, but hasn't said "Gate 2 approved" in writing. Ask them to confirm it in your first question prompt. Once they do, record it as doc 11 §5.6 item 23 ("Gate 2 approved (owner, <date>)"), following items 21 and 22. Commit that on your branch.

## Read first, in this order

1. Your auto-loaded memory (MEMORY.md and the files it links). Read `project-phase2.md`, `project-phase1-rebuild.md`, `project-phase0-live-and-clerk.md`, `project-environment-gotchas.md`, `feedback-delegation-and-verification.md` and `project-catalog-boundaries-handoff.md` in full.
2. `docs/specs/11-Developer-Handoff-Phases-0-3.md`. This is the contract. Read at least:
   - §3 (non-negotiable rules);
   - §5.3 (hard list, classifier, creator limits);
   - §5.4 (adult gating: stays off in every deployed environment);
   - §5.6 (every decision, items 1–22; don't reopen them);
   - §7;
   - §8 "Phase 3" (scope, response contract, completion criteria = Gate 3);
   - §9 (report format);
   - §10 (open decisions).
3. `docs/reports/phase-2-report.md`, especially §4 (deviations) and §5 (open items).
4. `docs/reports/phase-0-live/RESULTS.md` and `round2.py`: the tested response contract, models and classifier.
5. `worker/README.md`, then the code:
   - `shared/domain/*` (quote, validate, ranges, boundaries);
   - `worker/src/rules/*`, `worker/src/screening.ts`, `worker/src/catalog.ts`, `worker/src/drafts.ts`;
   - `frontend/src/pages/AIDirector.tsx`, `frontend/src/domain/sceneCard.ts`, `frontend/src/state/*`.
6. `docs/designs/html/17-ai-director-live-states.html` (states A–D and F) and design 13 states C1–C3 (the in-chat limit notices).

## Where things stand

- **Repo:** branch `phase-2`, pushed; the Gate 2 report is at 50ec9d6, and this prompt was committed after it. It is not merged into `main`, and merging needs the owner. **Create your branch `phase-3` from the latest `phase-2`.**
- **Tests:** worker 170/170 (`npm test --prefix worker`, `npm run typecheck --prefix worker`); frontend unit 77/77, lint, build; e2e 24/24 in demo (`npm run test:e2e --prefix frontend`) and 24/24 against staging (`E2E_MODE=staging E2E_BASE_URL=<staging> npx playwright test` in `frontend/`).
- **Rules layer:** `node worker/scripts/rules-rates.ts` gives 130/130 blocked and 127/127 allowed.
- **Staging:** `https://fan-director-studio-staging.blendly.workers.dev`, Worker version e5dad3a7.
  - It runs on the blendly.tech@gmail.com Cloudflare account, and Wrangler is logged in there.
  - Clerk development instance `superb-crawdad-9550`.
  - Maya's catalog is `cr_maya` / `cv_maya_1`.
  - Test fans: the accounts once named here were deleted on 2026-09-20 (this repository is public and those addresses were working sign-ins). Current accounts: `docs/testing/local-test-accounts.md`, git-ignored.
- **Signed-in staging checks:** `worker/scripts/staging-checklist.mjs <scenario> --as <email>` (development key only). Auto mode's safety check has blocked it before, so ask the owner to leave auto mode if it does.
- **Clerk now:** "Require MFA" is off, as it must be (fans would be locked out). The public configuration also shows the authenticator app switched **off**, and that's the owner's call. Don't change Clerk settings, and don't raise the authenticator or SMS settings with the owner except as already recorded in the Gate 2 report.
- **Running in parallel:** a Gemini agent is building the deferred Phase 1 UI on branch `phase-1-ui`, also from `phase-2`: the design 23 consent step and unsubscribe page, "Subscribe again", and design 16 creator enrolment routing. See "Working alongside the Gemini branch" below.

## Phase 3 scope (doc 11 §8), summarised; read §8 itself for the exact criteria

- **Provider adapter** behind an interface, with prompt templates as versioned files.
  - Models: **Qwen3 235B Instruct 2507** first and **DeepSeek V3.2** as fallback, through the adapter. Fallback is recorded in `ai_request`.
  - Use a host only after its terms have been reviewed.
- **Response contract:** the model names catalog item ids and the server does the rest.
  - The JSON schema is built **per request**, with `itemId`/`removes` locked to an `enum` of the ids the fan may choose now.
  - The server applies, validates (shared `validateSelections` and the resale rule) and quotes every option, and writes all fan-facing text from fixed, versioned templates.
  - Only `clarifyingQuestion` is shown as model text, and only after the checks pass.
  - One retry, then design 17's "unavailable" state. No text field may state a price, total, budget, discount, delivery date or approval.
- **Hard list on every turn:**
  - rules layer (exists) plus the **classifier layer**: `openai/gpt-oss-safeguard-20b` on Groq, given only the ten keys, failing closed;
  - escalate childlike results to `minors`;
  - check fan input before the call and every output field after it;
  - the Phase 2 block handling (audit, threshold, safety case) applies to AI turns too;
  - a fan with `fan_restriction.ai_disabled_at` set gets no AI.
- **Creator limits:** hard-no items never enter the enum; the server attaches ask-me flags and drops options with hard-no items. **Custom free-text limits** have no detection yet (Gate 2 deviation 2); the classifier must cover them.
- **Usage limits and cost:**
  - Usage limits from doc 10 §6 as configuration.
  - An **atomic cost reservation** before each call, reconciled after.
  - The `AI_ENABLED` kill switch, per environment and per creator. With AI off or failing, manual catalog selection keeps working and the draft stays intact.
- **Adult:** `ADULT_CATALOG_ENABLED` stays `"false"` in every deployed environment. Build and test the adult path with synthetic fixtures **inside the test process only** (§5.4, Gate 0 decision 3).
- **Tests:**
  - at least 30 representative conversations;
  - injection tests against a **mocked** provider (hostile output: a made-up price, an unlisted id, `qty` over the maximum, money or approval wording in any text field, malformed JSON);
  - classifier and output checks on the §5.3.3 sets (both rates reported);
  - no adult items the fan didn't ask for;
  - concurrent calls can't overrun the reservation.
- **Gate 3 report** in `docs/reports/phase-3-report.md`, in the §9 format. Then STOP.

## What only the owner can give you (ask in one short question prompt)

- Confirmation of Gate 2 (above).
- **Approval of design 17** as the UI for the live Director. There's no recorded approval, and §3 rule 5 means no UI without one. Build the API and tests meanwhile.
- **Raw conversation retention** (§10; doc 10 proposes 30 days).
- **The test budget ceiling** for live calls. Phase 0 used $8; ask for the Phase 3 figure, and report spend against it.
- **Provider keys:** OpenRouter (or the chosen host) and Groq. The owner sets them with `wrangler secret put … --env staging`. Never ask for, print or store a key's value. Local tests use the mocked provider.
- **The host(s)** whose terms the owner has reviewed for Qwen3 and DeepSeek. Use no others.
- Prompt-injection tests go to a real provider only with that provider's written authorization. Default: mocked only.

## Working alongside the Gemini branch

- **Migrations:** Phase 3 owns `worker/migrations/0003_*`. The Gemini agent has been told not to add migrations without asking. If you need more than one, use 0003 and 0004 and say so in the report.
- **Files that are yours:** `worker/src/ai/**` (new), `shared/domain/*`, `AIDirector.tsx`, `sceneCard.ts`, the Director's state, and the new Director components.
- **Files that are theirs:** the consent step, the unsubscribe page, creator enrolment routing, `components/layout/AuthControls.tsx`, and any new pages and routes for those.
- **Shared files** (`App.tsx`, `Header.tsx`, `worker/src/index.ts` routes, `worker/README.md`): keep your edits small and in place, so a later merge is easy.
- Don't merge either branch into the other. The owner decides the merge order.

## Rules and owner preferences

- **Money and pricing:** integer cents, and the server is authoritative. The AI never prices, approves, charges or writes records.
- **No false claims.** Never delete or soften a disclaimer. The public demo (`fan-director-studio` on the scmillsc0809 account) keeps every disclaimer, and live-AI copy changes only behind a staging capability flag (`frontend/src/config.ts`).
- **UI:**
  - no UI change without an owner-approved design;
  - check UI in a browser at 375, 768 and 1280 px before reporting it done;
  - demo builds must still render the same HTML (the Phase 2 report describes how this was compared).
- **Reporting:** never claim anything works unless you ran it; say "not verified" otherwise.
- **Delegation:** subagents are welcome. Match the model to the job, and say which went where and why (see `feedback-delegation-and-verification.md`).
- **Git and deploys:** don't merge, push or deploy to staging without the owner's OK, asked once per action.
- **Machine gotchas:**
  - Local D1 fails on long paths, so use `--persist-to C:\fdsw`.
  - The C: drive's free space swings, so check it before e2e runs.
  - In PowerShell, commit with `git commit -F <file>`, and write that file as UTF-8 **without** a byte-order mark (`[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`).
  - PowerShell `$env:X=''` deletes the variable; for a demo build with an empty Clerk key, spawn it from Node.
  - Git Bash strips backslashes in `node -e`, so put scripts in files.
  - Node 24 runs `.ts` scripts directly.
- **Playwright MCP:** it sometimes times out at start-up. Fallback: a Node script that requires `@playwright/test` from `frontend/node_modules`.

## What to deliver first

Use plan mode. Read the files above. Ask the owner the questions above in one short question prompt. Then write a Phase 3 plan, covering:
- build order;
- files;
- migration 0003;
- endpoints;
- the adapter interface;
- the per-request schema;
- the prompt template versions;
- the cost reservation design;
- tests mapped to each §8 Phase 3 criterion;
- what needs designs or owner approval.

Present it for approval.
