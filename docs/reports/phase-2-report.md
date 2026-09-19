# Gate 2 report: catalog, boundaries and server-side quotes

Date: 2026-09-18. Branch: **phase-2** (from `main` at 611d5b7).

**Status: awaiting the owner's Gate 2 decision.** All six §8 completion criteria are met, locally and on staging (§3). Phase 3 has not started.

Staging: `https://fan-director-studio-staging.blendly.workers.dev`, Worker version **e5dad3a7**. D1 `fan-director-staging` has migration 0002 applied and Maya's catalog v1 seeded. Creator A's catalog has a v2 for the stale-price check.

## 1. What was built

**Shared domain** (`shared/`, pure TypeScript compiled by both the Worker and the frontend, so there is one quote module, doc 11 §7):

| File | What it does |
| --- | --- |
| `domain/types.ts` | The §6 contract, plus `ItemTrait` (`uses_name`, `uses_script`, `resale`), `BoundaryFlag` and typed `SelectionError`s |
| `domain/catalog.ts` | Reads stored catalog JSON. Missing fields fall back to the safe reading (hidden, adult). Server-side visibility filtering |
| `domain/validate.ts` | Selection groups and min/max, quantities, requires/excludes, hidden and adult gating, the personalised-video resale rule. Never repairs |
| `domain/quote.ts` | Integer cents. Percent lines on the fixed + per-unit subtotal only, each rounded half up. Delivery ≥ 1 day. The custom request is never priced |
| `domain/ranges.ts` | Entrance ranges from selection groups (every valid combination is quoted), template validation, starting defaults |
| `domain/boundaries.ts`, `domain/hardList.ts` | The one boundaries renderer, and the ten hard-list keys with their fan labels (Option 1 for `prohibited_roles`) |
| `catalog/pilot-v1.ts` | Maya's catalog v1: 5 general categories, the §5.7 items, 4 templates, 5 adult categories that are empty and hidden, and boundaries |

**Worker** (`worker/`):

| Item | What it does |
| --- | --- |
| `migrations/0002_phase2.sql` | `creator.adult_content_enabled`, `draft.boundary_flags_json`, `fan_restriction`, append-only `safety_case_evidence`, and an index for counting blocks |
| `src/rules/` (`normalize.ts`, `ruleset-v1.ts`, `check.ts`) | The hard-list rules layer (§5.3.3 layer 1) and the creator-limit checklist rules |
| `src/screening.ts` | Screens every draft text field. What a block does: the audit event, the 3-in-24-hours threshold, and for `minors` a safety case, evidence and suspension |
| `src/catalog.ts` | Catalog read, quotes, staleness, and the adult gate (platform switch + creator switch + every compliance flag) |
| `src/drafts.ts` | Save with full validation, rules, flags and quote. Stale-version handling. Accepting the new version |
| `src/submission.ts` | `validateForSubmission`. **No route** (Gate 0 decision 7) |
| `src/publish.ts`, `scripts/publish-catalog.ts` | Publish checks and SQL: the admin path, with no editor UI. `seeds/pilot-maya-v1.sql` is its output |
| `scripts/rules-rates.ts` | Prints the rules layer's rates on the test sets |
| `scripts/phase2-public-checks.mjs` | Staging checks that need no sign-in |
| `scripts/staging-checklist.mjs` | Scenarios `phase2` and `phase2-stale` |

