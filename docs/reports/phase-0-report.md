# Phase 0 gate report — Fan Director Studio

> **Owner note, 2026-09-16.** Received from Astra and committed as written. The `docs/reports/phase-0-eval/` files it lists were not pushed and are not in this repository. The browser suite it could not run passed 24/24 (and unit tests 67/67) on the owner's machine at `fbc5324`. The §8.6 decisions are recorded in doc 11 §5.6, items 13–16. All Gate 0 decisions are now made; starting Phase 1 waits for the owner's go-ahead.

Date: 2026-09-16 (UTC). Repository: `blendlytech/fan_director`.
Baseline: initial audit at `73fa9253b9aa31af6b2eb77d758153d4566179d7`; revised against `main` at `e471f36`. Fetched fd93133, 7e74744, b9873c9, ba387da and e471f36, preserving local report work by rebase. No remote push or deployment.

**Gate 0: NOT MET. Stop before Phase 1.** Repository reconciliation and an offline evaluation setup are complete. Browser verification and live model/classifier measurements are blocked. Several specification contradictions require owner decisions. No feature code, deployment, cloud resource, provider inference call or secret change was made.

## 1. What was built, findings and recommendations

### Deliverables

- This report, in doc 11 §9 order.
- `docs/reports/phase-0-eval/README.md`: evaluation protocol, authorization requirements and scoring limitations.
- `director.schema.json`: exact Phase 3 response schema from current doc 11.
- `pilot.json`: compact general-catalog test context; not a production seed.
- `director-cases.json`: 12 two-turn sample conversations.
- `classifier-cases.json`: draft of 13 must-allow and 14 must-block classification cases, covering all ten hard-list keys.
- `check.py`, `requirements.txt`: offline schema/limited-semantic checker, classifier scorer and self-checks.
- `run-plan.json`: every live candidate marked BLOCKED, the owner-approved **$8 combined ceiling**, no confirmed test secret, and zero inference calls. Added `mock_check.py` and `mock-outputs.json` for local hostile-output checks.

All files after the first bullet are inside `docs/reports/phase-0-eval/`. No endpoints or migrations were created. Frontend source, package manifests, lockfile, designs and Wrangler configuration remain unchanged.

Doc 11 was read first, then docs 01, 10 and `frontend/README.md`, in order. An older checkout found in scratch was stale; it was not edited or used as the implementation authority. No AGENTS.md was found in this checkout. Current source confirms the single reducer, in-memory draft, hardcoded catalog, static creator records, scripted Director and static-assets-only configuration described in §2. Installed Wrangler is 4.132.0; its schema contains `assets.run_worker_first`. This does not establish the state of the Cloudflare account or hosted deployment, which was not inspected.

### DraftV2 migration map

Paths below are relative to `frontend/`. Source searches covered all of `src/` for `sceneCard`, `useCommission`, direct draft accesses and boundary wording.

| File / consumers | Required later migration |
| --- | --- |
| `src/domain/sceneCard.ts` | Owns every catalog constant, `Draft`, line items, setting/focus helpers, duration, brief, preview totals, entrance ranges and formatting. Move deterministic validation/quotes to shared code; dollars become cents; preserve display formatting at the UI boundary. |
| `src/state/commission.ts` | `CommissionValue` exposes Draft, line items, numeric budget difference, `Partial<Draft>` mutations. Introduce server revisions, nullable budget, capability/error state and typed commands. |
| `src/state/CommissionContext.tsx` | Derives totals from constants and BUDGET. Reconcile authoritative server quotes and discard stale responses; keep optimistic previews distinguishable. |
| `src/state/commissionReducer.ts` | Commits, notes, undo and reset share one transition. Undo must create a new server revision rather than restoring an old revision number. Server-generated ownership, IDs and boundary flags are not undoable browser fields. |
| `src/pages/BoutiqueEntrance.tsx` | Hardcoded collection metadata, SettingId mutation, price ranges and boundary panel. Read published catalog and common boundary renderer. |
| `src/pages/AIDirector.tsx` | SETTINGS, FOCUS_OPTIONS, BUDGET, extra-minute pricing, preview totals, setting/focus booleans, notes, removal actions, duration, card/mobile totals and boundary copy. Replace canned dialogue only in Phase 3. |
| `src/pages/ReviewScene.tsx` | Shared draft/quote, BUDGET, DELIVERY_DAYS, brief and included components; unified boundary rendering and pending custom request. |
| `src/pages/SendConfirmation.tsx` | Shared totals, setting, budget and delivery. Retain honest unsent status until actual submission exists; saving a draft is not submission. |
| `src/pages/SavedIdeas.tsx` | Draft title, components and total; distinguish confirmed persistence from pending/failed save. |
| `src/App.tsx` | FanJourney provider placement and route lifecycle; preserve in-app draft continuity. |
| `src/domain/sceneCard.test.ts`, `src/state/commissionReducer.test.ts` | Existing 67 tests; retain reference arithmetic and single-undo behavior while adding versioned domain cases later. |
| `e2e/fan-journey.spec.ts`, `saved-ideas.spec.ts`, `mobile-menu.spec.ts`, `not-found.spec.ts` | Existing 24 tests; expectations for demo disclaimers must continue to run against the demo; staging capabilities need separate expectations. |
| `src/data/requests.ts`, creator dashboard/detail/ask/decline pages and request-card consumers | Separate static creator records, not consumers of the fan Draft. Do not treat them as persisted submissions or migrate their workflow prematurely. |
| `src/pages/NotFound.tsx` | Direct-load copy says earlier work was not saved; needs a staging capability-aware design/copy review when persistence exists. |

