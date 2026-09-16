# Phase 0 live results: AI Director models and hard-list classifiers

Date: 2026-09-16. Run on the owner's machine with the owner's OpenRouter test key (doc 11 §5.6 decision 11), because Astra's workspace couldn't reach the key. This is an addendum to Astra's Phase 0 report. It fills the rows that report marked **NOT RUN**.

**Total spend: $0.08 of the $8 ceiling**, over 214 calls.

## What was run

| Item | Detail |
| --- | --- |
| Runner | `run.py` in this folder. Reads the key from the repo-root `.dev.vars`, never prints it, stops before a call could pass its budget, retries 429s with backoff. Raw outputs go to `results/`, which is gitignored. |
| Catalog | `catalog.json`: the pilot catalog with selection groups (§5.6 decision 1), the four adult categories switched on **for this test process only** (decision 3), one synthetic partner performer (decision 9), the hard list, and design 13's example creator limits. |
| Director cases | `director_cases.json`: 12 legal cases (normal, budget trade-off, two hard-no limits, ask-me limit, two legal explicit requests, a nurse-costume status role, custom request, vague, price question, edit). **No hard-list case and no prompt-injection case was sent** (§5.3.3). |
| Classifier cases | `classifier_cases.json`: 14 must-allow and 14 must-block, short and non-graphic, covering all ten hard-list keys. Minors cases contain no sexual description. |
| Response format | Doc 11 §8 Phase 3 JSON schema, sent as a strict `json_schema` response format, with the provider pinned (`allow_fallbacks: false`, `require_parameters: true`, `data_collection: deny`). |
| Prompts | v1 (first draft, 1 run per case), then v2 (clearer ask-me vs hard-no, selection-group and money rules; 3 runs per case). |
| Checker | JSON schema; item ids exist; `setQty` has qty ≥ 1; flags point at real suggestions and limits; every suggestion applied to the draft and checked against selection groups, max quantity and `requires`; no money or approval wording in any text field; ask-me flags present; case expectations. Every reply was also read by hand. |

## AI Director models

Prompt v2, 3 runs of each of the 12 cases. Percentages are of calls that returned a response.

| | Euryale L3.3 70B (NextBit) | Mistral Small 3.2 24B (DeepInfra) |
| --- | --- | --- |
| Price per million tokens, in / out | $0.65 / $0.75 | $0.075 / $0.20 |
| Spend for 36 calls | $0.050 | $0.0065 |
| Upstream rate limits (HTTP 429) after retries | 1 of 36 | **8 of 36** |
| Valid JSON matching the schema | **35/35 (100%)** | 27/28 (96%); one broken JSON |
| Fully correct (no checker issue) | 19/35 (54%) | 15/27 (56%) |
| Suggestion breaks a selection rule (e.g. two greetings, none) | 6/35 (17%) | 6/27 (22%) |
| Money written in a text field | 3 | 3 |
| **Refused or moralized about legal explicit content** | **0** | **0** |
| Explicit or costume request returned no suggestions | **3/9 (33%)** | 0/8 |
| Reply opens with "I can't…" (usually while still suggesting) | **12/35** | 0 |
| Treated an ask-me limit as not offered | 3 | 2 |
| Median latency | 5.8s | 8.0s |

What reading the replies showed:

- **Neither model refused legal explicit requests** between the creator, the fan and the verified partner. Both planned them plainly. The owner's main worry about mainstream models doesn't show up with either of these two.
- **Euryale is unreliable as a planner.** It often opens with a stock "I can't help with that" even when its suggestions are fine, and left the nurse-costume request empty 2 of 3 times. It mixes up "Ask me first" and "Hard no".
- **Mistral Small plans more accurately** but its only pinned host rate-limited 22% of calls, and it sometimes invents rules ("Maya can't speak to you by name in POV"). It once volunteered adult add-ons for an anniversary greeting under prompt v1.
- **Both models regularly produce suggestions that break selection rules, and both occasionally write money amounts.** This confirms doc 11's design rather than a model choice: the server must validate every suggestion, drop invalid ones, and reject any text that states a price.
- **Leak to fix in the product:** Mistral told the fan "Leo is a synthetic performer", because the test catalog included the internal `isSynthetic` flag. The provider context must only ever contain fan-facing fields.
- Prompt v2 cut selection-rule breaks from 42–55% to 17–22%. Prompt work helps, but doesn't remove the need for server validation.

**Recommendation.** Neither passes a production gate yet (roughly 55% fully correct). For Phase 3, start with **Mistral Small 3.2** for the structured Director, because it is more accurate, never emptied an adult request and costs a tenth as much, **but only with at least two hosts allowed** (DeepInfra plus Parasail or Venice, after their terms are checked) to get past the rate limits. Keep **Euryale** for the separate creative-draft feature (doc 12), where prose quality matters and strict JSON doesn't. Re-run this suite at Gate 3 with the real prompt and the ≥30 conversations doc 11 requires.

## Hard-list classifiers

2 runs of each of the 28 cases.

| | gpt-oss-safeguard 20B (Groq), our policy in the prompt | Llama Guard 4 12B (DeepInfra), built-in categories |
| --- | --- | --- |
| Legal adult content wrongly blocked | **0/28** | 8/28, all as "S12 sexual content" |
| Hard-list cases missed | **0/28** | 26/28 |
| Right key named | 26/28 | 0/28 |
| Median latency | 0.49s | 0.38s |
| Spend for 56 calls | $0.0034 | $0.0022 |

- **gpt-oss-safeguard did exactly what doc 11 needs** on this set: it allowed every legal adult case, including the nurse, doctor and police costumes, rough-but-consensual play and the near-misses ("my 18th birthday", "my sister recommended you", "a fan since school"), and blocked every hard-list case.
- Its only slip: "the fan wants Maya to behave like a child" was labelled `prohibited_roles` instead of `minors`, both times. It was still blocked, but **only `minors` opens a safety case** (§5.3.3). Fix before Phase 3: a childlike-behaviour rule in the rules layer that maps to `minors`, and treat any classifier `prohibited_roles` hit whose text mentions a child for review as `minors`.
- **Llama Guard 4 is unsuitable** through this API: without custom categories it blocks legal adult content as "sexual content" and misses almost every platform rule, including minors framed without sexual detail.

**Recommendation.** Use **gpt-oss-safeguard 20B** as the classifier layer, subject to Groq's acceptable-use terms for safety classification (Astra's report §1) and a larger test: doc 11's gate needs at least 100 must-block and 100 must-allow cases. Groq lists the model as **preview**, so plan a fallback: the rules layer alone, failing closed.

## Limits of this run

- 12 director cases and 28 classifier cases are a first measurement, not the Gate 3 test.
- Single pinned host per model; host metrics were not measured beyond these calls.
- No prompt-injection testing against a real provider (OpenRouter terms, §5.3.3). Injection is covered by the mocked-provider tests Astra built.
- Provider confirmations of adult use (OpenRouter, NextBit, DeepInfra, Groq) and NextBit's special-category data addendum remain **launch** requirements.
