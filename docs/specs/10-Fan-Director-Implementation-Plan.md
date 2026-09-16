# Fan Director Studio — AI Director and Hosting Implementation Plan

Date: September 16, 2026  
Status: Proposed implementation plan; no production changes made  
Owner: Clay Mills  
Source: Fan-Director-Boutique-Design.md and the architecture discussion accompanying this plan

## 1. Intended outcome

Turn the boutique prototype into a working commission-planning application. Fans describe an idea, explore creator-approved options, see an accurate estimate, and submit a versioned Scene Card for creator review. The creator remains responsible for approval. Commission payment and finished-video delivery stay on the creator’s existing platform.

Launch with a platform-owned paid AI account. Include a limited amount of AI usage in the creator’s eventual subscription. Neither fans nor creators need an API key. Keep provider integration replaceable so a later provider change does not require rebuilding the fan journey.

Use Cloudflare Pages for the frontend, a Worker for the backend, D1 for application records, and R2 Standard storage for public demo and preview assets. Evaluate Cloudflare Stream only when managed video encoding and adaptive playback justify its cost.

> **Deviation (2026-09-16, owner-approved):** the hosted demo uses **Workers Static Assets** instead of Pages, because Cloudflare now recommends Workers for new sites and a later Worker backend can live in the same project. It is static files only (no Worker script, no bindings) — see `frontend/wrangler.jsonc`. Read "Pages" below as "Workers Static Assets" for the frontend.

This is a build plan, not a statement that those services are configured. The attached design describes a prototype. The current repository was not inspected for this document; Phase 0 must reconcile this plan with actual code and project instructions before implementation.

## 2. Scope and decisions

| Area | Initial implementation | Deferred |
| --- | --- | --- |
| AI billing | Platform pays provider; usage measured per creator | Creator bring-your-own-key option |
| Fan experience | Guided conversation, approved choices, editable Scene Card | Voice, AI images, AI video generation |
| Estimates | Backend calculates from versioned catalog | AI-generated prices or negotiated discounts |
| Creator workflow | Review, questions, changes, approval, decline | Automatic approval |
| Commission transactions | External payment and delivery | Integrated checkout and private commission-video hosting |
| Media | Product demo, public boutique previews, posters and captions | Large private media libraries |
| Creator subscriptions | Pilot access granted administratively; record entitlements | Automated recurring billing until pricing and processor fit are settled |
| Content scope | Nonexplicit planning and catalog choices matching the source document | Any expanded content scope requires provider and product review |

Bring-your-own-key is not a workaround for provider restrictions. Before selecting an AI provider, test the intended use case and review its current terms, privacy settings, retention, and account requirements. Do not claim compatibility with explicit conversations based on a nonexplicit demo.

## 3. Architecture and responsibilities

| Component | Responsibility | Important boundary |
| --- | --- | --- |
| Existing React frontend | Boutique, conversation, editable card, creator desk | Never contains provider credentials or authoritative pricing |
| Cloudflare Worker | Authentication, authorization, catalog validation, estimates, AI calls, submissions and usage limits | Derives creator access from authenticated identity; does not trust browser-provided ownership |
| AI provider adapter | Sends bounded context; returns structured suggestions | Cannot approve, charge, mark payment, or write directly to records |
| Cloudflare D1 | Creators, catalogs, sessions, cards, revisions, decisions, usage and audit events | Every private read/write scoped to the correct creator and fan |
| Cloudflare R2 | Public, approved marketing and preview assets | Never place private requests or finished commissions in a public bucket |
| Creator’s existing platform | Commission payment and final delivery | No assumed integration or automatic verification |

Use separate development, staging and production databases, buckets and credentials. Store the AI key as a backend secret. Never put it in frontend environment variables, source control, browser storage, URLs, or logs. Use separate provider projects or keys for testing and production where supported.

Use a maintained authentication service or library compatible with the chosen runtime. Select it during Phase 0 after checking current pricing, email requirements and product fit. Creator login is mandatory. Fans may start a draft with an opaque, server-issued session cookie; persistent cross-device access and submission require a verified identity or tested secure recovery mechanism. A typed platform handle is contact information, not proof of account ownership.

## 4. AI Director request lifecycle

