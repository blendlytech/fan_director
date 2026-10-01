# Prompting the GPT-6 family for Fan Director Studio

Researched 2026-10-01, two days after GPT-6.1 Sol shipped. Sources are listed at the end.
Every benchmark figure here comes from OpenAI and is labelled preliminary by them.
Agents writing a GPT task prompt should follow
[`docs/handoff/how-to-prompt-gpt-models.md`](../handoff/how-to-prompt-gpt-models.md), which holds
the current routing rules.

**Short version.** Use **GPT-6.1 Sol at High** for most build work. Use **GPT-6 Astra at High** for
safety, money and auth code, for gate reviews and for writing specs. Use Low or Medium for small
edits. Don't use Max. Keep every GPT-6 model out of the runtime AI path and away from explicit
text: the Director, shooting scripts and letters stay on Qwen3 235B with DeepSeek V3.2 as the
fallback (doc 11 §5.6).

## 1. The models

"GPT 6" is a family, and "GPT 6.1" means only GPT-6.1 Sol, because there is no 6.1 Astra.

| Model | Price per 1M tokens (in / cached / out) | Effort levels | What it's for |
| --- | --- | --- | --- |
| GPT-6 Astra | $10 / $1.00 / $50 | low, **medium** (default), high, xhigh, max | The flagship. Hardest reasoning and professional work. |
| GPT-6.1 Sol | $2 / $0.10 / $10 | low, **medium** (default), high, xhigh, max | Near-Astra coding at a fifth of the price. Released 2026-09-29. |
| GPT-6 Sol | $2 / $0.20 / $10 | none, low, medium, high, xhigh, max | Legacy. 6.1 Sol replaces it. |
| GPT-6 Luna | $0.10 / $0.01 / $0.50 | includes none | Fast and cheap, for narrow, high-volume work. |

API ids: `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna`.
Astra and 6.1 Sol share a 1.05M-token context window, 128K maximum output and an April 30, 2026
knowledge cutoff. Inputs over 272K tokens cost about double. Codex offers 6.1 Sol, Luna and Astra.

## 2. What the benchmarks say about effort

| Benchmark | Effort | Astra | 6.1 Sol | Cost per task (Astra / Sol) |
| --- | --- | --- | --- | --- |
| DeepSWE 1.1 (coding) | High | 73.2% | **75.2%** | $3.92 / $0.65 |
| AutomationBench (multistep workflows) | Medium | 34.1% | 31.7% | $1.27 / $0.19 |
| AutomationBench | Max | **41.4%** | 36.1% | $1.73 / $0.30 |
| Terminal-Bench Science | Max | **68.1%** | 57.0% | $23.80 / $5.47 |
| OSWorld 2.0 (computer use) | Max | Astra leads by 2.1 points | | about 7× cheaper on Sol |

On DeepSWE, 6.1 Sol scored 73.0% at Medium and 75.2% at High, then **fell to 71.9% at both xhigh
and Max** while costing more than twice as much. More thinking past High made coding results
worse in OpenAI's own run.

What this means here:

- For code in this repo, **6.1 Sol High** is the best value, matching or beating Astra at about
  one sixth of the cost.
- Astra's lead shows up on long, multistep work with many dependencies (AutomationBench) and on
  hard analysis. That is the profile of a gate review or a safety-critical feature, where one
  missed case costs far more than the tokens do.
- On a ChatGPT plan in Codex you pay in usage limits, not dollars. The heavier model will most
  likely use up those limits faster.

## 3. Which model and effort for each job

