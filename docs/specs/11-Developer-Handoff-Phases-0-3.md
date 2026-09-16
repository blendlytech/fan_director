# Fan Director Studio: Developer Handoff for Phases 0–3

Date: 2026-09-16
Owner: Clay Mills
Written for: an autonomous coding agent (GPT 6 Astra) starting with no prior context on this repository
Status: Approved scope. Phases 0–3 of [doc 10](10-Fan-Director-Implementation-Plan.md), plus the catalog and boundaries model decided below

---

## 1. How to use this document

Read this document fully before touching code. Then read, in order:

1. [01-design-context.md](01-design-context.md): product intent and the no-false-claims rules.
2. [10-Fan-Director-Implementation-Plan.md](10-Fan-Director-Implementation-Plan.md): the architecture this handoff implements.
3. [`frontend/README.md`](../../frontend/README.md): how the current app is built and tested.
4. [02-design-system.md](02-design-system.md), only if you touch UI.

**Order of authority when sources disagree:** the owner's explicit instructions, then this document, then doc 10, then the design drafts in `docs/design-html/`, then the other specs. `03-developer-handoff.md` is partly replaced; ignore its backend, API, data-model and deployment sections.

**Work in phases and stop at every gate.** Each phase in §8 ends with a written gate report (§9). Do not start the next phase until the owner approves the report. If you discover that something here is wrong or impossible, stop and say so in a report. Do not work around it.

---

## 2. What exists today (verified 2026-09-16)

This is a **design demo**, not a product. Nothing below is a backend.

| Area | Current state |
| --- | --- |
| Frontend | `frontend/`: Vite 8, React 19, TypeScript 6, Tailwind v3, react-router v7, oxlint |
| Hosting | Static build on Cloudflare **Workers Static Assets**, Worker name `fan-director-studio`, <https://fan-director-studio.scmillsc0809.workers.dev>. `frontend/wrangler.jsonc` has no Worker script and no bindings |
| Backend | **None.** No Worker code, D1, R2, auth, AI or payments |
| Fan draft | In-memory React state (`src/state/CommissionContext.tsx` + pure reducer `src/state/commissionReducer.ts`). Lost on full page reload |
| Catalog | **Hardcoded constants** in `src/domain/sceneCard.ts` (see §4) |
| Creator boundaries | **Not data.** Hand-written copy in three screens that says slightly different things (see §4) |
| Creator queue | Static seed data in `src/data/requests.ts` |
| Tests | `npm test`: 67 Vitest unit tests (`sceneCard.test.ts`, `commissionReducer.test.ts`). `npm run test:e2e`: 24 Playwright tests over 4 specs. `npm run lint` must report zero warnings. `npm run build` runs `tsc -b` then `vite build` |

Routes: the fan side has `/`, `/ai-director`, `/review`, `/confirmation` and `/saved`, sharing one `CommissionProvider`. The creator side has `/creator/requests`, `/creator/requests/:id`, `/:id/ask` and `/:id/decline`. Everything else hits `*`, the Page not found screen.

The "AI Director" today is scripted UI. It has two canned choices ("Richer Setting" and "Longer Video"), and fan notes are recorded but never answered.

Visual ground truth lives in `docs/design-html/`: 01 is the component library, 02–09 are the original screens, 10 is saved ideas, 11 is the mobile menu, 12 is page not found. PDFs are in `docs/design-pdfs/`.

---

## 3. Non-negotiable rules

Breaking any of these fails the phase, however good the rest is.