1. The frontend sends the fan’s message, draft identifier, expected draft version and unique request identifier.
2. The backend verifies session ownership, message size, rate limits, creator entitlement and available AI budget.
3. It loads the creator’s current published catalog, boundaries, authoritative draft and limited conversation context.
4. It atomically reserves a conservative maximum call cost before contacting the provider. Concurrent requests must not be able to spend the same remaining allowance.
5. The provider receives a versioned instruction template and structured catalog. Fan text and catalog descriptions are treated as data, not instructions granting additional privileges.
6. The model returns a typed response: suggested option IDs, allowed field changes, a clarification question and unresolved requests. Reject unknown fields, invalid IDs, unsupported quantities and incompatible combinations.
7. Application code recalculates totals and budget differences in integer minor units, such as cents. Pricing and timing statements shown to the fan come from backend values or controlled templates. Avoid unrestricted model prose that can contradict the actual estimate.
8. Valid suggestions are presented to the fan. Changes are applied through the existing draft update mechanism with undo support. Stale responses must not overwrite later edits; reject or recompute against the current version.
9. Record actual provider usage and reconcile the reservation. If usage is uncertain after a timeout, retain a conservative charge reservation until reconciliation rather than allowing unlimited retries.
10. Return the updated authoritative card, estimate and next suggested action. Submission remains an explicit fan action.

Prefer one provider call per turn. Limit output size and conversation history; retain the authoritative card plus a compact conversation summary rather than resending an unbounded transcript. Any summarization calls also count toward usage.

If the provider fails, returns invalid output, or usage is exhausted, preserve the draft and offer manual catalog selection. Do not silently switch to a different provider with different data handling. Disable the send action while a request is pending and make retries idempotent at the application level. Upstream billing for ambiguous retries may still occur and must be budgeted.

## 5. Data model and workflow

| Record | Minimum information |
| --- | --- |
| Creator | Owner identity, boutique slug, branding, platform link, entitlement and content settings |
| Catalog version | Creator ID, published status, currency, options, price components, combinations, boundaries and delivery rules |
| Fan/session | Verified identity when required, session ownership, contact handle and session expiry |
| Draft / Scene Card | Owner, creator, catalog version, selected option IDs, budget, estimate, unresolved questions and revision number |
| Submission version | Immutable snapshot of scope, price breakdown, timing and fan acceptance |
| Creator decision | Actor, timestamp, reviewed version, decision, proposed changes and message |
| AI request / usage | Request ID, tenant, model, prompt version, token usage, reserved and actual cost, result and timestamp |
| Media asset | Creator, object key, visibility, type, size, duration where available and upload status |
| Audit event | Actor, action, affected record/version and timestamp; exclude secrets |

Index creator, owner, status and timestamp fields used by normal screens. Use foreign keys and version checks. Keep the client domain model aligned with the backend; the server is authoritative for money and permissions.

Workflow: Draft → Submitted → Creator review → Approved or Declined. A question leaves the request awaiting a response. Proposed changes create a new immutable offer version requiring fan acceptance. Approval must identify the exact accepted version; changed scope cannot inherit approval from an older version.

Approval is distinct from payment. External payment and delivery may be recorded manually by the creator, with actor and timestamp, and clearly labeled as creator-reported. No timer starts because a fan clicks an external payment link. The source design’s delivery clock starts only after payment confirmation.

At submission, revalidate availability and catalog version. If terms have changed, show the new breakdown and require acceptance rather than silently replacing prices. Preserve historical submitted terms for review.

## 6. AI costs and commercial model

Creators receive a monthly allowance; fans are not billed for individual AI messages. During a controlled pilot, record usage before promising permanent allowances or subscription prices. Count abandoned sessions, retries, summaries and failed billable requests—not just submitted commissions.

Suggested pilot configuration, subject to measured results:

- Maximum 20 AI turns per draft; manual editing remains available afterward.
- Maximum 2,000 characters per fan message and a bounded model response.
- One in-flight request per draft; per-session and per-creator rate limits.
- A small global test budget, for example $25, explicitly configured before live provider traffic. This is a spending ceiling, not a forecast or authorization to purchase services.
- Alerts at 50%, 80% and 95% of configured allowance; backend refuses new AI calls when budget cannot cover a reservation.
- Usage exhaustion affects AI assistance, not access to existing records or the creator’s review queue.

Set token ceilings, per-creator budgets and request reservation amounts only after testing the chosen model. Maintain a dated rate table, including any cached-input or reasoning-token charges applicable to that provider. Provider dashboard alerts alone are not a hard application spending limit.

