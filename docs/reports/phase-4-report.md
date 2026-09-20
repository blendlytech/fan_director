# Phase 4 report: submission and creator review (Gate 4)

Branch `phase-4`, head `3ebd51d` (code at `2185098`), 2026-09-20. Format: doc 11 §9.
Nothing below is described as working unless it was run. "Not verified" means it wasn't.

**Summary:** sending a draft, the immutable versions, the creator's queue and decisions,
the fan's request pages and the creator's screens are built and tested. The round trip
passes end to end against real local D1 in the worker suite, and the screens were checked
in a browser at 375, 768 and 1280 px against fixtures. **Migration 0004 is applied to
remote staging; the Phase 4 code is not deployed there** (the owner approved the
migration and the push, not a deploy), so the signed-in staging round trip is **not
verified**. Gate 3's three live-AI criteria stay carried forward: `OPENROUTER_API_KEY`
is still unset and no live AI call has been made (spend: $0).

---

## 1. What was built

56 files changed from `main` (6,600 lines added, 81 removed), in six commits:

| Commit | What |
| --- | --- |
| `cc37236` | Doc 11 §5.6 item 26: Gate 3 approved and the Phase 4 decisions |
| `8623b37` | `shared/domain/commission.ts`: the state machine, `approveProblem`, the terms hash |
| `f840f7e` | Output checks: a regression from the Phase 3 review fixes |
| `ee71c9f` | Migration 0004, the 14 endpoints, and the worker tests |
| `1624988` | Design 20 and design 24 B–D options UI (staging only) |
| `121a0cd` | The fan's screens: a real Send on Review, `/requests`, `/requests/:id` |
| `2185098` | The creator's screens on real data, the e2e mode split, the new unit tests |
| `3ebd51d` | The owner's project brief (docs only) |

### Shared domain

`shared/domain/commission.ts` (pure, unit-tested):

- the statuses and the transitions each actor may take, with `withheld` for a `minors`
  safety case, which the creator never sees;
- `approveProblem(status, currentVersion, claim)`: approval is allowed only for the
  commission's **current** version, **accepted by the fan**, with a **matching content
  hash**, and with any custom request **priced**;
- `canonicalTerms` / `termsHash`: SHA-256 over canonical JSON, identical in the worker
  and the browser, so a hash on screen means the same terms the server holds;
- `MESSAGE_MAX = 500` (design 06).

### Worker

`worker/migrations/0004_submissions.sql`:

- `draft.submitted_at`, which locks a sent draft (`putDraft` and the Director return 409
  `draft_submitted`);
- `commission`: one per draft, `UNIQUE(draft_id)` and `UNIQUE(fan_id, client_request_id)`
  so a retried send is idempotent; status, current and approved version, approved hash,
  `payment_reported_at` / `payment_reported_by`;
- `commission_version`: immutable, with triggers copied from `catalog_version` — terms
  can't change, status only moves forward, nothing is deleted;
- `commission_message`: append-only, ≤ 500 characters. A decline's internal note goes to
  `audit_event` only and never to the fan.

`worker/src/commissions.ts` holds all fourteen endpoints. Every state change is one
compare-and-set on `(status, current_version_id)` inside a single `DB.batch`, so two
racing actions can't both win; the loser gets a typed 409 carrying the state that won.

| Actor | Method and path | What it does |
| --- | --- | --- |
| Fan | `POST /api/creators/:c/drafts/:d/submit` | Revalidates through `validateForSubmission`, records a hard-list block, withholds a `minors` case, creates the commission and version 1 (fan-authored, accepted) and locks the draft |
| Fan | `GET /api/commissions`, `GET /api/commissions/:id` | Their own requests; a withheld one reads as "closed" and says no more |
| Fan | `POST /api/commissions/:id/reply` | Answers a question; the text is screened like any fan text |
| Fan | `POST …/versions/:v/accept` · `/reject` | A stale version or hash returns 409 |
| Fan | `POST …/:id/withdraw` | Any time before a decision |
| Creator | `GET /api/creator/commissions?status=` · `/:id` | The queue with counts, and one request. Withheld requests never appear |
| Creator | `POST …/:id/question` · `/propose` · `/approve` · `/decline` · `/payment-reported` | The decisions; the server prices every proposal itself |

