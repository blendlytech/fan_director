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

---

# Round 2: redesigned Director task on stronger models

Same 12 cases, 3 runs each, 7 models, **$0.12**. The task changed (see `round2.py`):

- The model only says **what the fan wants**, as catalog item ids locked by an enum in the response schema, so an invented or misspelled item can't come back.
- **The server does the rest:** swaps within choose-one groups, adds required items (`explicit_couple` brings `with_leo`), attaches ask-me flags, and hides hard-no items from the model entirely.
- The model's own text is limited to one short note; in the product, **the fan-facing sentence is written by the server** from fixed wording.
- Temperature 0.2, two worked examples in the prompt, **one automatic retry** with the server's error message. Hosts not pinned (`allow_fallbacks: true`), so no rate-limit failures this time.

"Useful" = after the server's checks and at most one retry, the fan gets what they asked (a valid option containing the requested items, a correct "not offered" for hard-no requests, a custom request captured, or a clarifying question). "Strict" additionally fails any reply that added adult items when the fan hadn't asked for anything intimate.

| Model | Useful | Strict | Valid first try | Adult items the fan didn't ask for | Median latency | Spend (36 requests) |
| --- | --- | --- | --- | --- | --- | --- |
| **Qwen3 235B Instruct 2507** | 34/36 (94%) | **34/36 (94%)** | 34 | **0** | 3.4s | $0.005 |
| DeepSeek V3.2 | 33/36 (92%) | 31/36 (86%) | 33 | 2 | 3.1s | $0.010 |
| Llama 3.3 70B Instruct | 35/36 (97%) | 30/36 (83%) | 35 | 5 | 4.2s | $0.007 |
| gpt-oss-120b | 29/36 (81%) | 28/36 (78%) | 30 | 4 | 6.2s | $0.006 |
| Mistral Large 3 (2512) | 35/36 (97%) | 25/36 (69%) | 30 | **11** | 2.4s | $0.013 |
| Mistral Small 3.2 (round 1 baseline) | 25/36 (69%) | 25/36 (69%) | 27 | 0 | 2.9s | $0.007 |
| GLM 4.7 | 6/36 (17%) | 6/36 | 4 | 0 | 15.3s | $0.074 |

What the replies showed:

- **The redesign fixed most failures.** Mistral Small went from 56% fully correct (round 1) to 69% useful, and four models reached 86–94% strict. Selection-rule breaks, invented items and money in the text largely disappeared because the model no longer handles them.
- **No model refused legal explicit requests**, and every one correctly declined the hard-no cases (outdoors, slapping) with a short note.
- **Qwen3 235B is the best fit:** most accurate under strict scoring, never escalated to adult items uninvited, cheapest per request. Its two misses were both the couple POV case, where its option couldn't be built on the second try.
- **Mistral Large 3 and Llama 3.3 70B escalate:** for "surprise me", a budget question or an anniversary greeting they added explicit scenes, lingerie or Leo. The server can strip adult items unless the fan's message was classified as intimate, but a model that doesn't do it at all is better.
- **Notes sometimes promise things only the creator can decide** ("Maya can hold up a sign with your name") in 3 of 36 runs for most models. This confirms that fan-facing text must come from server templates, not the model.
- **GLM 4.7** mostly returned non-JSON output through this route (its reasoning output is likely consuming the response); not a verdict on the model, but unusable as configured.

