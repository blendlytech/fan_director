# Phase 0 gate report — Fan Director Studio

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