Every transition writes an `audit_event`.

### Frontend (staging only, behind `capabilities`; the demo is unchanged)

- **The fan's side** (`121a0cd`): Review's Send calls submit inside `draftSync.exclusive()`
  and navigates only after a 201; `/requests` and `/requests/:id` show the status in plain
  words, the version history with a diff, the creator's question and a reply box, accept
  and reject, and withdraw. All wording is in `src/copy/requests.ts`.
- **The creator's side** (`2185098`), a **separate route tree** behind
  `capabilities.persistence`, so the demo keeps its own mock queue, its own copy and its
  own routes and never loads this code:
  - `pages/creator/CreatorQueue.tsx` — design 03 from `GET /api/creator/commissions`;
  - `pages/creator/CreatorRequest.tsx` — design 05, with the decision panel;
  - `pages/creator/ProposeChanges.tsx` — design 05's "Propose Changes";
  - `pages/creator/CreatorAskModal.tsx`, `CreatorDeclineModal.tsx` — designs 06 and 09;
  - `copy/creatorRequests.ts` — every creator-facing sentence, in one place;
  - `domain/creatorProposal.ts` — the proposal editor's rules, pure and tested.
- **Approve sends the exact `versionId` and `contentHash` on screen**, and the button is
  offered only when the server's `actions` include `approve`; otherwise the screen says
  why not (an unpriced custom request, an unaccepted proposal, an open question).
- **What was dropped in staging, because the server holds no such thing:** the fan's
  platform handle and avatar, the reference image, a "Requested Delivery" date, and
  "Awaiting Payment" as a status. The fan's name is labelled **Not verified**.
- **Payment** is only ever the creator's own report: "You marked payment as received on
  <date>", with "Fans pay you on your own platform. Nothing is charged here, and nothing
  is checked here." It starts no timer.
- **Dev-only preview** `/__preview/creator` (`src/dev/`) mounts these screens and the
  fan's against fixtures, for browser checks. Production builds drop it.

### Wording made honest where staging does more than the demo (§3 rules 1 and 2)

Approved by the owner, 2026-09-20, as written:

| Screen | The demo (unchanged) | Staging |
| --- | --- | --- |
| Review, signed out | "This is a demo with no backend…" | "Sign in to send this to Maya. Nothing has been sent, and nothing is charged here." |
| Mobile menu | "Demo — nothing you make here is saved or sent." | "Staging — your draft is saved to your account, and you can send it for review." |
| `/saved` notice | "This demo saves nothing…" | Signed in: "Your draft is saved to your account as you work…" · Signed out: "Sign in to keep your draft on your account…" |
| `/saved` draft badge | "Draft · this tab only" | "Draft · saved to your account" (signed in) |
| `/saved` "In the real studio…" | Shown | Hidden: staging already does the first of the three |

The `/saved` lines were a **Phase 3 gap**, not a Phase 4 one: staging has saved signed-in
fans' drafts since design 18 shipped (2026-09-18), while the page still said it saved
nothing. The mode split in the e2e suite is what surfaced it.

## 2. Test evidence

All run on `2185098` unless noted.

| Command | Result |
| --- | --- |
| `npm test` (worker) | **381 passed (381)**, 19 files, including `commissions` (23 cases) and `domain/commission` (19) |
| `npm run typecheck` (worker) | Clean |
| `npm test` (frontend) | **144 passed (144)**, 8 files (108 before this phase) |
| `npm run lint` (frontend) | Clean, no warnings |
| `npx tsc -b` (frontend) | Clean |
| `npm run test:e2e` (demo) | **24 passed, 4 skipped** (the staging-only spec) |
| `E2E_MODE=staging npx playwright test` against a local staging-mode dev server | **20 passed, 6 failed, 2 skipped** — see §5 item 2; every failure needs a backend the local server doesn't have |
| `npm run test:live` (real OpenRouter) | **Not run.** The key is still unset |