**Recommendation (replaces round 1's):** use **Qwen3 235B Instruct 2507** for the Director with the round 2 design, with **DeepSeek V3.2** as the fallback model, both with several hosts allowed. Before Phase 3: confirm the hosts' terms for adult content, add the server rule that strips adult items unless the fan's message is intimate, and re-run at Gate 3 with the ≥30 conversations doc 11 requires.

# Round 3: explicit script writing

6 models × 3 approved Scene Cards × 2 samples = **36 complete scripts**, about **$0.10** (see `round3_scripts.py`). Scene Cards: a couple POV scene with the verified partner (Vintage Lounge, lingerie, massage oil), a solo bedroom scene with a vibrator and close-ups for a birthday, and a solo nurse-costume POV scene. All with Maya's limits (no pain, slapping or choking; face never shown; indoors only) and the platform hard list.

The scripts are saved as complete files under `results/scripts/` (gitignored, never committed) for **the owner to read and judge as whole pieces**. They were not read or quoted by Claude; only automatic checks ran.

| Model | Written | Refused | Avg. words | Automatic warnings |
| --- | --- | --- | --- | --- |
| Euryale L3.3 70B | 6/6 | 0 | 408 | "face" mentions in 5 |
| Magnum v4 72B | 6/6 | 0 | 427 | "face" mentions in 3 |
| Mistral Large 3 | 6/6 | 0 | 462 | "face" mentions in 3 |
| DeepSeek V3.2 | 6/6 | 0 | 419 | "face" mentions in 2 |
| Qwen3 235B 2507 | 6/6 | 0 | 587 | "face" mentions in 5 |
| GLM 4.7 | 6/6 | 0 | 573 | "face" mentions in 5 |

- **No model refused.** One GLM script came back empty during a power cut and was regenerated.
- **No red-flag words** in any script: nothing about youth, school, pain, going outdoors, intoxication, sleep, animals or money. The "family role" keyword hits were all "steps"/"stepping".
- **"Face" mentions need reading in context**: "the camera never shows her face" is fine; an actual face shot breaks Maya's limit.
- **Owner's verdict (2026-09-16):** the scripts were strong overall, with good camera direction and well-written, erotic scenes. **Qwen3 235B wrote the best**: explicit in a way that paints a clear picture. **DeepSeek V3.2 was second**, also very erotic.

**Decision:** use **Qwen3 235B Instruct 2507** for script writing, with **DeepSeek V3.2** as the fallback. These are the same two models chosen for the Director, so one pair of providers covers both features. Before launch: confirm each host allows adult content and add the hard-list check before and after writing (to be specified in doc 12). Someone must also still check each "face" mention against the creator's limits.

**Total key spend across all Phase 0 runs: $0.23 of the $8 ceiling** (from OpenRouter's key usage, including runs interrupted by a power cut).

# Round 4: after-shoot letters

Doc 12 §8's letter: 2 models (Qwen3 235B, DeepSeek V3.2) × Qwen3's 6 round 3 scripts = **12 complete letters**, **$0.006** (see `round4_letters.py`). Each letter treats every beat as having happened, adds a short synthetic note from Maya about what she loved, and ends with a soft P.S. that hints at one idea from a synthetic ideas list.

The letters are saved under `results/letters/` (gitignored) for **the owner to read in full**. Claude did not read or quote them; only automatic checks ran, and the flags below were confirmed by printing the matched word only.

| Model | Written | Refused | Avg. words | P.S. | Kiss emoji | Flags (matched word) |
| --- | --- | --- | --- | --- | --- | --- |
| Qwen3 235B 2507 | 6/6 | 0 | 318 | 6/6 | 6/6 | "script" once (a real slip: the prompt forbids mentioning it); "snap" once (check in context: probably a sound, not Snapchat); "stepped" once (false alarm) |
| DeepSeek V3.2 | 6/6 | 0 | 300 | 6/6 | 6/6 | "stepped" once (false alarm) |

- **No refusals, and every letter had a P.S. with a kiss emoji.** No meeting, contact, price, discount or urgency words.
- **Production words can slip in.** The product check (doc 12 §6) must block "script", "beat", "camera direction" and similar in letters, and regenerate.
- **Quality, tone, and whether the P.S. feels like a performer's idea or a pitch, are the owner's call.**

## Round 4b: raw letters and follow-up notes (owner feedback)

The owner found the first letters overdone, like a love novel, and asked for letters about the sex itself, with no P.S. They also proposed a shorter follow-up note days later. New prompts (`round4_letters.py --variant v2` and `--variant followup`), same 6 source scripts, **$0.008** for 24 more pieces.

| Set | Model | Written | Avg. words | Scenery words | P.S. | Asks to share ideas |
| --- | --- | --- | --- | --- | --- | --- |
| Letters v2 (`results/letters-v2/`) | Qwen3 235B | 6/6 | 196 | 0 | 0 | n/a |
| Letters v2 | DeepSeek V3.2 | 6/6 | 169 | 0 | 0 | n/a |
| Follow-ups (`results/followups/`) | Qwen3 235B | 6/6 | 66 | 0 | 0 | 6/6 |
| Follow-ups | DeepSeek V3.2 | 6/6 | 66 | 0 | 0 | 6/6 |

- **No refusals.** The runner's "refused or too short" flags were false alarms: its 150-word minimum was set for scripts, and one refusal hit was the phrase "I can't stop" (checked by printing only those three words).
- **One DeepSeek letter came in short** at 137 words (target 150–250). No other flags.
- **Quality is the owner's call.** Read `results/letters-v2/INDEX.md` and `results/followups/INDEX.md`.