Cost per call = input tokens × input rate + output tokens × output rate + other applicable provider charges. Convert published per-million rates to per-token rates before calculating.

Illustration only: at an assumed average of $0.02 per conversation, 1,000 conversations cost $20; at $0.10, they cost $100. These are sensitivity examples, not model quotes. Measure both cost per started conversation and total AI spend per submitted request.

Before commercial launch, choose subscription price and allowance using observed high-usage costs, hosting, authentication/email, support, billing fees and desired margin. Show a simple included-usage counter to creators. Begin with capped usage; add opt-in packs later if needed. Do not impose surprise overage billing.

## 7. Video storage and hosting budget

Start with one compressed product-demo MP4, a poster image and captions in R2. Keep the placeholder until an accurate recording exists. Use a browser-compatible encode with fast-start metadata and test seeking, captions and mobile playback. Serve public media through a production asset domain with correct content type, cache settings and byte-range behavior. Avoid loading the entire video before the viewer chooses to watch.

R2 stores files; it does not automatically create an adaptive streaming ladder. Add Stream if encoding work, buffering or device compatibility becomes a measurable problem. Keep an asset abstraction so changing storage does not require editing every boutique page.

| Service | Current planning reference | Upgrade or review trigger |
| --- | --- | --- |
| Pages | Static frontend; do not package large videos in app builds | Recheck platform limits before deployment |
| Workers Free | 100,000 requests/day; 10 ms CPU allowance per invocation | Measured CPU or request limits approach capacity; start investigating at 70% sustained usage |
| D1 | Proposed application database; quotas depend on plan | Monitor database size, scanned rows, writes and latency; index before upgrading |
| R2 Standard | 10 GB-month storage, 1 million Class A operations and 10 million Class B operations monthly free; internet egress free | Review asset growth and operations at 70% of allowance; usage beyond allowances may be billed |
| Cloudflare Stream | $5/month per 1,000 stored minutes of capacity; $1 per 1,000 delivered minutes | Use when managed playback is worth the additional charge |
| AI provider | Separate usage bill | Governed by backend budget and creator allowances |
| Authentication/email/domain | Provider and existing account dependent | Include in launch budget; free Cloudflare hosting does not cover these automatically |

Cloudflare limits and pricing were checked September 16, 2026. Free-tier suitability must be confirmed with the actual workload; waiting for a remote AI response is different from consuming Worker CPU. Benchmark validation, authentication and database work together before assuming Workers Free is sufficient.