Boundary copy is currently in BoutiqueEntrance (including lines 198/237), AIDirector (606–609) and ReviewScene (132–135). None was changed. Setting imagery and presentation metadata also need a contract; §6 Item does not yet carry the current image/alt/title fields. Keep `SceneImage`.

Mapping: richer → detailed greeting; longer → one extra minute + standard greeting; extraMinute → another unit. Notes remain notes; free-form custom requests remain unpriced. A fan's chosen nickname is not verified identity.

### Proposed layout and data design (not implemented)

Keep `frontend/`; add sibling `worker/` for API/auth/provider adapters and migrations, and `shared/` for dependency-light types, integer-cent arithmetic, catalog validation and boundary rendering. Avoid importing server configuration into shared/frontend code. Use an explicit staging config named for `fan-director-studio-staging`; do not modify the public demo config. `/api/*` runs Worker first and SPA handling remains for client routes. The installed schema supports the proposed routing option; current [Cloudflare static-assets documentation](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) describes SPA handling (accessed 2026-09-16).

Propose separate `fan-director-dev` and `fan-director-staging` D1 databases, with production separate later. Tables: creator, catalog, catalog_version, fan_session, draft, ai_request, audit_event, compliance_status, performer and safety_case. Add auth tables only for the selected auth implementation. Published catalog payloads are immutable snapshots; the catalog points to the current version. Drafts carry creator/owner/version/revision references. Use composite tenant constraints, foreign keys, integer checks and indexes on creator/owner/status/time. Revision changes use conditional writes. A request ID must uniquely identify a reservation/attempt; independent read-then-write budget checks are insufficient.

Safety-case evidence should have separate restricted storage/bindings and reviewer authorization; do not copy it into normal audit logs or creator queries. A second evidence database cannot provide cross-database foreign keys: use opaque references and a documented lifecycle. Exact retention, reviewer access and fan identity remain unresolved. No evidence store is provisioned.

### Auth evaluation

Sources accessed 2026-09-16; these are recommendations, not tested integrations.