**The demo is unchanged.** Two production demo builds, one from `121a0cd` and one from
`2185098`, were served and rendered with every off-machine request blocked:

- **10 routes × 2 widths (375 and 1280) = 20 captures of `#root`: byte-identical.**
- The CSS bundle gained exactly four utility rules — `.m-8`, `.max-w-[60ch]`,
  `.border-alert/40`, `.accent-rose-deep` — all from the staging-only screens. Nothing was
  removed, nothing changed, and the shared rules keep their order. No demo element carries
  any of the four, which the identical HTML confirms.

**Browser checks (375, 768, 1280 px).** A script walked all 13 preview scenarios at each
width — the queue, a request needing a decision, ask, decline, waiting on the fan, changes
proposed, approved, payment reported, declined, and the four fan screens — and recorded:
**no sideways scroll on any page or modal, no interactive control under 40 px, and none of
the banned claims** (`you paid`, `payment confirmed`, `we charged`, `email sent`,
`Awaiting Payment`). Screenshots are in the session's `.playwright-mcp/phase4/` (git-ignored).
The propose → accept-price → send → `proposal_open` flow, and approve and payment-reported,
were exercised by hand in the preview and behaved as the server's rules describe.

**Staging (today):**

1. `git push origin phase-4` (`121a0cd..3ebd51d`), with the owner's OK.
2. `wrangler d1 migrations apply DB --env staging --remote`: **0004 applied**, 17 commands.
   Verified: `commission`, `commission_version` and `commission_message` exist,
   `draft.submitted_at` exists, and `commission` holds 0 rows.
3. **No deploy.** The owner approved the migration only, so the staging Worker still runs
   the Phase 3 code: `GET /api/commissions` there answers **404**, not 401.

## 3. Completion criteria (doc 10 §8 Phase 4, and the Gate 4 table in the plan)

| Criterion | Status | Evidence |
| --- | --- | --- |
| A full fan-to-creator round trip works | **Met in the worker suite; not verified signed in on staging** | `commissions.test.ts` "question → answer → proposal → acceptance → approval → payment reported" on real local D1. The staging run needs a deploy and a creator account (§5) |
| Old versions cannot approve new scope | **Met** | `domain/commission.test.ts`: an older version, an unaccepted version, a changed hash and an unpriced custom request are each refused. `commissions.test.ts`: approving a superseded version returns 409 `version_not_current`, a stale hash 409 `hash_mismatch`, and accepting a stale proposal hash changes nothing |
| No false payment confirmation | **Met** | "no response claims the fan paid or was charged" (worker); `copy/claims.test.ts` sweeps every sentence of both copy modules for payment and notification claims; the browser check repeats it on the rendered screens. Payment is always the creator's own report, with actor and time recorded, and starts no timer |
| Duplicate submit, simultaneous tabs | **Met** | The same `clientRequestId` returns the same request; two concurrent submits create exactly one; a stale revision and a locked draft each return 409 |
| Races have exactly one winner | **Met** | approve vs withdraw, propose vs withdraw, and decline vs accept-proposal, each on real local D1 |
| Hard list at submission | **Met** | A blocked draft can't be sent and the block is recorded; a `minors` answer opens a safety case, suspends the fan and withholds the request; a fan's reply is screened like any fan text |
| Tenant isolation | **Met** | Another fan and another creator see nothing (404); a non-creator gets 403; a creator without a second factor gets 403 `second_factor_required` |
| Records that cannot change | **Met** | A version's terms and a decided request are immutable at the database level |
| Existing suites and the demo | **Met** | §2: worker 381, frontend 144, lint, typecheck, demo e2e 24, and 20 identical demo renders |
| UI at 375, 768 and 1280 | **Met for the screens; not verified signed in on staging** | §2's browser checks, against fixtures in the dev preview |
| Gate 3's three live-AI criteria | **Carried forward** | Still no key, still $0 spent (doc 11 §5.6 item 26) |