For illustration, one three-minute video delivered in full 1,000 times through Stream is 3,000 delivered minutes, or $3 delivery, plus the minimum $5 storage allocation: approximately $8 for that usage. Buffering and preloading can add billed delivery. R2 may keep a small demo within its included allowances, but it is not an unlimited free video-hosting promise.

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Stream pricing](https://developers.cloudflare.com/stream/pricing/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

## 8. Implementation sequence and completion criteria

| Phase | Deliverables | Complete when |
| --- | --- | --- |
| 0 — Reconcile and select | Read repository instructions and project memory; inspect current frontend, draft reducer, catalog, routes and deployment; evaluate provider and authentication choices | Actual build state documented; provider sample conversations pass; no speculative feature treated as implemented |
| 1 — Backend foundation | Staging Worker, D1 schema/migrations, authentication, tenant authorization, secrets and shared validation | Two test creators cannot access each other’s drafts; save/reload works; secrets absent from frontend bundle |
| 2 — Catalog and estimates | Persist versioned catalog, enforce boundaries, server quote calculation and draft revision checks | Source examples calculate exactly; stale quotes require acceptance; browser tampering cannot alter authoritative prices |
| 3 — AI Director | Provider adapter, structured suggestions, context limits, usage reservations, fallback and kill switch | Valid suggestions update the card; invalid output changes nothing; concurrent calls cannot overrun the configured reservation budget |
| 4 — Submission and review | Explicit submit, immutable versions, creator queue, questions, changes, acceptance, approval and decline | A full fan-to-creator round trip works; old versions cannot approve new scope; no false payment confirmation |
| 5 — Media and operations | R2 demo assets, captions, production domain settings, metrics, deletion/retention tasks and recovery procedure | Demo seeks and plays on desktop/mobile; private records are not public; staged recovery succeeds |
| 6 — Controlled pilot | Small invited creator cohort, measured conversations, usability review and cost report | Launch checklist passes and observed quality/cost support a proposed subscription allowance |

Phases 1–4 are the main dependency chain. Public-demo media work can proceed once the asset approach is settled. Do not promise a completion date until Phase 0 identifies the actual remaining work and external setup dependencies.

## 9. Verification and launch checklist

- [ ] Reference estimate: $90 base + $35 lounge + $20 greeting = $145; $150 budget leaves $5.
- [ ] Adding $40 produces $185, which is $35 over budget; removing it restores $145.
- [ ] AI and direct browser requests cannot add unpublished options, change creator boundaries, invent discounts or bypass approval.
- [ ] A creator cannot retrieve another creator’s records; one fan cannot retrieve another fan’s draft by guessing its ID.
- [ ] Catalog changes, simultaneous tabs, stale AI responses, duplicate submit and undo preserve consistent versions.
- [ ] Unknown option IDs, malformed output, provider refusal, timeout, exhausted budget and provider outage leave a usable manual flow.
- [ ] Concurrent calls near a spending limit reserve costs atomically; ambiguous timeouts cannot create unlimited free retries.
- [ ] At least 30 representative provider test conversations cover normal requests, budget tradeoffs, unavailable choices and instruction-injection attempts. Every safety-critical catalog/price/approval check passes.
- [ ] Pilot report includes response latency, valid-response rate, abandonment, completed submissions, cost per conversation and cost per submission. Establish performance targets after measuring the baseline.
- [ ] Fan acceptance and creator approval refer to the same scope version. External payment remains separately reported.
- [ ] Mobile layout, keyboard navigation, focus, status announcements and reduced-motion behavior remain usable.
- [ ] AI keys and raw conversation content are absent from ordinary operational logs; provider data settings match the published explanation.
- [ ] Video playback, captions, seeking, caching and missing-video fallback work on desktop and mobile.
- [ ] Staging migrations, backup/export and a restore rehearsal complete before production data is accepted.
- [ ] Production can disable AI without hiding existing cards, approvals or manual selection.

## 10. Privacy, reliability and release operation

Send the provider only the context needed to plan the commission. Omit contact details and payment information. Propose a 30-day retention window for raw AI conversations and abandoned drafts, then finalize it with the product owner before launch. Keep submitted cards and decisions under a separate documented retention policy that supports the commission workflow. Deletion must cover application records, derived summaries and related assets where applicable; provider-side retention must be explained separately.

Use secure cookies, authorization on each private endpoint, CSRF protection appropriate to the authentication approach, input size limits and abuse throttling. Validate any upload type and size; restrict asset publishing to authorized creators or administrators. Age and content requirements must match the final market and provider policies before opening public access; the present plan does not establish legal compliance.

Deploy staging first. Record release identifiers and migration versions. Prefer backward-compatible schema changes so application rollback remains possible. Keep an AI feature flag and per-creator enablement. If a release fails, disable AI or revert application code while preserving accepted cards and audit records; restore data only through a reviewed recovery procedure.

Track errors, latency, usage reservations, actual charges, database growth and media usage with request IDs rather than message contents. Assign an owner for billing alerts, incident handling, provider key rotation and scheduled deletion tasks.

## 11. Decisions to close before implementation or launch

| Decision | Proposed default | Evidence needed |
| --- | --- | --- |
| AI provider/model | One economical model behind a replaceable adapter | Intended-content fit, structured-output quality, privacy, measured latency and cost |
| Authentication | Maintained runtime-compatible solution | Creator/fan sign-in and recovery flow, email delivery and total cost |
| Initial creator catalog | One curated nonexplicit pilot catalog | Creator-owned options, actual prices, boundaries and delivery rules |
| Pilot budget | Small explicit ceiling; example $25 | Selected model rates and tested reservation logic |
| Subscription and allowance | Set after pilot data | High-usage cost, conversion, support effort and creator feedback |
| Commercial subscription collection | Separate from fan commission payments | Processor suitability and entitlement/billing workflow |
| Retention | Short-lived raw conversation history | Operational needs, provider behavior and final privacy wording |
| Video scope | Demo/previews only; finished work delivered externally | Revisit only if creators demonstrate a need for private hosting |

The next implementation step is Phase 0: inspect the current repository and confirm the provider, authentication and catalog contracts. Then implement persistence and server-side pricing before connecting live AI.