1. **No false claims.** The UI never says something was sent, saved, submitted, approved, charged or paid unless a server actually did it and returned success. Where no server exists, the UI says so plainly.
2. **Never delete or soften an existing disclaimer.** When a capability becomes real *in staging*, change the copy only behind an environment or capability flag, and only with owner approval. The public demo at `fan-director-studio` keeps every disclaimer unchanged.
3. **Money is derived, never written.** No price or total is ever copy. Every total is computed from catalog data. From Phase 2 on, the server is authoritative and works in **integer cents**. The browser only displays what the server returns.
4. **The AI never prices, approves, charges or writes records.** It returns typed suggestions (item ids, quantities, a clarifying question). Application code validates them and recalculates everything (doc 10 §4).
5. **Design before UI.** Any new screen, or a new visible state of an existing screen, needs an owner-approved design in `docs/design-html/` first. Do not invent UI. List what needs designing in your gate report, and build APIs and tests meanwhile.
6. **Adult content stays off** (see §5.4). Build the gating. Never enable it, seed adult items, or send adult categories to an AI provider.
7. **Secrets never enter the repo, frontend bundle, URLs, logs or browser storage.** When a secret is needed, ask the owner to set it with `wrangler secret put`. Never ask for its value.
8. **Deploys:** you may deploy to a *staging* Worker you created. Never deploy to or modify `fan-director-studio`, or any other Worker on the account (`jansansweep`, `nameless-block-485a`), without explicit owner approval.
9. **Reference photos render through `SceneImage`**, never a raw `<img>`. Several draft photos are dead links.
10. **Before every commit** run `npm test`, `npm run test:e2e`, `npm run lint` and `npm run build`. For UI changes, also verify in a real browser at 375, 768 and 1280 px. A clean typecheck is not evidence that a screen works.

---

## 4. Where the catalog and boundaries live today

### 4.1 Catalog: `frontend/src/domain/sceneCard.ts`

| Constant / structure | Value | Meaning |
| --- | --- | --- |
| `BASE_VIDEO_PRICE`, `BASE_MINUTES` | $90, 3 min | Required base video |
| `PER_EXTRA_MINUTE` | $40 | Per extra minute (max 2 reachable today) |
| `SETTINGS` | Vintage Lounge $35, Floral Studio $45, Backstage $15 | Exactly one required |
| `PERSONALIZED_GREETING_PRICE` | $20 | "Detailed greeting"; the standard greeting is $0 |
| `FOCUS_OPTIONS` | `richer` = detailed greeting; `longer` = +1 minute, standard greeting | **A Director UX framing, not catalog data** |
| `extraMinute` on `Draft` | +1 minute add-on | Optional |
| `BUDGET` | $150 | Fan's stated budget (demo) |
| `DELIVERY_DAYS` | 7 | Counted **from payment confirmation**, never from today |

Pricing flows one way: `Draft` → `buildLineItems(draft)` → `sumOf(items)`. `previewTotal` prices hypothetical choices, and `priceRangeOf(setting)` derives the entrance price ranges by listing every buildable draft.

**Reference figures that must still compute after any refactor** (doc 10 §9): $90 + $35 + $20 = **$145**, which leaves $5 of the $150 budget. Adding an extra minute gives **$185**, $35 over budget, and removing it restores $145. Entrance ranges: Vintage $145–$205, Floral $155–$215, Backstage $125–$185.

### 4.2 Boundaries: three inconsistent copies

- `src/pages/BoutiqueEntrance.tsx` ~line 185: "pre-approved by Maya… Wardrobe is strictly creator-curated. No explicit content, political…"
- `src/pages/AIDirector.tsx` ~line 606: "Creator Boundaries Apply… Wardrobe and setting adhere to non-explicit guidelines", plus a "within listed options" explainer.
- `src/pages/ReviewScene.tsx` ~line 132: "All options are from Maya's approved catalog. Wardrobe is creator's choice (non-explicit)."

In Phase 2 all three must render the **same text, generated from boundary data** (§5.3). Do not change their wording before then.

---

## 5. Decisions already made (do not reopen)

The owner decided these on 2026-09-16.

### 5.1 Catalog structure: categories, starter items, custom items

- A creator's catalog is a list of **categories**. Each category holds **items**.
- The platform supplies **starter categories**, prepopulated with **starter items**. The creator can edit, price, hide or delete a starter item, and can add **their own items** and **their own categories**.
- A fan may add a **custom request**: free text that is **never priced by the system or the AI** and **always requires creator review**. It never appears as a priced line item. It shows as "Custom request, price set by the creator after review."

### 5.2 Starter categories

