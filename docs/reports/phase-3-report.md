# Phase 3 report: the AI Director (Gate 3)

Branch `phase-3`, head `06df9ba` (code at `9fb3d22`), 2026-09-18. Format: doc 11 §9.
Nothing below is described as working unless it was run. "Not verified" means it wasn't.

**Summary:** the Director pipeline, cost ledger, kill switches, design 17 and 18 UI and
test suites are built and deployed to staging. **No real AI call has been made yet**
(spend: $0). `OPENROUTER_API_KEY` isn't set on staging, so the live Director there
shows design 17 D ("unavailable"). The Gate 3 criteria that need a real model are
marked **not verified**. They need the key and one live run to close. The owner has
deferred that run to production, pending OpenRouter's approval (§5 item 1).

---

## 1. What was built

74 files changed from `phase-2` (8,003 lines added, 58 removed). Owner decisions for
this phase are recorded in doc 11 §5.6 item 24.

### Shared domain

- `shared/domain/director.ts` covers these pieces:
  - `allowedItems`, which is the per-request enum: published, visible, not hard-no, adult only when §5.4 allows, and only in groups the UI can show.
  - `buildOption`, which applies removes, then wants (a choose-one swap), then requires, caps qty, validates and quotes the result, or returns a typed drop reason.
  - `sameSelections`, `optionTitle` and `slotOf`, plus `DIRECTOR_SLOTS_V1`, the groups the UI can show: setting, greeting and extra_minutes.

### Worker (`worker/src/ai/`)