New endpoints:

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/creators/:creatorId/catalog` | anyone |
| POST | `/api/creators/:creatorId/quote` | anyone (same-origin; stores nothing) |
| GET | `/api/creators/:creatorId/drafts/:draftId/quote` | the owning fan |
| POST | `/api/creators/:creatorId/drafts/:draftId/accept-catalog-version` | the owning fan |

`PUT …/drafts/:id` now validates fully, runs the rules and limits, stores flags and returns the quote.

**Frontend** (`frontend/`):

- **Migrated screens.** `domain/sceneCard.ts` is now a `CatalogView` over the catalog, in cents. "Richer" and "longer" stay Director suggestions, mapped to selections.
- **Catalog and quotes.** `state/CatalogContext.tsx` provides the catalog: the bundled copy in the demo, the server's in staging. `state/CommissionContext.tsx` shows the server's quote in staging; stale responses can't overwrite newer ones.
- **Staging limits** (design 13 A and B): `components/boundaries/CreatorLimits.tsx`. The demo keeps its copy.
- **Build flag:** `config.ts` sets `capabilities.serverCatalog` for the staging build.
- **e2e:** `e2e/mode.ts` and `playwright.config.ts` let the same suite run against the demo or staging.

## 2. Test evidence

Local, on the final tree (2026-09-18):

| Command | Result |
| --- | --- |
| `npm run typecheck --prefix worker` | clean |
| `npm test --prefix worker` | **170/170** (10 files) |
| `node worker/scripts/rules-rates.ts` | must-block **130/130** under the right key; must-allow **127/127**; **0** false blocks |
| `npm test --prefix frontend` | **77/77** |
| `npm run lint --prefix frontend` | clean |
| `npm run build --prefix frontend` | ok |
| `npm run test:e2e --prefix frontend` (demo) | **24/24** |
| `node worker/scripts/scan-bundle.mjs` (staging build) | no secret signatures or values |

Rules-layer rates by key (block): minors 30/30, prohibited_roles 25/25, incest 10/10, non_consent 16/16, bestiality 6/6, real_third_parties 8/8, unverified_performers 6/6, solicitation 13/13, illegal_acts 8/8, hate_harassment 8/8.

- The `minors` fixtures contain no sexual description.
- No fixture was sent to any provider.
- The must-allow set covers:
  - the §5.3.3 near-misses;
  - explicit requests between the consenting adults of §5.3.1;
  - status roles and adult fantasy archetypes.

Staging:

| Check | Result |
| --- | --- |
| `node worker/scripts/smoke.mjs <staging>` | 7/7 |
| `node worker/scripts/phase2-public-checks.mjs <staging>` | 16/16 |
| `E2E_MODE=staging E2E_BASE_URL=<staging> npx playwright test` | **24/24** |
| Browser at 375, 768 and 1280 px (Playwright, deployed site) | Catalog and quote APIs 200. Ranges $125–$590, $135–$610, $105–$550. 14 limit lines. Extra minute gives $185 |
| `staging-checklist.mjs phase2 --as fan_c+clerk_test@example.com` | see below |
| `staging-checklist.mjs phase2-stale` (after publishing `cv_staging_a2`) | see below |

Results of the signed-in staging scenarios:

- Maya draft save: `200`, quote 14500, budget difference 500, no flags. Reload is identical.
- Tampered quantity: `422 selection_rejected qty_out_of_range`. A `total` key in the draft: `400 invalid_draft`.
- "mention the election": `422 creator_limit_blocked`, label "Anything political".
- "can we meet in person": `422 hard_list_blocked`, key `solicitation`. The D1 audit row holds `{key, subject: "meeting in person", layer, version, field}` and none of the fan's wording.
- Stale price: after creator A's v2 ($15 → $18 a minute) is published:
  - reading the draft gives `stale: true`, with the pinned total unchanged at 7500 and the new breakdown at 9000;
  - an edit gives `409 catalog_version_stale`;
  - accept gives `200`, revision 2, v2, total 9000.

"No visual change" in the demo was checked by comparison. Demo builds from before and after the migration render **identical HTML** on these screens:
- the entrance;
- the Director, in five states;
- review, confirmation and saved.

The CSS bundle was byte-identical after the migration. Identical HTML was re-checked after the limits UI was added.

Raw signed-in results are in the git-ignored `worker/.staging-evidence.json`. Screenshots are in the session scratchpad, not the repo.

## 3. Completion criteria (doc 11 §8 Phase 2)

| Criterion | Status and evidence |
| --- | --- |
| Doc 10 §9 figures exact in cents; entrance ranges derived from selection groups, in unit tests and through the API | **Met.** `worker/test/domain/quote.test.ts` and `phase2.test.ts`; frontend `sceneCard.test.ts`; staging public checks: 14500 / 18500 (−3500) / 14500; ranges 12500–59000, 13500–61000, 10500–55000 |
| A tampered browser request (unknown item, over-limit quantity, hidden item, adult item, edited price) is rejected | **Met.** Worker tests for each on the quote and draft routes. Adult is rejected with the switch off, and allowed only when every switch is on inside the test process. On staging: unknown, over-limit, edited price, client total and cross-site |
| Rules layer passes the §5.3.3 must-block and must-allow sets; both rates reported | **Met.** 130/130 blocked, 127/127 allowed (§2) |
| `validateForSubmission` rejects a draft with a hard-no request and accepts an ask-me request with its flag | **Met.** `worker/test/submission.test.ts` (8 tests, including stale version, name and script rules, and the decline policy) |
| Percentage lines, the personalised-video resale rule and template validation pass unit and API tests | **Met.** Unit: `quote.test.ts`. API: `phase2.test.ts`. Staging: exclusive + rush = 29000; personalised + resell gives 422 |
| Existing e2e tests pass against staging | **Met.** 24/24 against the deployed site, as the owner decided (§5.6 item 22). The only mode-specific expectations are the header badge and the catalog-derived ranges |

Also required by the §8 scope, and done:
- the pilot seed as published v1;
- adult categories defined, empty and disabled;
- a new catalog version never re-prices a draft silently;
- the boundaries renderer on all three screens (staging), with the wording owner-approved (§5.6 item 22);
- the rules run on draft save and at publish;
- `boundaryFlags` recomputed on every save;
- fan screens migrated with no visual change;
- a `minors` hit opens a safety case and suspends the fan (tested locally only; not exercised on staging on purpose).

## 4. Deviations and limits

1. **Custom limits at publish count only `solicitation` and `hate_harassment`.** A limit names what the creator refuses ("No deepfakes"), so screening it against every key would refuse legitimate limits. Contact details, payment links and hate are still refused (§5.3.3 check point 4).
2. **Custom free-text limits aren't detected in fan text yet.** Rules can't match arbitrary creator wording, so the Phase 3 classifier covers them. Checklist limits (explicit, political, brand) are detected now.
3. **`BoundaryFlag.source`** adds `display_name` and `fan_script` to §6's list, because Phase 2 checks those fields. **`Item.traits`** is new: the resale rule keys off traits, not creator-editable labels.
4. **Design 13 state D ("Before you send") isn't shown.** Its "Nothing on Maya's doesn't-do list" line needs the server to have checked the fan's text, which only happens on save and submission (Phase 4). The review screen shows the full limits panel instead, as §5.3.2 requires.
5. **Staging ranges include options the screens can't pick yet** (exclusive, rush, 4K, name, script), as Gate 0 decision 2 requires. Fans can reach the top of each range once design 20's pickers exist.
6. **A failed quote or catalog call in staging keeps the local preview.** It uses the same module and the same catalog, but a visible failure state needs design 18.
7. **The custom request limit moved from 2,000 to 1,000 characters**, to match §5.1 and design 19.
8. **Starter template descriptions** ("A warm, personal video that talks to you by name.") are seed text that no screen shows yet. They need owner approval before design 20's template picker shows them.
9. **Choice-card previews in the Director** (the hypothetical totals on "Richer" and "Longer") come from the shared module. The Scene Card's own total is the server's (doc 11 §7 allows previews).

## 5. Open questions and owner decisions

- **Clerk (found during these checks):**
  - "Require MFA" was on, which left every fan session pending. The owner turned it off on 2026-09-18.
  - The instance's public configuration now also shows the **authenticator app switched off** (`authenticator_app.enabled: false`). While it's off, no creator can enrol a second factor, and the Worker refuses every creator route with `403 second_factor_required`.
  - The authenticator app must be on before any creator can use the creator side.
  - The earlier follow-ups (password and Google off, email link, backup codes) are unchanged: password is still on and required.
- **Design 20 approval**, including the "may resell" disclosure. It is a hard prerequisite for Phase 4 submission (§5.6 item 22).
- **Next step:** the deferred Phase 1 UI (design 23 consent step, unsubscribe page, "Subscribe again", design 16 enrolment routing) is due next, per the owner's decision, before Phase 3.

## 6. Designs needed before UI work continues

| Design | Needed for |
| --- | --- |
| **18** (approval) | Save status, edits from another window, price changes, and the quote/catalog failure state |
| **20** (approval) | Option pickers (orientation, name, delivery, rights, resolution), the resale disclosure and the template picker |
| **24 A–D** (approval) | Pricing note, fan nickname, script add/remove, and the resale conflict |
| **13 D** | Already drawn; waits for Phase 4 submission, not for design |

## 7. Costs and release state

- **AI calls:** 0. `AI_ENABLED` and `ADULT_CATALOG_ENABLED` are `"false"` in every deployed environment (the guard checks both).
- **Cloudflare:** staging usage is within the free Workers and D1 allowances (1 deploy, 2 remote migrations/seeds, test traffic). No paid plan was bought.
- **Clerk:** development instance, free. Two test users were used for the checks: `fan_c+clerk_test@example.com` (new) and fan A.
- **Git:**
  - `phase-2` is pushed up to 14392e7.
  - Commits c26999e (staging check scripts) and this report are local until the owner's OK to push.
  - Nothing is merged into `main`.

**Stop at Gate 2. Phase 3 has not started.**