| Job in this project | Model | Effort | Why |
| --- | --- | --- | --- |
| A phase build from a handoff spec (Worker routes, D1 migrations, React screens, gate report), as doc 11 Phases 0–3 were built | 6.1 Sol | High | Best measured coding result. Move up to Astra High if it stalls twice on the same problem. |
| Safety, money and auth code: the `minors` path and `safety_case`, the classifier's fail-closed rules, the boundaries renderer, the catalog quote (integer cents, server-authoritative), Clerk `fva`/`azp` checks, the production deploy guard | Astra | High | "Work where small quality failures are expensive." A missed case here is a legal or money problem. |
| Gate review of a build another agent did | Astra | High, or xhigh for a whole phase | A second model family catches different mistakes. Long-horizon reading is where Astra leads. |
| Writing a spec or handoff (doc 12 style), or planning a phase in Codex plan mode | Astra | High | Judgment and spotting conflicts between docs 01, 10, 11 and 12. |
| Hard bug with no obvious cause | 6.1 Sol, then Astra | High, then xhigh | Start cheap and escalate once. |
| Phase 6 pilot work: migration 0005 (slug, boutique name), BoutiqueProvider routes, replacing the hard-coded `cr_maya` and the ~25 "Maya" strings | 6.1 Sol | Medium | Well-scoped, with clear acceptance checks. |
| `env.production` and the deploy guard | 6.1 Sol | High | Small, but a mistake ships to real creators. |
| Copy edits, CSS, `docs/testing/` scripts, keeping READMEs in step | 6.1 Sol | Low to Medium | Quick, well-scoped work. |
| Mechanical bulk work: renames, lint fixes, formatting | Luna, or 6.1 Sol Low | Low | Cheapest. Check the diff. |
| Anything at Max | none | | No measured gain on coding. Save it for a task where you've seen High fail. |
| **Runtime AI inside the Worker** (Director, scripts, letters, classifier) | **none of GPT-6** | | See §5. |

## 4. How to write the prompt

GPT-6 behaves differently from GPT-5. OpenAI's own guidance boils down to a few rules.

**Write a contract, not a script.** State four things: goal, context, constraints and "done when".
Leave the steps to the model. Long step-by-step instructions now make results worse, because the
model handles nuance on its own.

**Drop the shouting.** Prompts full of MUST, NEVER and ALWAYS were written for less reliable
models. Astra takes that emphasis seriously and gets hesitant. Write constraints as plain
sentences with the reason attached, for example: "Prices are integer cents from the catalog
quote, because the server is the only source of truth for money."

**Point to files instead of making it read everything.** Avoid "read all of docs/ before you start".
Write "use doc 11 §5.3 for boundaries, design 17 for the Director's live states, and doc 11 §9 for
the gate report format". Every file it reads uses context and moves it closer to compaction.

**Say what is already decided.** GPT-6 asks more clarifying questions than GPT-5 did. Tell it that
doc 11 §5.6 holds the owner's decisions and §10 lists the open ones, and that it should go ahead
on anything decided and stop only on open items.

**Say where to stop.** GPT-6 is tuned to "bias towards action and carry the task to completion".
This project works in gates, so the stop must be explicit: "Stop at Gate 6. Write
`docs/reports/phase-6-report.md`, push, and don't start the next phase."

**Match the testing rule.** GPT-6 runs tests on its own, so "remember to run the tests" is wasted
words. What it doesn't know is this project's split: "Run unit tests, typecheck and lint on what
you changed. Don't run e2e or browser suites. Write those steps in `docs/testing/` with an
expected result for each step, because the owner's team runs them."

**Ask for plain writing in reports.** OpenAI publishes a list of slop to ban: "delve", "leverage",
"it's worth noting", "importantly", "Bottom line:", "Conclusion:", "X, not Y" contrasts and
made-up compound nouns. Add one line: "Write reports in short plain paragraphs. Use lists only for
parallel items. Don't claim anything you didn't run; mark it NOT RUN." The last sentence is
doc 01's no-false-claims rule applied to reports.

**Plan for the cloud workspace.** Astra's workspace can't see the owner's PC (no `.dev.vars`, no
OpenRouter key) and was lost once, which forced the Phase 1 rebuild. Tell it: "Commit and push at
every checkpoint. You can't reach live API keys; mark live runs NOT RUN and give me the command."

**Add an `AGENTS.md`.** The repo has none. Codex reads `AGENTS.md` from the repo root (and from
each folder down to the one it works in) on every task. A short file with the layout, build and
test commands, branch and PR rules, and the content rule in §5 saves repeating them in every
kickoff. OpenAI's advice is to keep it short and accurate, and to prune lines the model no longer
needs.

## 5. Keeping it away from explicit material

GPT-6 refuses explicit sexual content. ChatGPT's adult mode has been paused since March 2026, and
no API route allows erotica. In Phase 0, Astra declined to benchmark adult-content refusals. A
refusal halfway through a task wastes the run and can leave half-finished work behind, so set
tasks up so it never meets explicit text.

- **Give it the plumbing and never the content.** Frame it like this: "Qwen3 writes this text at
  runtime through OpenRouter. You build the route, schema validation, storage and UI. Use
  placeholders such as `[SCRIPT BODY]` in fixtures and tests."