| File | What it does |
| --- | --- |
| `provider.ts`, `mock.ts`, `openrouter.ts` | The adapter interface, a scripted mock, and the one real client. It uses strict `json_schema` and `data_collection: "deny"`. The classifier is pinned to Groq with no fallback |
| `models.ts` | Qwen3 235B 2507 → DeepSeek V3.2 fallback; the classifier is `openai/gpt-oss-safeguard-20b`. A dated rate table in µUSD per million tokens, with a reserve factor of 2 |
| `schema.ts` | Builds the per-request schema, plus a strict hand-written validator (unknown keys and ids outside the enum are rejected) |
| `outputChecks.ts` | `output-checks-v1`: money, delivery time, approval (including the creator's name), and refusal wording |
| `classifier.ts`, `prompts/classifier-v1.ts` | `classifier-v1`. It fails closed; `prohibited_roles` with childlike becomes `minors`; it matches custom limits |
| `prompts/director-v1.ts` | `director-v1` system prompt plus `retry-v1` (temperature 0.2, 900 max tokens, 20 s timeout) |
| `context.ts` | What the provider sees: fan-facing catalog fields, hard-no limits as "not offered", performers by display name, draft ids and quantities, a summary |
| `ledger.ts` | Atomic reservation across the `global` and `creator:<id>` scopes, reconcile, and hold on an unclear outcome |
| `pipeline.ts` | `runTurn`: gates → request row → rules layer → input classifier → Director (one fallback, one retry) → output checks, rules and classifier → build options → store → respond |
| `copy.ts` | `director-copy-v1`: every fan-facing sentence |
| `intimate.ts` | Strips adult items the fan didn't ask for. It only takes effect when adult is on, which happens in tests only |
| `retention.ts` | A daily purge of raw turn text past 30 days, and a sweep of stuck pending requests |
| `config.ts` | The limits: 20 turns per draft, 2,000 characters, 30 fan turns an hour and 300 per creator (configurable), and the ceilings |

Other worker changes:

- `screening.ts`: `recordHardListBlock` is generalized to the `draft` and `ai_request` subjects.
- `drafts.ts`: adds the latest-draft lookup and exports the pieces the accept route reuses.
- `index.ts`: the routes below and a `scheduled` handler.
- `wrangler.jsonc`: the staging vars and the cron `17 3 * * *`.
- `staging-guard.mjs`: AI may be on only in staging, with a ceiling of 8,000,000 µUSD or less, and adult switched off.
- `seeds/staging-ai-maya.sql`.
- A `director` scenario in `staging-checklist.mjs`.

### Endpoints

All endpoints are for the signed-in fan who owns the draft; they are same-origin and tenant-checked.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/creators/:c/drafts` | The fan's latest draft, so autosave can resume (design 18) |
| GET | `/api/creators/:c/drafts/:d/director` | Replies left, availability, recent turns |
| POST | `/api/creators/:c/drafts/:d/director` | Runs one turn. The draft is never changed by a turn |
| POST | `…/director/suggestions/:s/accept` | Re-validates against the current draft and saves it; a moved revision gives 409 out of date |
| POST | `…/director/suggestions/:s/decline` | Records "not added" |

### Migration

`worker/migrations/0003_ai_director.sql`:

- adds `creator.ai_enabled` (default 0);
- adds the new `ai_request` columns, plus two indexes: unique `(fan_id, client_request_id)` and a partial unique index allowing one pending request per draft;
- adds four tables: `ai_call`, `ai_budget`, `ai_turn_content` (the raw text, purgeable) and `ai_suggestion`.

It is applied to local and remote staging D1. No 0004 was needed.

### Frontend (staging only, behind `capabilities.persistence` and `capabilities.aiDirector`)

- **API and auth:** `api/client.ts` and `api/types.ts` (Clerk bearer token), and the `auth/session.ts` and `auth/ClerkBridge.tsx` modules.
- **State:**
  - `state/draftSync.ts`: design 18 autosave. One save in flight at a time, revision-ordered, with `exclusive()` for accepting a suggestion.
  - `state/directorReducer.ts`.
  - `domain/sceneCard.ts` gains `draftFromSelections`.
- **Components:**
  - `components/director/*`: design 17 A–F and 13 C1–C3.
  - `components/save/*`: design 18 A–C.
- **Pages:** `pages/AIDirector.tsx` gains the live branch. There is also a dev-only `/__preview/director`.
- **Demo:** the demo build has both flags off, so it is unchanged (see §2).

## 2. Test evidence

All of these runs happened **before** the code-review fixes in `9fb3d22`. After those
fixes, only `tsc` and lint were run (both clean). The owner stopped further test runs
("Stop all tests, only run production"). **The suites have not been re-run on the final
code: not verified.**

| Command | Result |
| --- | --- |
| `npm test` (from `worker/`) | **342 passed (342)**, 17 files. It includes `ai-director` (37), `ai-ledger`, `ai-conversations` (35 cases), `ai-injection` (13), `ai-checks` (55), `ai-adult` (6) and `domain/director` (18) |
| `npx vitest run test/ai-injection.test.ts test/ai-checks.test.ts test/ai-adult.test.ts` | **74 passed (74)**, 3 files |
| `npm test --prefix frontend` | **90 passed (90)** |
| `npm run test:e2e --prefix frontend` (demo) | **24 passed** |
| Demo HTML and CSS against `phase-2` | 14/14 pages identical, with Unsplash blocked |
| `tsc` and oxlint, worker and frontend, after `9fb3d22` | Clean |
| `npm run test:live` (real OpenRouter, $5 cap) | **Not run** |
| e2e against staging, and the signed-in `director` checklist | **Not run** |

**Browser checks:**

- The design 17, 13 C and 18 components were checked at 375, 768 and 1280 px in the dev preview (`/__preview/director`), with screenshots in the session scratchpad.
- The live, signed-in Director on staging was **not verified** in a browser.

**Production (today):**

1. `git push origin phase-3` (`7061df3..06df9ba`).
2. Staging frontend built from `.env.local`; `scan-bundle.mjs` found no secrets.
3. `npm run deploy:staging` (the guard passed). Version `3ce4d28a-aab9-4197-b23a-079a7494221b`, cron registered.
4. The site returns 200 and serves the new bundle.
5. `wrangler secret list`: `OPENROUTER_API_KEY` is **absent**.

## 3. Completion criteria (doc 11 §8 Phase 3)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Adapter behind an interface; versioned prompts | **Met** | Pipeline tests use `mock.ts` only. Every `ai_request` stores the prompt, classifier, ruleset and copy versions |
| Per-request schema with the enum; everything else rejected | **Met** | `ai-director` and `domain/director` tests: hard-no, hidden, adult (off) and non-UI groups are absent from the enum; the validator rejects extra keys |
| Server builds options; only `clarifyingQuestion` shows model text; `notOffered` mapped; `customRequest` prefilled, not priced | **Met** (mock) | `ai-director` and `ai-conversations` |
| One retry, then unavailable; fallback recorded | **Met** (mock) | Invalid then valid; invalid twice gives 503 with the draft unchanged; provider error gives DeepSeek with `fallback_used=1` |
| No text states a price, delivery or approval | **Met** (mock and unit) | `ai-checks` (55), must-reject and must-pass lists |
| Hard list and limits on every turn; classifier fails closed; childlike becomes `minors` | **Met** (mock) | Blocked input makes zero provider calls; audit, the 3-in-24h threshold, and a `minors` safety case with suspension on `ai_request` |
| ≥ 30 representative conversations | **Met on the mock; not verified live** | 35 cases in `fixtures/director-conversations.ts`. The live run of the same cases was not done |
| Injection tests (mocked, hostile output) | **Met** | `ai-injection` (13): out-of-enum id, qty above the maximum, money and approval in `note`, `label` and `clarifyingQuestion`, malformed JSON. The draft is byte-identical and nothing hostile reaches the fan |
| Classifier and output checks pass the §5.3.3 must-block and must-allow sets | **Not verified** | Mock behaviour is tested. The real safeguard-20b run on the 130/127 sets needs the live suite |
| No hard-list violation ever shown | **Met** (mock) | Hard-list text in every output field is never served |
| No adult items the fan didn't ask for | **Met** (in-process, adult on) | `ai-adult` (6). Adult stays off in every deployed environment |
| Legal adult requests not refused | **Not verified** | Needs the live suite. On staging, adult is off, so explicit requests meet the creator's `non_explicit_only` limit notice, not a model refusal |
| A valid option updates the card only on accept; invalid output changes nothing | **Met** | Accept, decline and out-of-date tests; the revision is unchanged after any turn. The accept/decline race and the autosave/accept race are fixed in `9fb3d22` (not re-tested) |
| Concurrent calls can't overrun the reservation | **Met** | `ai-ledger`: 20 concurrent reservations near the ceiling on real local D1 total ≤ the ceiling. One turn per draft (the rest get 409). A timeout holds the reservation |
| Usage limits and kill switch | **Met** | 20 turns then 429; failed turns aren't counted; 2,000 characters; hourly rates; `AI_ENABLED` or creator off gives 503 while manual edits still work |
| Existing suites green; demo unchanged | **Met before `9fb3d22`; not re-verified after** | §2 |
| UI at 375, 768 and 1280 | **Partly** | Components checked in the preview; signed-in staging not verified |

## 4. Deviations

1. **The UI groups are limited to `DIRECTOR_SLOTS_V1`** (setting, greeting, extra_minutes). The other groups have no design yet (Phase 2 decision 6), so they never enter the enum.
2. **Custom free-text limits: the server's own check is word overlap.** Items sharing a word with a custom hard no are excluded, and the classifier also matches custom limits. A paraphrase can get past the word check and relies on the classifier.
3. **Design 18 C3 (the Send area on Review) is not built.** Submission is Phase 4.
4. **Prompt files are combined.** `retry-v1` lives in `prompts/director-v1.ts`, not in its own file, and there is no separate `routes.ts` (the routes are in `index.ts`). Both are versioned all the same.
5. **Code-review fixes (`9fb3d22`) were not re-tested** at the owner's direction.
6. **The staging ceiling is set at $3** (3,000,000 µUSD) of the $8 phase budget, leaving about $5 for the local live suite.

**New wording approved by the owner:** the new `director-copy-v1` sentences, the signed-out Director prompt and "Saves $X", all approved as written.

**Delegation:** Sonnet drafted the conversation and injection fixtures and the design 17/18 components from the design HTML. Every case was reviewed against §5.3.3. The Opus `feature-dev:code-reviewer` reviewed the security-critical logic; all 5 findings were fixed.

## 5. Open questions for the owner

1. **The live run is deferred to production (owner, 2026-09-18).** The owner's OpenRouter approval is still pending, with no known timeline. Until it arrives, `OPENROUTER_API_KEY` can't be set and the live suite can't run. The three "not verified" criteria in §3 stay open. They are **carried forward**, to be closed by a live run once the key exists, before the Director is switched on for real fans. Until then the staging Director shows design 17 D ("unavailable"), and manual selection keeps working.
2. **Re-running the suites** on the final code before merging to `main`.
3. **Naming (resolved, owner, 2026-09-18):** "Fan Director Audio" in the domain notes was a typo. All eight occurrences now read "Fan Director Studio".
4. **Housekeeping:** `.agents/`, `skills-lock.json` and `mcp-gemini-server/` are now git-ignored, not committed. Say if any of them should be in the repo.
5. From §10, still open: Groq's terms for safety classification (a launch item), and whether adult content is ever enabled.

## 6. Designs needed

- **The fan-facing groups beyond `DIRECTOR_SLOTS_V1`** (design 20) before the Director can suggest them.
- **The design 18 C3 Send area**, needed with Phase 4.
- **A designed "sign in to use the Director" state.** The current one reuses design 16's button with the design 18 A4 label.

## 7. Costs and ceilings

| Item | Amount |
| --- | --- |
| AI (OpenRouter) | **$0.00**. No live calls were made; the `ai_call` ledger is empty |
| Cloudflare | $0. Staging runs on the Workers free plan (D1, one cron) |
| Phase 3 AI budget | $8 total, set by the owner |
| Staging ceiling | `AI_BUDGET_CEILING_MICROUSD` = 3,000,000 ($3). The creator ceiling defaults to the same. The guard refuses anything over $8 |
| Local live-suite cap | $5, tracked in the git-ignored `worker/.live-spend.json` |
| Raw conversation retention | 30 days (`AI_RAW_RETENTION_DAYS`), purged daily at 03:17 UTC |

**Gate 3 stops here.** Phase 4 needs the owner's go-ahead.