| Key | Label | Selection | Examples (pilot) |
| --- | --- | --- | --- |
| `length_format` | Length & format | Base item required; add-ons optional | Base video 3 min (required, $90); extra minute ($40 each, max 2); orientation vertical/horizontal ($0) |
| `setting` | Setting / set | Exactly one | Vintage Lounge $35, Floral Studio $45, Backstage $15 |
| `wardrobe` | Wardrobe & look | At most one | Creator's choice ($0). Priced wardrobe items are allowed |
| `personalization_delivery` | Personalization & delivery | Greeting: exactly one; delivery: at most one | Standard greeting $0, detailed greeting $20; standard delivery 7 days from payment ($0) |

**Adult-gated starter categories** (§5.4): `props`, `participants` (solo or couple), `posing`, `encounter_type`. Their definitions exist in the schema and the seed, **with no items**, `contentRating: "adult"`, and they are **disabled**.

### 5.3 Boundaries: a checklist plus custom text

A catalog version carries a `boundaries` object with three layers:

1. **Platform-prohibited list.** Fixed by the platform. **Not editable, not removable, not hideable** by creators, fans or the AI. It is always enforced and always shown. At minimum it covers: anyone under 18, or content referring to minors; non-consent, or anyone who has not verified consent; real-person impersonation or deepfakes; illegal content; and hate or harassment. The exact wording is an open decision for the owner (§10); implement it as data with stable keys.
2. **Creator checklist.** Prepopulated, and the creator ticks what applies: `non_explicit_only` (default **on**, and cannot be turned off while adult content is disabled), `wardrobe_creator_curated`, `no_political_content`, `no_brand_mentions`, `no_third_party_names_without_consent`. Keys are stable; labels live in one place.
3. **Creator custom boundaries.** Up to 10 short free-text entries, each at most 200 characters, shown to fans and given to the AI **as data**.

Plus a `customRequestPolicy`: `review` (default) or `decline`.

One function renders the fan-facing boundaries text from this object. All three screens in §4.2 use it, which removes the inconsistency.

### 5.4 Adult content: designed for it, launched non-explicit

- **Platform switch:** environment variable `ADULT_CATALOG_ENABLED`, default `false` in every environment. No code path, seed, test fixture or admin tool may set it to `true`. Only the owner changes it, after compliance.
- **Per-creator switch:** `creator.adultContentEnabled`, default `false`. It is effective only when the platform switch is on **and** the compliance record (below) is complete.
- While either switch is off, anything with `contentRating: "adult"` is **excluded server-side** from:
  - catalog reads,
  - quote calculation,
  - draft validation,
  - AI context,
  - fan and creator UI responses.

  Filtering in the browser is not enough. Write tests that prove the exclusion.
- **Model the compliance prerequisites; don't implement them:** per-performer age and ID verification, including every participant in couple content; consent records; record-keeping obligations for the target market; an age gate on public pages; an AI provider whose current terms permit the use case (see doc 10 §2 and §11); and payment-processor suitability. Represent these as a `complianceStatus` record with a field for each item, all `false`. This document does **not** establish legal compliance.
- The AI provider must never receive adult categories or items in Phases 0–3.

### 5.5 Scope

Phases 0, 1, 2 and 3 of doc 10, in order, with a gate after each. Phases 4–6 are out of scope. So is a creator-facing catalog **editor** UI: in Phases 0–3 the catalog is created with seed data or an admin script, and the editor needs a design first (§3 rule 5).

---

## 6. Target data model (extends doc 10 §5)

Use these as the contract. Field names may change in Phase 0 if you justify it in the gate report.