- **Don't paste explicit material** into a prompt: script or letter samples, recorded-demo
  transcripts, anything from the git-ignored `results/` folders or the private demo fixtures.
  Those are git-ignored, so a cloud clone won't contain them anyway.
- **Keep the Qwen prompt text out of its hands.** The system prompts that set the voice of the
  Director, scripts and letters (doc 12, including the "raw" letter voice) belong in their own files.
  Another tool or the owner edits those. GPT-6 can write the loader around them.
- **Classifier cases:** it can build the harness, the scoring and the fail-closed logic. The
  must-block case texts should come from another source.
- **Adult switches:** `ADULT_CATALOG_ENABLED`, the per-creator flag and the compliance record are
  plain logic. Use neutral fixture names (`adult_item_1`) and it will build and test them.
- **Policy documents are fine.** Docs 11 and 12 describe adult rules in policy language, and Astra
  built Phases 0–3 from them.
- **If it refuses, move the task.** Rewording the request to get past the refusal wastes tokens
  and puts the OpenAI account at risk.

## 6. A kickoff you can copy

Filled in for one Phase 6 item. Model: 6.1 Sol, effort High.

```text
Goal: Creators get their own boutique at /<slug>. Add migration 0005 (slug, boutique_name),
GET /api/boutiques/:slug, and a BoutiqueProvider that replaces the hard-coded cr_maya.

Context: The plan is C:\…\phase-6-pilot.md (pasted below). Use doc 11 §5 for the catalog model
and shared/domain/selectionInventory.ts for the data the AI layer reads. Branch from main.

Constraints:
- Prices stay integer cents from the catalog quote; the server is the only source of truth.
- Adult categories stay excluded server-side while ADULT_CATALOG_ENABLED is false.
- AI text is produced at runtime by another model. Don't write or edit model prompt text,
  and use placeholders in fixtures.
- Run unit tests, typecheck and lint on what you change. Don't run e2e or browser suites;
  write those steps in docs/testing/ with an expected result for each step.
- Plain prose in the report; don't claim anything you didn't run.

Done when: /maya renders Maya's boutique from the API, an unknown slug shows design 12,
no "Maya" string remains outside seed data, unit tests pass, and the testing doc is written.
Commit and push at each checkpoint. Stop there and summarise; don't start the onboarding script.
```

## 7. If you call the API directly

You probably won't, because the Worker uses OpenRouter for Qwen. In case you do:

- Use the Responses API for tool calls. Chat Completions works only without tools.
- Remove `temperature`, `top_p` and `top_logprobs`. Reasoning models reject them.
- Astra and 6.1 Sol have no `none` or `minimal` effort, so `low` is the floor.
- `text.verbosity` (low, medium or high) controls answer length separately from effort.
- `prompt_cache_options.ttl: "30m"` replaces `prompt_cache_retention`. Cached input on 6.1 Sol
  costs $0.10 per 1M tokens, 95% less than uncached input.
- The `developer` role does the job a system message used to.

## Sources

- OpenAI, [Using GPT-6](https://developers.openai.com/api/docs/guides/latest-model): model
  lineup, effort levels, migration and prompting guidance
- OpenAI, [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
- OpenAI, [API pricing](https://developers.openai.com/api/docs/pricing)
- OpenAI, [Introducing GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/) (the
  page blocked automated fetching; its figures were taken from the reports below)
- OpenAI, [Codex best practices](https://learn.chatgpt.com/guides/best-practices) and the
  [Codex prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide)
- Microsoft, [Azure OpenAI reasoning models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning):
  parameter support
- The Decoder, [GPT-6.1 Sol comes close to Astra at a fifth of the price](https://the-decoder.com/gpt-6-1-sol-comes-close-to-astra-at-a-fifth-of-the-price/)
  and [OpenAI shares prompting tips for GPT-6 Astra](https://the-decoder.com/openai-shares-prompting-tips-for-gpt-6-astra-including-a-blocklist-of-slop-words/)
- Kingy AI, [GPT-6 Astra vs GPT-6.1 Sol](https://kingy.ai/blog/gpt-6-astra-vs-gpt-6-1-sol/):
  per-effort scores and cost per task
- Just AI News, [ChatGPT adult mode explained](https://justainews.com/companies/openai/adult-mode-in-chatgpt-explained-nsfw-erotica-porn-policy/)