## 4. Deviations

1. **The creator's screens are a separate route tree, not a branch inside the demo's
   pages.** It is the only way to guarantee the demo build is untouched; the cost is that
   the two versions of designs 03/05/06/09 now live side by side.
2. **Design 05's free-text "New Total" is not built.** The server derives every price
   (§3 rule 3), so the creator edits the *choices* instead, and the only number typed is
   the custom request's price, which no catalog covers. The editor is held inside the
   catalog's own selection limits, and the figure it shows is labelled as a preview that
   the server re-prices on send.
3. **Design 05's fan handle, avatar, reference image and requested delivery date, and
   design 03's "Awaiting Payment" status, are dropped in staging**, as the plan said: no
   record holds them.
4. **The fan's screens have no design** (owner decision, doc 11 §5.6 item 26). They reuse
   existing components and styles. Design 08's success screen is not used.
5. **The `/saved` wording was fixed for staging** although the false claim predates this
   phase (§1). The demo's wording is untouched.
6. **The ask and decline modals refuse to show a form** when the request has moved on,
   rather than letting a URL open a form the server would reject.
7. **The staging e2e round trip is written against what a signed-out caller can prove**
   (every commission endpoint refuses them; the screens ask for a sign-in and claim
   nothing). Playwright has no Clerk session, so the signed-in round trip stays a manual
   step for the owner.

## 5. Open questions for the owner

1. **The staging deploy, the creator account and the signed-in round trip are still
   pending.** The migration is applied, but until the Worker is deployed and a Clerk
   creator user with an authenticator is linked to `cr_maya` (the owner signs up; I put
   the id in a never-committed local seed), the round trip on staging can't run, and
   these stay "not verified": the signed-in round trip, the signed-in UI check, and the
   new staging e2e spec.
2. **Three e2e tests are written for the demo's Director controls** — the fan journey's
   total, undo and re-click tests drive radio groups that staging's Director (designs 17
   and 20) doesn't use. They fail in staging mode for that reason, not because of a false
   claim. They need staging-shaped counterparts, or an explicit demo-only marking. Two
   more (the entrance ranges, and the new API tests) fail only because a local dev server
   has no API, and should pass against a deployed staging.
3. **Gate 3's live-AI criteria** remain carried forward until OpenRouter approves the
   account and the key is set. Not raised again here.
4. **The project brief describes intake this phase doesn't collect** — a fan handle, a
   requested budget and a delivery target on the creator's queue, and "payment
   instructions" generated on approval. Say whether those should become real fields, or
   whether the brief should follow the build.
5. **Merging `phase-4` to `main`** has not been asked for or done.

## 6. Designs needed

- **The fan's request pages** (`/requests`, `/requests/:id`, the sent state, the reply box,
  the proposal accept/reject) are undesigned, as decided. They should get a design before
  real fans see them.
- **The creator's "propose changes" editor**: design 05 draws a free-text total, which the
  server can't accept. The built editor needs a design of its own.
- **A signed-out creator state**: the queue currently shows a plain sentence.
- Still open from Phase 3: the fan-facing groups beyond `DIRECTOR_SLOTS_V1`, and a
  designed "sign in to use the Director" state.

## 7. Costs and ceilings

| Item | Amount |
| --- | --- |
| AI (OpenRouter) | **$0.00**. No live call has been made; the `ai_call` ledger is empty |
| Cloudflare | $0. Staging is on the Workers free plan (D1, one cron). Migration 0004 wrote 17 commands |
| Phase 3 AI budget | $8, unchanged and unspent |
| Staging ceiling | `AI_BUDGET_CEILING_MICROUSD` = 3,000,000 ($3), unchanged |
| `ADULT_CATALOG_ENABLED` | `false` in every environment, unchanged |

**Gate 4 stops here.** The staging deploy, the creator account and the signed-in round
trip need the owner's go-ahead.