```ts
type Cents = number // integer, >= 0

interface Catalog {                // one per creator
  id: string; creatorId: string
  currentPublishedVersionId: string | null
}

interface CatalogVersion {         // immutable once published
  id: string; catalogId: string; version: number
  status: 'draft' | 'published' | 'retired'
  currency: 'USD'
  categories: Category[]
  boundaries: Boundaries
  delivery: { standardDaysFromPayment: number }
  createdAt: string; publishedAt: string | null
}

interface Category {
  id: string; key: string          // key is stable, e.g. 'setting'; creator-added keys are generated
  label: string; description?: string
  origin: 'starter' | 'creator'
  contentRating: 'general' | 'adult'
  selection: { min: number; max: number }   // setting: {1,1}; wardrobe: {0,1}
  sortOrder: number; hidden: boolean
  items: Item[]
}

interface Item {
  id: string; key: string
  label: string; description?: string
  origin: 'starter' | 'creator'
  contentRating: 'general' | 'adult'  // an adult category makes all its items adult
  pricing:
    | { kind: 'fixed'; amount: Cents }
    | { kind: 'per_unit'; unitLabel: string; amountPerUnit: Cents; minQty: number; maxQty: number }
    | { kind: 'included' }            // $0, shown as "Included"
  effects?: { minutes?: number; deliveryDaysDelta?: number }  // e.g. extra minute: minutes +1 per unit
  requires?: string[]; excludes?: string[]  // item ids within the same version
  hidden: boolean; sortOrder: number
}

interface Boundaries {
  platformProhibited: { key: string; label: string }[]  // injected by the platform, never stored as editable
  checklist: Record<string, boolean>
  custom: string[]                                        // <= 10 entries, <= 200 chars each
  customRequestPolicy: 'review' | 'decline'
}

interface DraftV2 {                // replaces today's { setting, focus, extraMinute, notes }
  id: string; revision: number     // increments on every accepted change
  creatorId: string; catalogVersionId: string
  selections: { itemId: string; qty: number }[]
  customRequest: string | null     // never priced
  notes: { id: number; text: string }[]
  budget: Cents | null
}

interface Quote {                  // computed by the server only
  catalogVersionId: string; draftRevision: number
  lines: { itemId: string; label: string; qty: number; amount: Cents }[]
  total: Cents; budgetDifference: Cents | null
  minutes: number; deliveryDaysFromPayment: number
  customRequestPending: boolean
}
```

**Mapping today's demo onto the model** (this becomes the pilot seed and the unit-test fixture):

- `focus: 'richer'` becomes the detailed-greeting item.
- `focus: 'longer'` becomes one unit of extra minute plus the standard greeting.
- `extraMinute: true` becomes one more unit of extra minute.

"Richer or longer" survives only as a **Director suggestion**, not as catalog data.

**Quote rules:**

- Validate every selection against the version's category limits (`selection.min`/`max`), item quantities, `requires`/`excludes`, `hidden` and `contentRating` gating.
- Reject invalid input with a typed error. Never "fix" it silently.
- The total is the sum of line amounts in cents. `minutes` is the base plus effects. Delivery is the standard days plus deltas, never below 1 day.

---

## 7. Architecture notes for Phases 1–3

- **Workers:**
  - Create a *staging* Worker with its own name (suggested: `fan-director-studio-staging`). It serves the frontend as static assets and runs the API under `/api/*`, using `assets.run_worker_first: ["/api/*"]`.
  - Keep `not_found_handling: "single-page-application"` so deep links keep working.
  - Check the current Wrangler docs and the installed `wrangler` version (4.132) and `node_modules/wrangler/config-schema.json` before writing config.
- **Code location:** propose it in Phase 0. The repo is a single `frontend/` package today; a sibling `worker/` directory with shared domain code is acceptable.
- **Shared domain logic:**
  - Quote calculation and validation must be one module, used by the Worker and unit-tested.
  - The browser may use the same module for instant previews, but it must display the server's quote as authoritative and reconcile when they differ.
- **D1:** use migrations checked into the repo, with separate development/staging databases (doc 10 §3), foreign keys and version checks. Index creator, owner, status and timestamps.
- **Auth:** choose it in Phase 0 (doc 10 §3). Creator login is mandatory. Fans start with an opaque server-issued session cookie.
- **Frontend state:**
  - Keep the single-reducer pattern: draft and undo history must move through one pure transition. A nested `setState` inside an updater double-pushed history under React StrictMode once.
  - Server round-trips must not break undo, and stale responses (an older `revision`) must never overwrite newer edits.