| Option | Workers fit, pricing and operations | Assessment |
| --- | --- | --- |
| Clerk | Backend `authenticateRequest` supports verification from a standard Request. Hobby includes 50,000 monthly retained users; Pro is $25/month monthly or $20/month billed annually, with published overage pricing. Hosted login/verification reduces email/recovery work. [Backend verification](https://clerk.com/docs/reference/backend/authenticate-request), [pricing](https://clerk.com/pricing). | Recommended pilot auth, conditional on account/product-terms fit and owner approval. Design 16 requires creator MFA: budget for Pro rather than assume Hobby is sufficient. Verify issuer, authorized parties/origin and tenant membership server-side. No auth integration tested. |
| Better Auth | Standard Request/Response integration, Cloudflare Workers example and SQLite/D1 support; self-hosted core, optional paid infrastructure. It requires operating session storage, email/recovery and security updates. [Installation](https://better-auth.com/docs/installation), [database/D1](https://better-auth.com/docs/concepts/database), [product](https://better-auth.com/). | Viable alternative for control over identity data. Exact all-in email/hosting cost is unquoted; do not equate self-hosting with zero operating cost. Requires runtime/CPU and adapter validation. |

For either choice, anonymous fans receive an opaque, expiring, Secure/HttpOnly/SameSite cookie. Server-side owner checks apply to every private endpoint; add Origin/CSRF checks for cookie-authenticated writes. Invite-only creator access must not confer platform reviewer access. Design 16 now requires fan email-link sign-in (password only if approved), creator MFA and invitation-only enrollment. Reconcile this with §7's anonymous initial-session wording; recovery details remain to be confirmed. Auth is not age or consent verification. No SMS dependency is proposed. Clerk's suitability for the eventual adult business and the selected email flow is not verified; this conditional recommendation is not launch clearance.

### AI provider comparison

All prices are USD per million tokens; public-page snapshots accessed **2026-09-16**, not measured in this session. Published latency is not this app's end-to-end latency. No inference calls, account access or billable tests were made.

| Candidate / pinned host | Published input / output | Hosts and recent service data | Structured output and measured behavior |
| --- | --- | --- | --- |
| `sao10k/l3.3-euryale-70b` / NextBit | $0.65 / $0.75 | One listed host, NextBit. Page shows P50 latency 2.30s, 8 tokens/s, provider uptime 96.86%; model three-day availability 93.65% and reachability 100%. These are different metrics, not an SLA. | Page advertises JSON-schema response_format, no tools. Exact schema acceptance, first-attempt validity, refusals, role compliance and hard-list obedience: **NOT RUN**. [Model/host metrics](https://openrouter.ai/sao10k/l3.3-euryale-70b). |
| `mistralai/mistral-small-3.2-24b-instruct` / DeepInfra | $0.075 / $0.20 | Three listed providers: DeepInfra, Parasail and Venice. DeepInfra P50 0.58s, 31 tokens/s, uptime 99.89%; model three-day availability 99.91%. Pinning DeepInfra means only one authorized route until other hosts are reviewed. | Page advertises structured output and tools. Exact schema reliability, refusals, roles and hard list: **NOT RUN**. [Model/host metrics](https://openrouter.ai/mistralai/mistral-small-3.2-24b-instruct). |

No candidate passes selection yet. Mistral/DeepInfra is a reasonable **general pilot schema benchmark**, not a recommendation for erotic generation. Euryale has a single-host failure domain and material privacy/contract questions. Automatic fallback must not silently introduce an unreviewed host.

#### Terms and data handling

- **Euryale license chain:** the [Sao10K model card](https://huggingface.co/Sao10K/L3.3-70B-Euryale-v2.3) labels its license `llama3`, despite being based on Llama 3.3. The [Llama 3.3 license](https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama3_3/LICENSE) and [use policy](https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama3_3/USE_POLICY.md) impose restrictions including unlawful activity, sexual solicitation and misuse of sensitive information. The inspected policy does not impose a blanket ban on all consensual adult text. That is not affirmative approval of this commissioned-content business; resolve the derivative license metadata and scope with the host. Accessed 2026-09-16; the 3.3 license identifies the December 6, 2024 release.
- **Router:** [OpenRouter terms](https://openrouter.ai/terms), updated **2026-08-31**, require compliance with model/provider terms. §7(11) requires prior written approval for red teaming, explicitly including prompt injection. Following e471f36, required injection tests use a local fake provider, so this does not block the ordinary synthetic live suite. Only optional future real-provider injection testing requires written approval. No broad router prohibition on all consensual adult text was identified, but host terms still apply. [Data collection](https://openrouter.ai/docs/guides/privacy/data-collection) describes logging/privacy controls; actual account settings were not inspected. Do not promise zero retention from a router preference alone.
- **NextBit:** [terms](https://www.nextbit256.com/docs/terms-of-service), [privacy](https://www.nextbit256.com/docs/privacy-policy) and [DPA](https://www.nextbit256.com/docs/dpa), accessed **2026-09-16**; no reliable effective date was exposed in the reviewed text. The terms have broad automated-use language despite offering an inference API; obtain clarification on the API relationship. Privacy permits API-associated data retention up to 90 days. The DPA says customer personal data is not used to train/fine-tune models, and §§6/12 require a separate written addendum before processing special-category personal data, including sex-life information. **This application's real-person adult flow is not cleared under the standard terms.** The real-person addendum/confirmation is a **launch requirement**, not a blanket blocker for wholly synthetic tests without real personal data.
- **Mistral:** [Small 3.2 model card/license declaration](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506) identifies Apache 2.0. The [Mistral usage policy](https://legal.mistral.ai/terms/usage-policy/), effective **2026-06-11**, expressly excludes open-source models and customer/partner infrastructure from its scope. Do not incorrectly apply its hosted-product rules as the terms for DeepInfra's open-weight deployment. Apache licensing does not settle host suitability.
- **DeepInfra:** [terms](https://deepinfra.com/terms), modified **2026-08-17**, require lawful use, rights to data and compliance with applicable service orders; §11 includes restrictions on unauthorized vulnerability testing. No blanket consensual-adult-text ban was identified in the inspected terms, but business-use permission is not affirmatively established. [Privacy](https://deepinfra.com/privacy), modified **2026-08-15**, states inference inputs/outputs are not stored, sold or trained on without explicit consent. Verify endpoint/account exceptions and router settings before use. **Adult-use verdict: unconfirmed**, not approved or empirically tested.

Refusal rate for legal explicit adult generation: **unknown for both models**. This assistant cannot build or execute an erotic-generation/non-refusal optimization benchmark. No substitute neutral test is represented as satisfying that requirement. This limitation is distinct from the missing test-key setup; the $8 budget is approved.

### Hard-list classifier comparison

The generator's own safety flags cannot establish classifier correctness. Both candidates below remain unselected and untested. Custom policies are classification inputs, not proof that all ten platform keys can be detected reliably.

| Candidate | Capabilities and terms | Price, hosting, data, latency |
| --- | --- | --- |
| Llama Guard 3 8B | [Model card](https://huggingface.co/meta-llama/Llama-Guard-3-8B) describes a trained 14-category taxonomy, including sexual content; an exact custom-ten-key configuration is **not verified**. Standard safe/unsafe labels are not the Director JSON schema. [License](https://huggingface.co/meta-llama/Llama-Guard-3-8B/blob/main/LICENSE) is Llama 3.1; inherited use restrictions and any host contract must be reviewed. | No host selected or deployed. Current endpoint price, independent-host count, uptime and latency: **not verified**. Weight availability does not establish a hosted service. Self-host cost is infrastructure cost, not a verified per-token quote; no zero-cost claim. Retention depends on that unselected deployment. |
| `openai/gpt-oss-safeguard-20b` / Groq | [Model card](https://huggingface.co/openai/gpt-oss-safeguard-20b) supports supplied safety policies, requires Harmony formatting and declares Apache 2.0. Better documented fit for evaluating custom-category classification. Output parsing and category accuracy remain untested. | [Groq model list](https://console.groq.com/docs/models): $0.075 input / $0.30 output, advertised 1,000 tokens/s, **preview** status. One evaluated host; global host count and recent model uptime unverified. Throughput is not latency. Preview availability is unsuitable for an unconditional production commitment. |

Groq [AUP](https://console.groq.com/docs/legal/ai-policy), effective **2025-10-15**, prohibits illegal explicit material and broadly offensive/harmful uses, and provides an exception process. Review it alongside the [Services Agreement](https://console.groq.com/docs/legal/services-agreement) (accessed 2026-09-16; effective date not established here). Neutral safety classification is the model's intended task, but sending the complete sensitive/adversarial corpus still needs confirmation of applicable terms. No permission to submit illegal source material is inferred.

Groq [data documentation](https://console.groq.com/docs/your-data), accessed 2026-09-16, describes up-to-30-day reliability/abuse retention and customer-configurable ZDR; account settings were not inspected. Model weights do not train themselves on API requests; actual host training/data controls must be recorded before running. Classifier first run, false-positive/false-negative rates, key attribution, schema compliance and latency are **NOT RUN**. The offline scorer does not classify text or prove model quality. Recommend testing Safeguard's custom-policy fit first only after authorization/terms checks; no classifier is selected for production.

### Updated test-content routing (ba387da / e471f36)

General provider confirmations are launch requirements, not blanket blockers for ordinary synthetic tests. **Hard-list cases never go to generation models.** Local rules tests use the hard-list fixtures; external classifiers may receive only short, non-graphic classification inputs when their terms permit safety classification. Minor-related cases contain no sexual description anywhere. Output checks receive synthetic text locally, never model-requested violations.

Injection cases D11/D12 now declare `allowedTargets: ["mock"]`; ordinary Director cases use `generation`, classifier fixtures use `local`/`classifier`. The setup has no network client. Four hostile fake-provider outputs exercise malformed JSON, a made-up price field, an unknown item ID and an approval claim. This verifies only the Phase 0 harness; it is **not evidence that the unbuilt server validation works or that a real model resists injection**. No Phase 2 rules engine or Phase 3 application feature was implemented.

## 2. Test evidence

All four required frontend commands were rerun after fetching e471f36: 67 unit tests pass, lint/build pass, and all 24 browser tests still fail to launch due to the missing Chromium executable. Commands ran from `frontend/` unless stated otherwise. No source fixes were made to turn failures into passes.

| Exact command | Observed result |
| --- | --- |
| `npm ci --ignore-scripts` | Installed 170 packages; lockfile unchanged. |
| `npm test` | **67 passed**, 2 files. |
| `npm run test:e2e` | **0 passed / 24 failed at browser launch**, all missing Playwright Chromium headless-shell v1243. Vite started, but no browser assertions ran. This is an environment blocker, not evidence of 24 application defects. |
| `npx playwright install chromium` | Failed after repeated 30-second CDN download timeouts. No local Chromium executable was found. |
| `npm run lint` | Exit 0; no lint diagnostics/warnings. npm emitted an environment `http-proxy` configuration warning, distinct from lint output. |
| `npm run build` | Exit 0; TypeScript and Vite 8.3.0 build successful, 49 modules. |
| `node -p 'require("./node_modules/wrangler/package.json").version'` | 4.132.0. |
| `rg -n 'run_worker_first' node_modules/wrangler/config-schema.json` | Property present. |
| From repo root: `PYTHONPATH=/workspace/scratch/f86120702689/eval-deps python docs/reports/phase-0-eval/check.py --self-test` | **11 offline checks passed**; zero provider runs. Python jsonschema 4.26.0 installed in scratch, outside the app. |
| Same prefix with `python docs/reports/phase-0-eval/mock_check.py` | **4 hostile mock outputs rejected; 3 routing/budget metadata checks passed**. No application/server validation claimed. |
| Same prefix with `python docs/reports/phase-0-eval/check.py` | BLOCKED manifest; liveEnabled false, calls 0, measuredMetrics null. Initial budget was null; revised manifest records the approved $8. |

The app's dev server started through Playwright. Actual browser rendering/interactions and hosted deployment state: **not verified**. No UI changes were made, so the 375/768/1280 UI-change gate is not applicable; no visual pass is claimed at those widths. The 24-test suite must be rerun where its Chromium dependency can be installed. No API/auth/classifier performance was tested.

## 3. Phase 0 completion criteria (§8)

| Criterion | Status | Evidence |
| --- | --- | --- |
| Run whole suite/app; reconcile §2 | **Not met** | Unit/lint/build pass; Vite starts. Browser suite blocked. Source matches demo description; designs 16–19 are now present and reviewed. |
| Map catalog, Draft and boundaries | **Met** | Migration map and whole-src searches above. |
| Propose code/Worker/D1/shared layout | **Met as proposal** | Above; nothing provisioned or implemented. |
| Evaluate auth/docs/pricing; recommend | **Met as conditional recommendation** | Clerk vs Better Auth; owner selection and integration proof pending. |
| Evaluate providers; run ≥10 conversations | **Not met** | Two candidates reviewed; 10 ordinary conversations and 2 mock-only injection conversations prepared; all live runs blocked. No refusal or reliability claims. |
| Evaluate classifiers; first draft-set run | **Not met** | Two candidates reviewed; 27 draft cases prepared, no live classifier run. Exact custom-category support for Llama Guard unverified. |
| Inventory missing designs | **Met for checked-out baseline** | Section 6 identifies existing and missing designs; designs 16–19 now confirmed. |

## 4. Deviations, contradictions and impossible guarantees

No specification was silently amended. These findings stop implementation at Gate 0:

1. **Selection model is insufficient.** Category-wide min/max cannot independently require a base video and one orientation, or exactly one greeting plus optional delivery inside a mixed category. Propose explicit selection groups/required item semantics for owner approval. Do not invent those rules inside quote code.
2. **New combinations conflict with required old price ranges.** Independent greeting/runtime choices allow Vintage $125–$225, Floral $135–$235 and Backstage $105–$205 (base + setting + standard/detailed greeting + 0–2 minutes), unlike §4.1's required $145–$205 / $155–$215 / $125–$185. Preserve old buildable-combination constraints or approve new ranges; displaying old minima while allowing cheaper combinations would be false.
3. **Adult test path conflicts with the switch prohibition.** §5.4 forbids code/test fixtures from enabling the switch, yet requires testing the enabled path in Phase 3 while activation is deferred outside Phases 0–3. Owner must define an authorized isolated test mechanism; none was created.
4. **Rules cannot be context-free term bans.** Blocking every family/school token contradicts mandated must-allow near misses. Rules need contextual definitions and tests, not a blanket regex. “Always shown” hard-list wording also conflicts with §5.3.4/design 13 allowing the Director list behind a link; explicit precedence should be recorded.
5. **Legal is not equivalent to platform-allowed.** Named fictional characters and adult school/family-role requests are platform exclusions even where local law might not prohibit them. Preserve the hard list, but do not claim it is only a universal legality test. No classifier can establish legality across all jurisdictions or promise zero future errors; a finite zero-error test gate is feasible, a universal guarantee is not.
6. **Safety reporting is not ready as specified.** A keyword/role hit is not a legal conclusion; IP location is not verified local jurisdiction. [18 USC 2258A](https://www.law.cornell.edu/uscode/text/18/2258A) links duties to defined apparent violations and facts/circumstances, not every fictional request or term match. Counsel must reconcile criteria, retention, country routing and due process. Reporting remains out of scope. The anonymous-session model cannot truthfully populate design 15's verified-ID/account fields without additional identity work. Do not fabricate them.
7. **Phase scope overlaps submission/publish/editor work.** Phase 2 requires submission rejection and publish checks while submission is Phase 4 in doc 10 and editor UI is deferred. Agree whether Phase 2 tests an internal validation boundary only. Design 13's creator interaction must not silently expand editor scope.
8. **Response schema under-specifies semantics.** `qty` is optional even for `setQty`; remove/zero-quantity behavior is unspecified; flags can reference nonexistent indices/limits. String lengths alone cannot stop prose pricing/approval claims, and other output text fields can also contain them. Exact schema copied unchanged; full application semantics need approval before implementation.
9. **Verification references are incomplete.** Performer consentRecordId has no defined consent-record schema/provider; compliance booleans alone are not evidence. Creator verification is also required before appearing, but pilot identity verification is deferred. Distinguish synthetic demonstration performers from verified real people.
10. **Evaluation status:** $8 combined ceiling approved. Test secret has not been confirmed configured; no live runner is implemented. General provider confirmations and real-person sensitive-data addenda are launch requirements. Injection tests now use the local fake provider, so external red-team approval is not a Phase 0 blocker. Erotic-generation/non-refusal benchmarking remains outside this assistant's supported scope; neutral tests do not satisfy that measurement.
11. **Environment/design update:** browser CDN was unavailable in the initial run. Designs 16–19 have arrived and resolve the core-state gaps. Design 16's one-time age-verification/legal claims still need verification-provider/counsel review. Its creator form shows email + authenticator code without a completed first-factor step. Design 17's failed-reply allowance must remain distinct from cost: failed billable attempts still count against the $8 ceiling.

## 5. Owner decisions needed

- Designs 16–19 arrived in 7e74744 and were reviewed; this former blocker is resolved.
- Resolve selection groups and reachable price-range requirements before DraftV2 implementation.
- Approve an auth direction and decide fan identity/recovery and platform-reviewer authorization.
- Resolve the switch/test-path conflict for later application work. Obtain provider/data confirmations before launch; ordinary wholly synthetic tests need no general confirmation letter.
- Before any future authorized inference, set a test secret yourself with `wrangler secret put` against the agreed test environment The **$8 combined ceiling**, including retries, is already approved; no repeat approval is needed. **No secret value is requested.** No staging environment was created in this phase.
- Required injection tests run locally against the fake provider. Written provider authorization is needed only if real-provider injection testing is later requested. General adult-use confirmations remain launch requirements.
- Confirm classifier choice, block threshold, retention, consent evidence and counsel-reviewed reporting criteria. Current report makes no legal-compliance determination.
- Clarify Phase 2 submission-validation scope and approve exact unified boundaries wording.

These are recorded decisions, not a request to proceed to Phase 1. Stop here.

## 6. Designs needed before UI work

Designs 13–19 are present after fetching 7e74744. Their HTML/state copy was inspected; browser rendering and implementation remain unverified. Earlier missing-core-design findings are superseded.

| State | Coverage / remaining design questions |
| --- | --- |
| Limits, Ask me, Hard no, hard-list notice | Design 13; disclosure inconsistency remains. |
| Paused, restored, closed account | Design 14. |
| Safety review / disabled reporting | Design 15. Missing identity/evidence, forbidden access, failed decision and concurrent review still need confirmation. |
| Fan sign-in, sent link, expired link | Design 16 A–A2. Network errors, throttling and recovery details need confirmation. |
| Age verification: start, pending, success, failure | Design 16 B. Partner placeholder and one-time/legal claims need validation. |
| Creator login/MFA | Design 16 C. First factor, invitation acceptance and MFA recovery need confirmation; chosen auth plan must support MFA. |
| AI pending/suggestions/accepted/rejected/stale | Design 17 A–C. |
| AI unavailable, reply allowance exhausted, manual selection | Design 17 D–F. Classifier outage/rate-limit mapping needs confirmation. |
| Saving/saved/failure/signed out | Design 18 A. Saved-list empty/loading/restore failures still need confirmation. |
| Concurrent edits, revised prices, removed item, acceptance required | Design 18 B–C3. Conflict-detail destination and undo conflicts not fully specified. |
| Unpriced custom request / unavailable customs / review / creator detail | Design 19 A–C; maximum 1,000 characters. Validation-error details and later response workflow remain open. |

No UI was created. Designs do not establish that authentication, age verification, persistence or submission works.

## 7. Costs and configured ceilings

- Provider inference: **$0 incurred by this work; 0 calls**. Classifier inference: **$0; 0 calls**.
- Cloudflare: **no billable deployment/resource operation performed**. Account-wide existing charges were not inspected.
- Owner AI ceiling: **$8 combined across models/classifiers and retries**, approved in this conversation; replaces the illustrative $25 in doc 10. Offline run plan has no live execution capability. No account-level Cloudflare ceiling configured or verified.
- Future cost planning only: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) lists Paid from $5/month; [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) lists Free allowances of 5 million rows read/day, 100,000 written/day and 5 GB total storage (accessed 2026-09-16; D1 page updated 2026-04-21). These are account/service allowances, not an approved spend or a guarantee that auth/classification fits Free CPU limits.
- Baseline dependency installation and offline tests were local. No service purchase, email delivery, GPU rental or paid authentication plan was initiated.

**Phase 0 work stops with this report. Gate approval, successful provider measurements and Phase 1 are not claimed.**

---

## 8. Gate 0 addendum — changes through `fbc5324`

Date: 2026-09-17 (UTC). Reviewed against remote `main` at `fbc53246f16660f5ee9fcbd3b568c71d27bec396`. This addendum supplements the report above; where the earlier report says live evaluation was not run or designs 20–22 did not exist, this section and `docs/reports/phase-0-live/RESULTS.md` are newer.

The owner's live runs spent **$0.23 of the approved $8 ceiling**. Round 2's item-id-only Director task reached 94% strict with Qwen3 235B Instruct 2507 and 86% with DeepSeek V3.2. `gpt-oss-safeguard-20b` made no false blocks and missed none of the 28 classifier cases, but twice mapped childlike behaviour to `prohibited_roles` instead of `minors`. Before Phase 3, the deterministic rules layer must map childlike behaviour to `minors`, and a classifier `prohibited_roles` result involving a child must be escalated to `minors` so the safety-case path opens. The candidate recommendations are therefore Qwen3 235B for the Director, DeepSeek V3.2 as fallback, and Safeguard 20B for classification, subject to the still-open owner selections, host/terms checks and the larger gate suites. Doc 11 §8's current Phase 3 response contract remains unchanged until the owner approves replacing it with the round 2 contract.

Doc 12 and designs 21–22 were read for context only. They belong to Phase S after Gate 4; nothing from them is included in Phases 1–3.

### 8.1 Migration map for the added contract

| Contract addition | Shared/domain migration | Storage, seed and API migration | Frontend consumers |
| --- | --- | --- | --- |
| Selection groups and expanded `personalization_delivery` | Add group-aware validation for `greeting`, `name_use`, `fan_script` and `delivery`; identify behavior by stable keys/ids, never labels. | Seed each group with its approved min/max and starter items. Persist the immutable category/item snapshot inside each catalog version. | Entrance, Director Scene Card, Review, Confirmation and Saved Ideas render group choices from catalog data. |
| `rights_quality` | Add required `rights` and `resolution` groups. Include both in selection validation, quote lines and template validation. | Seed resellable/exclusive and HD/4K items in published version 1. | Design 20 states B–C; the resale notice must also appear on Review. |
| Adult `specialty_acts` | Treat it exactly like the other adult categories in the server-side filter and provider-context builder. Financial domination remains an adult, `ask_me` item and cannot carry real payment instructions. | Define the category empty, disabled and `contentRating: "adult"`; no deployed seed enables it. Future items require compliance and owner-approved checklist entries. | No Phase 1–3 visible item while the switches are off. Do not build doc 12 UI. |
| `Item.pricing.kind: "percent"` | Extend the shared pricing union and quote engine with integer basis points and half-up rounding. | Persist `basisPoints`; reject negative/out-of-range or malformed pricing at catalog publish. Seed exclusive and rush at 5000 basis points. | Render the server-returned amount and percentage label; never calculate authoritative money in a component. |
| `CatalogVersion.pricingNote` | Add nullable, trimmed text with a 400-character limit and hard-list validation at publish. | Add the field to immutable catalog-version storage, seed and published-catalog response. | Show the server value on Entrance and Review; omit when null. |
| `CatalogVersion.templates` / `Template` | Validate a template through the same selection, gating and quote functions as a draft. Invalid or hidden templates are excluded, never repaired. | Persist templates with the version. Seed four general templates; define the fifth only on the adult-gated path. | Entrance applies selections as one reducer command. Prices come from the template's cheapest valid server quote. |
| `DraftV2.fanScript` | Add nullable text, maximum 3,000 characters, checked like `customRequest`. Require the `fan_script` item when text is present and reject a selected script item without valid text; the AI never rewrites it. | Add the draft column/JSON field and include it in save, reload, revision conflicts and safety validation. | Design 20 state D plus save/conflict states from design 18; remove requires confirmation before discarding text. |
| Personalised-video resale rule | Add a cross-group invariant over `name_use`, `fan_script` and `rights`. | Enforce on every draft write, quote and template validation, independent of browser state. | Disable resale with the design 20 explanation, while still handling a typed server rejection from stale/tampered input. |
| `MarketingConsent` | Add server-owned append-only consent events; current state is the latest row for `(fanId, creatorId)`. | Add `marketing_consent` with indexes on fan/creator/time. Email comes from the verified Clerk identity; wording text/version, source, IP and user agent come from trusted server context. | Fan sign-up/onboarding, account settings and unsubscribe states in design 16. No email sender is built. |
| Updated roles and hard-list routing | Add babysitter/nanny, relationship roles and named-character cosplay to prohibited-role rules. Add vampire, succubus, witch and elf to must-allow fixtures. Map childlike behaviour to `minors`. | Version rule data and audit subjects; do not store blocked wording except in a `minors` safety case as doc 11 specifies. | Existing designs 13–15 cover the normal block and review paths; fixed labels must be reconciled as noted below. |

The earlier file-by-file DraftV2 map still applies. In particular, `sceneCard.ts` stops owning prices and choices, the reducer receives one atomic template/selection change, the Worker owns accepted revisions and quotes, and the current creator seed records remain separate from persisted fan drafts.

### 8.2 Shared quote implementation: percentages and resale

Implement one dependency-light `quoteDraft(catalogVersion, draft, gateConfig)` module in `shared/`, used by the Worker and unit tests. The browser may call the same pure function for an explicitly provisional preview, but only a Worker quote is authoritative.

Quote order is deterministic:

1. Validate the catalog version, adult gating, item existence/visibility, group cardinality, quantities, `requires`/`excludes`, script coupling and the personalised-video resale invariant. Return typed errors; never repair a draft.
2. Create all `fixed`, `per_unit` and `included` lines. The percentage basis `S` is the sum in cents of fixed and per-unit lines only. Included lines contribute zero; custom requests never enter `S`.
3. For every percent item independently, calculate `floor((S * basisPoints + 5000) / 10000)`. With non-negative integer inputs this is round-half-up to the nearest cent. Every percent line uses the same `S`; percent lines never compound or become another line's basis.
4. Total the base lines and independently rounded percent lines, then derive minutes, delivery days (minimum one), budget difference and `customRequestPending`.

The server determines personalization from stable catalog semantics: any selected `name_use` item other than the stable `no_name` item, or a selected `fan_script` item, makes the draft exclusive. If the stable `may_resell` item is also selected, return a typed error such as `PERSONALISED_VIDEO_RESALE_FORBIDDEN` with only the conflicting item ids needed by the client. Labels and fan text do not decide the rule. A non-personalised resellable draft remains valid and carries the always-visible resale notice from design 20.

Unit and API tests must cover half-cent rounding, multiple simultaneous percentage lines sharing one basis, per-unit quantities, zero/included lines, exclusion of custom requests, no compounding, overflow/range guards, edited client prices, every name-use/resale combination, script/resale, script text without its item, the item without valid script text, stale revisions and tampered hidden/adult items.

### 8.3 Clerk sign-up and marketing consent

The remote `staging/clerk-auth` branch is one commit ahead of its old base but 12 commits behind `fbc5324`. It conditionally installs `ClerkProvider`, then opens Clerk's prebuilt `SignInButton` and `SignUpButton` modals. That is useful setup work, but it does **not** meet §5.8 because the prebuilt sign-up modal cannot collect the separate creator-specific checkbox. Do not merge the branch as-is; first rebase it onto the approved Phase 1 base and replace the sign-up path.

Recommended flow: keep Clerk as the identity authority, then use the contract's allowed **one-time post-sign-up consent step** before the new fan enters the Director. This avoids attaching `source: "signup"` to an existing user's ordinary sign-in and avoids placing consent intent in Clerk client-writable metadata. The step must use the design 16 checkbox copy, start unticked, be skippable, and be scoped to the creator whose boutique the fan entered. This placement needs the small design addition listed below because design 16 currently shows the checkbox inside a combined sign-in/sign-up form.

On successful Clerk sign-up, the Worker verifies the session and verified email, resolves `fanId` and `creatorId` server-side, and accepts the optional choice with a CSRF-protected request. If checked, it appends `subscribed` with the server-owned wording version and exact rendered wording, `source: "signup"`, request IP, user agent and timestamp. If skipped, no consent is inferred and no subscribed row is written. Settings changes append `subscribed` or `unsubscribed` rows with `source: "settings"`; rows are never updated or deleted. Repeated callbacks are idempotent by an event/idempotency key.

The unsubscribe endpoint verifies an HMAC-signed opaque token using a Worker secret set only with `wrangler secret put`. It resolves the fan, creator and email binding server-side, appends an idempotent `unsubscribed` row with `source: "unsubscribe_page"`, and reveals no account data. Invalid or altered tokens do not change consent. Nothing in Phase 1 sends marketing email. Before implementation, decide whether future email-client prefetch protection requires a confirmation page or an RFC 8058 POST path; the current one-click copy and the missing error states need the design/counsel decision below.

### 8.4 Doc 11 versus designs 16 and 20

No price arithmetic or resale example in design 20 contradicts doc 11: its $170 basis and $85 exclusive line correctly exclude percentage lines from the basis, and its personalised/resellable states match §5.7. The displayed figures are design fixtures only; implementation still derives every amount.

The remaining conflicts or underspecified joins are:

1. **Consent placement/source:** doc 11 permits a custom form or a one-time post-sign-up step and defines `source: "signup"`; design 16 puts the checkbox in one combined sign-in/sign-up form. That form cannot reliably distinguish a new signup from an existing sign-in before authentication. Use the post-sign-up step above and approve its design, or split design 16 into separate custom sign-in and sign-up forms.
2. **Exact wording:** design 16 has a short label plus explanatory promises. §5.8 requires the exact wording shown to be provable by version. Treat the label and helper text together as the versioned wording; do not store only the label.
3. **Consent failures:** design 16 shows subscribed and unsubscribed success states, but not save-pending, save-failed, invalid/tampered unsubscribe token or already-unsubscribed states. The server cannot show success until the append succeeds.
4. **Pricing note on Review:** doc 11 requires `pricingNote` on Entrance and Review. Design 20 shows it on Entrance but not in either Review/Scene Card example. Review placement needs design approval.
5. **Fan script controls:** design 20 shows the textarea after the script item is active, but does not show the control that adds/removes the item or the confirmation before discarding entered text.
6. **Name capture:** design 20 shows “Sam” and requires `fanDisplayName` for name-use items, but does not show where a fan enters or edits that nickname or its validation/error state.
7. **Honest save copy:** design 20's “Saved to your account” is valid only after a successful server revision. Pending and failed saves must use design 18 rather than displaying that line optimistically.

Separately, doc 11's fixed `prohibited_roles` fan label (“School, student, childlike, family or step-family roles”) does not name babysitter/nanny, relationship roles or named-character cosplay even though the rule now blocks them. That is a doc 11/design 13 wording issue, not a reason to weaken the rule; owner-approved unified wording is still required in Phase 2.

### 8.5 Designs still needed before Phases 1–3 UI

| Phase | Missing or incomplete visible state |
| --- | --- |
| Phase 1 | The recommended post-sign-up news-consent step; consent save pending/failure/retry; invalid or altered unsubscribe token and already-unsubscribed handling; Clerk invitation acceptance, authenticator enrollment and creator recovery/backup-code failure states if Clerk's approved flow does not supply acceptable hosted equivalents. |
| Phase 2 | Pricing-note placement on Review; fan nickname entry/edit/validation; add/remove fan-script control and discard-text confirmation; typed personalised-resale conflict after stale/tampered input. Unified boundaries wording must be approved, including the expanded prohibited-role label. |
| Phase 3 | No new screen is required merely for the round 2 model contract: design 17's thinking, suggestions, clarification, unavailable and manual fallback states can render server-written text and server-built options. If the owner approves the round 2 contract, design 17 should receive a copy-only annotation that model notes are never fan-facing. Existing designs still need an explicit mapping for classifier outage versus general AI outage and for a hard-list block discovered in AI output after the one allowed regeneration. |

Hidden invalid templates, stripped hard-no options, adult categories while gated off, provider retries and classifier-key remapping are server behavior and do not need standalone screens. Designs 21 and 22 are not Phase 1–3 gaps.

### 8.6 Gate 0 decisions still required

- Approve Qwen3 235B Instruct 2507 as Director primary and DeepSeek V3.2 as fallback, or choose another pair.
- Approve `gpt-oss-safeguard-20b` as the classifier candidate, with rules-layer fallback/fail-closed behavior and the required larger evaluation.
- Decide whether doc 11 §8 changes from the existing operation-and-text schema to the round 2 item-id-only contract. Until then, neither schema is implemented.
- Approve the post-sign-up consent placement and the missing designs/copy above.

### 8.7 Addendum verification

After this documentation-only change, `npm test` passed 67/67, `npm run lint` exited cleanly with no diagnostics, and `npm run build` succeeded. `npm run test:e2e` again reached the 24-test suite but all 24 failed before executing an assertion because Playwright Chromium headless shell v1243 is not installed at `/root/.cache/ms-playwright/`. This is the same environment blocker recorded above, not a new application failure. No UI or runtime source changed, so width-specific visual verification is not applicable.

**Gate 0 remains unapproved. Stop before Phase 1.**