- **Honest copy in staging:** once saving is real in staging, use a capability flag (for example `capabilities.persistence`) to switch copy. The production demo build keeps it `false`.

---

## 8. Phases, deliverables and gates

### Phase 0: Reconcile and select (no feature code)

1. Run the whole test suite and the app. Confirm §2 is accurate and note any differences.
2. Map every place that reads catalog constants, the `Draft` shape or boundaries copy. List what the DraftV2 migration touches.
3. Propose code layout, Worker naming, D1 layout and the shared-domain approach.
4. Evaluate **auth** options for Workers against current docs and pricing. Recommend one.
5. Evaluate **AI providers**. For each candidate record:
   - structured-output reliability,
   - current terms for the intended use (non-explicit now; say plainly whether adult use would be allowed later),
   - data retention and training settings,
   - latency and price per million input and output tokens, **with dates and sources**.

   Run at least 10 sample conversations against the pilot catalog with the §8 Phase 3 schema (use the owner's test key only if provided; otherwise design the harness and mark it blocked).
6. List every UI state Phases 1–3 need that has no design. At minimum: sign-in, "saved" states, AI pending, AI suggestion shown / accepted / rejected, AI unavailable or usage exhausted with the manual fallback, stale quote needing acceptance, and custom request pending.

**Gate 0 report:** findings, recommendations with sources, the migration map, the list of needed designs, and open questions.

### Phase 1: Backend foundation

- A staging Worker and D1 schema/migrations for `creator`, `catalog`, `catalog_version`, `fan_session`, `draft`, `ai_request`, `audit_event` and `compliance_status`.
- Auth as approved; tenant authorization on every private endpoint; CSRF protection suited to the auth choice; input size limits.
- Save and reload of a `DraftV2` scoped to its owner.
- Secrets set by the owner. Prove none appear in the built frontend bundle (scan `dist/`).

**Complete when:** two test creators cannot read each other's drafts, one fan cannot read another fan's draft by guessing its id, save/reload works in staging, and every existing test still passes.

**Gate 1 report.**

### Phase 2: Catalog, boundaries and server-side quotes

- Seed the pilot catalog (§5.2 and the §6 mapping) as published version 1, with the four general starter categories populated and the adult categories defined, empty and disabled.
- Endpoints:
  - read the published catalog (with adult content filtered server-side);
  - create/update a draft with `expectedRevision`;
  - get a quote.
- A stale `expectedRevision` returns a conflict response with the current draft and quote.
- A catalog version change after a draft was quoted marks the quote stale. The fan must accept the new breakdown and is never silently re-priced.
- Implement the boundaries renderer, and switch all three screens in §4.2 to it (this needs owner approval of the rendered wording).
- Migrate the fan screens from constants to catalog data **without visual changes**, driven by the existing designs. The entrance price ranges must still be derived.

**Complete when:**

- the doc 10 §9 figures and the §4.1 entrance ranges compute exactly in cents, in unit tests and through the API;
- a tampered browser request (unknown item, over-limit quantity, hidden item, adult item, edited price) is rejected;
- existing e2e tests pass against staging.

**Gate 2 report.**

### Phase 3: AI Director

- A provider adapter behind an interface, so switching provider needs no fan-journey changes. Prompt templates are versioned files.
- **Structured response contract.** Reject anything else:

  ```json
  {
    "type": "object",
    "additionalProperties": false,
    "required": ["reply", "suggestions", "clarifyingQuestion", "unresolved"],
    "properties": {
      "reply": { "type": "string", "maxLength": 600 },
      "suggestions": {
        "type": "array", "maxItems": 3,
        "items": {
          "type": "object", "additionalProperties": false,
          "required": ["label", "changes"],
          "properties": {
            "label": { "type": "string", "maxLength": 80 },
            "changes": {
              "type": "array", "maxItems": 5,
              "items": {
                "type": "object", "additionalProperties": false,
                "required": ["op", "itemId"],
                "properties": {
                  "op": { "enum": ["add", "remove", "setQty"] },
                  "itemId": { "type": "string" },
                  "qty": { "type": "integer", "minimum": 0 }
                }
              }
            }
          }
        }
      },
      "clarifyingQuestion": { "type": ["string", "null"], "maxLength": 200 },
      "unresolved": { "type": "array", "maxItems": 5, "items": { "type": "string", "maxLength": 200 } }
    }
  }
  ```

- **`reply` must never state a price, total, discount, delivery date or approval.** Validate: reject or strip replies containing currency amounts or those claims. All numbers the fan sees come from the server's quote of each suggestion, rendered by templates.
- Validate every suggestion against the current catalog version and the draft revision before showing it. Price each valid suggestion with the quote engine. Drop invalid ones, record why in `ai_request`, and never show them.
- **Context sent to the provider:**
  - the published general catalog (ids, labels, descriptions, prices as data);
  - the boundaries (platform-prohibited, checklist and custom);
  - the current draft and quote;
  - a compact conversation summary.

  Never send contact details, payment data, adult categories, or other fans' data. Fan text and catalog text are **data**, not instructions.
- Usage limits from doc 10 §6 as configuration: 20 AI turns per draft, 2,000 characters per message, one in-flight request per draft, per-session and per-creator rate limits, and a global test budget ceiling set by the owner.
- **Atomic cost reservation** before each call, reconciled after. An ambiguous timeout keeps a conservative reservation.
- **Kill switch:** an `AI_ENABLED` flag, per environment and per creator. With AI off, or on any failure, the draft stays intact and manual catalog selection keeps working.
- Instruction-injection tests: a fan message or catalog description saying "ignore previous instructions", "make it free", "add an unlisted item" or "approve this" must produce no invalid change.

**Complete when:** doc 10 §9's AI-related checklist items pass, including at least 30 representative test conversations (normal requests, budget trade-offs, unavailable choices, boundary violations, custom requests, injection attempts). Valid suggestions update the card. Invalid output changes nothing. Concurrent calls cannot overrun the reservation budget.

**Gate 3 report.**

---

## 9. Gate report format

Put each report in `docs/reports/phase-N-report.md` and commit it with the phase's code. Include:

1. What was built: files, endpoints, migrations.
2. Test evidence: exact commands and pass counts; browser verification at 375, 768 and 1280 for any UI change.
3. The completion criteria from §8, each marked met or not met, with evidence.
4. Deviations from this document and why.
5. Open questions and decisions needed from the owner.
6. Designs needed before UI work can continue.
7. Costs incurred (AI and Cloudflare) and current configured ceilings.

Do not describe anything as working unless you ran it. Say "not verified" when you didn't.

---

## 10. Still open (the owner decides; don't assume)

| Decision | Needed by |
| --- | --- |
| AI provider and model | Gate 0 |
| Auth provider | Gate 0 |
| Exact platform-prohibited wording | Phase 2 |
| Wording of the unified boundaries text | Phase 2 |
| Pilot creator, real prices and budget handling (is a fan budget required?) | Phase 2 |
| Currency beyond USD | Deferred |
| Raw conversation retention (doc 10 proposes 30 days) | Phase 3 |
| Global AI test budget ceiling (doc 10 example: $25) | Before any live provider call |
| Designs for every new UI state listed at Gate 0 | Before that UI is built |
| When, and whether, `ADULT_CATALOG_ENABLED` may ever be turned on | After compliance, outside Phases 0–3 |

---

## 11. Quick reference

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest
npm run test:e2e     # Playwright (reuses the dev server)
npm run lint         # oxlint, must be zero warnings
npm run build        # tsc -b && vite build
```

- Repo: `blendlytech/fan_director`, branch `main`. Commit coherent, verified chunks.
- Cloudflare account: "Scmillsc0809@gmail.com's Account". Wrangler is a devDependency (4.132) and the owner handles `wrangler login`.
- Playwright gotcha: `getByRole` ignores `inert`, so assert inertness with `element.inert`. Tests of route-dependent state must navigate in-app, because `page.goto` remounts everything.
