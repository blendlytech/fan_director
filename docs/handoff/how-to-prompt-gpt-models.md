# How to write a task prompt for a GPT model

Use this when you're asked to write a prompt that hands a task to a GPT model: GPT-6 Astra,
GPT-6.1 Sol or GPT-6 Luna, usually run in OpenAI Codex. You deliver a **model card** (model,
effort, reason, when to step up) and a **prompt** the owner pastes as written.

The facts here are valid as of **2026-10-01**. If the requester names a GPT model that isn't
listed below, research it before you route anything to it. The evidence and sources behind these
rules are in [`docs/reports/gpt-6-prompting-guide.md`](../reports/gpt-6-prompting-guide.md).

## Steps

### 1. Classify the task

Match the task to exactly one row of the [routing table](#routing-table). If it spans several
rows, split it into one prompt per row and order them, for example build first, then review.

*Done when:* every part of the request sits in one row, and you know what failure would cost:
a redo, or money, safety, legal or account damage.

### 2. Run the content gate

GPT models refuse explicit sexual content. Apply the [content gate](#content-gate). A task
that needs explicit text written, edited, judged or read goes to Qwen3 235B with DeepSeek
V3.2 as the fallback. Tell the requester that and stop. A task that only builds plumbing
*around* that text stays with GPT, and its prompt uses placeholders.

*Done when:* nothing in the task or its context gives a GPT model explicit text.

### 3. Right-size the model and effort

**Right-size** means the cheapest model and effort that still does the job at full quality.
Quality comes first: never pick a model that will probably fail, because a failed run plus a
redo costs more than the right model would have. Within that limit, use the cheapest option.
Picking a stronger model than the task needs is **overkill**, and it's a mistake just like
picking one that's too weak.

Start from the routing table's pick. Then apply the [step-up and step-down signals](#step-up-and-step-down-signals).

*Done when:* you can say in one line why the next cheaper option would fail and why the next
stronger one would add nothing.

### 4. Write the prompt

Use the [prompt shape](#prompt-shapes-by-model) for the chosen model. Add the
[task-type additions](#task-type-additions) for the row, plus the
[project lines](#project-lines) the task touches.

*Done when:* the prompt has a goal, a checkable "done when", and an explicit stop.

### 5. Check it and deliver

Go through the [pre-delivery checklist](#pre-delivery-checklist), then deliver in the
[output format](#output-format).

*Done when:* every checklist item passes.

---

## Models

| Model | API id | Price per 1M tokens (in / cached / out) | Effort levels (default) | Strength |
| --- | --- | --- | --- | --- |
| GPT-6 Astra | `gpt-6-astra` | $10 / $1.00 / $50 | low, medium, high, xhigh, max (medium) | The best long, multistep reasoning. Use it when small mistakes are expensive. |
| GPT-6.1 Sol | `gpt-6.1-sol` | $2 / $0.10 / $10 | low, medium, high, xhigh, max (medium) | Matches Astra on coding at about a sixth of the cost per task. The default workhorse. |
| GPT-6 Luna | `gpt-6-luna` | $0.10 / $0.01 / $0.50 | none, low, medium, high, xhigh, max (medium) | One focused job at high volume: classify, extract, transform. |

GPT-6 Sol (without the .1) is legacy, so route its work to 6.1 Sol. All three models have a
1.05M-token context window and 128K maximum output, and inputs over 272K tokens cost double.
Codex shows the efforts as Low, Medium, High and Extra High (xhigh).

What the evidence says (OpenAI's preliminary benchmarks):

- **Coding:** 6.1 Sol at High scored 75.2% for $0.65 a task, and Astra at High 73.2% for $3.92.
  Sol fell to 71.9% at xhigh and Max. **For coding, Sol tops out at High.** Above that, step up
  to Astra High rather than raising Sol's effort.
- **Long multistep workflows and hard analysis:** Astra leads by 5 to 11 points. Those points
  matter when one miss is costly.
- **Computer use:** Sol comes within 2.1 points of Astra at about a seventh of the cost.

## Routing table

| # | Task | Model | Effort | Step up to |
| --- | --- | --- | --- | --- |
| A | Multi-file feature or phase build from a spec | 6.1 Sol | High | Astra High |
| B | Code where a bug costs money, safety, legal standing or accounts: payments and pricing, auth and sessions, age and consent checks, the safety-case and `minors` path, classifier fail-closed rules, production deploy guards, data deletion | Astra | High | Astra xhigh |
| C | Code review or gate review of a finished build | Astra | High; xhigh for a whole phase | none |
| D | Spec, architecture or handoff writing, and plan-mode planning | Astra | High | Astra xhigh |
| E | Debugging with an unknown cause | 6.1 Sol | High | Astra xhigh |
| F | Well-scoped change with clear acceptance: one route, one component, one migration, or a pattern that already exists in the repo | 6.1 Sol | Medium | 6.1 Sol High |
| G | Small edits: copy, CSS, docs, `docs/testing/` scripts, config values | 6.1 Sol | Low | 6.1 Sol Medium |
| H | Mechanical bulk work: renames, formatting, lint fixes, reshaping data | Luna | Low | 6.1 Sol Low |
| I | High-volume classification, extraction or routing over non-sensitive text (API batch) | Luna | none or low | Luna medium, then 6.1 Sol |
| J | Research or report writing (no code) | 6.1 Sol | Medium | Astra High when a decision rests on it |
| K | Browser or computer-use tasks | 6.1 Sol | High | Astra High |

**Max** is never a starting pick. Suggest it only after Astra xhigh has failed on the same task,
and give the requester the cost reason, because Max costs the most and showed no coding gain.

### Step-up and step-down signals

Step up one rung when any of these is true:

- The same model has already failed twice on this problem.
- The task has to reconcile documents that conflict, or spans several subsystems with no spec.
- A miss would reach users as wrong money, a safety gap or a legal exposure (that is row B).
- A review of earlier work by this model found real misses.

Step down one rung when any of these is true:

- "Done" is a single command passing, and the change is easy to reverse.
- The task copies a pattern already in the repo, and the prompt can name the file to copy.
- The change touches one file and no money, auth or safety logic.

Each rung goes from Luna to Sol, and from Low to Medium to High. Above Sol High the next rung
is Astra High.

## Prompt shapes by model

These rules hold for every GPT-6 model:

- Write a **contract**: the goal, the context, the constraints and a checkable "done when".
  Leave the method to the model. Step-by-step instructions make reasoning models worse.
- State each constraint calmly with its reason attached ("Prices are integer cents, because the
  server owns money"). GPT-6 reads capital-letter MUST, NEVER and ALWAYS as a reason to hesitate.
- Point to sources by job ("doc 11 §5.3 for boundaries") instead of telling the model to read
  everything first, which spends its context.
- Effort is a setting the owner picks in Codex or the API. The prompt never mentions it.

### Astra: the least specification

Astra handles ambiguity well and follows whatever is in its context closely, so a contradiction
in the prompt will derail it. It also asks more clarifying questions than earlier models.

- Keep the prompt short. Cut any line that tells a capable engineer what they'd do anyway.
- Give a **Decided / Open** pair: what's already settled (and where it's recorded), and which
  questions are still open. Tell it to go ahead on decided items and stop only on open ones.
- Name the boundaries of exploration: what's in scope to investigate and where the work ends.
- Remove instructions that conflict with each other or with the repo's docs before you deliver.

```text
Goal: <outcome in one or two sentences>
Context: <the 2–4 sources that matter, each with what it's for>
Decided: <settled points, or "see <doc §>">. Proceed on these without asking.
Open: <open questions>. If the work reaches one, stop and list it with your recommendation.
Constraints: <rules, each with its reason>
Scope: <what to explore>; <where the work ends>
Done when: <checkable conditions>
Stop: <the exact stopping point and what to hand back>
```

### 6.1 Sol: contract plus verification

Sol matches Astra on coding but benefits from naming the checks and the stopping point outright.

- Use the same contract, and add a **Verify** line listing the exact checks that prove the work.
- When an existing file shows the pattern to follow, name it. That costs one line and saves a
  search.

```text
Goal: <outcome>
Context: <sources, each with what it's for; a file whose pattern to copy, if one exists>
Constraints: <rules, each with its reason>
Verify: <commands or checks that must pass>
Done when: <checkable conditions>
Stop: <stopping point and what to hand back>
```

### Luna: six layers, one job

Luna is for one narrow, repeatable job. It needs the decisions spelled out, an exact output
format, and a way out when an input doesn't fit.

```text
Task: <one job, one sentence>
Input: <what the input is and which parts are authoritative; what it should never infer>
Rules: <each label or transformation with its criteria; precedence when two apply>
Output: <exact schema or format; nothing outside it>
Validate: <checks each output must pass>
Escalate: <when to return needs_review / unknown instead of guessing>
```

If Luna's job needs judgment across sources, more than one step of reasoning, or debugging,
it's the wrong model. Route it to 6.1 Sol.

## Task-type additions

Add the items for the task's row to the model's prompt shape.

| Row | Add to the prompt |
| --- | --- |
| A, F | The branch to start from, the files or modules in scope, and the testing split from [project lines](#project-lines) |
| B | Every invariant the code must keep (for example "the total always equals the sum of its line items"), plus the failure mode: fail closed, and say what the user sees |
| C | What to compare against (spec sections, designs), a severity scale, findings as a list with file:line and a failure scenario, and "report only, change nothing" |
| D | The deliverable file path, the audience, the Decided / Open pair, and "flag conflicts between documents and recommend a resolution" |
| E | The symptom, steps to reproduce, what's already ruled out, and done = the root cause shown by a test that fails before the fix and passes after |
| G, H | The exact transformation, the file scope, and a single command that verifies it |
| I | The input sample format and the output schema. Use the Luna shape |
| J | The question, the audience, the length, sources required for each claim, and the style lines from [project lines](#project-lines) |
| K | The start URL, the end state to reach, and which actions need the owner's approval (purchases, sends, deletes) |

## Project lines

Paste the lines the task touches, word for word. Each line is a fact the model can't learn
from the repo.

- Testing: `Run unit tests, typecheck and lint on what you change. The owner's team runs e2e and browser suites; write those steps in docs/testing/ with an expected result for each step.`
- Workspace: `Commit and push at each checkpoint; your workspace may not persist.`
- Keys: `Live API keys exist only on the owner's machine. Mark live runs NOT RUN and give the command to run them.`
- Claims: `Report only what you ran or read. Mark everything else NOT RUN.`
- Style (reports and docs): `Write short plain paragraphs in active voice. Use lists only for parallel items. Avoid "delve", "leverage", "it's worth noting", "importantly", "Bottom line:", and "X, not Y" contrasts.`
- Money: `Prices are integer cents from the catalog quote; the server is the only source of truth.`
- Adult switch: `Adult categories stay excluded server-side while ADULT_CATALOG_ENABLED is false.`
- PRs: `Open PRs with merge commits only. Branch auto-delete is off, so retarget stacked PRs by hand.`
- Gates: `Stop at Gate N: write docs/reports/phase-N-report.md, push, and don't start the next phase.`

## Content gate

| The task… | Route |
| --- | --- |
| Writes, edits, rewrites, judges or summarises explicit text (Director replies, shooting scripts, after-shoot letters, demo transcripts) | Qwen3 235B via OpenRouter, DeepSeek V3.2 as fallback. No GPT prompt. |
| Changes the prompt files that set the voice of those Qwen outputs | Not GPT. The owner or Claude edits them. |
| Builds routes, schemas, storage, UI, switches or tests around explicit text | GPT. The prompt says: `Another model writes this text at runtime. Build <X> around it and use placeholders such as [SCRIPT BODY] in fixtures and tests.` |
| Builds a classifier harness, scoring or fail-closed logic | GPT. The must-block case texts come from outside the prompt. |
| Reads policy documents that describe adult rules (docs 11 and 12) | GPT. Policy language is fine. |

The context you give a GPT model stays clean: no sample scripts or letters, nothing from the
git-ignored `results/` folders, no private demo fixtures. Adult catalog items get neutral
fixture names such as `adult_item_1`. If a GPT model refuses partway through a task, move the
task through this gate instead of rewording it. Rewording wastes the run and risks the
OpenAI account.

## What to leave out

Each of these costs words and changes nothing, or makes GPT-6 worse:

- "Think step by step", or a list of intermediate steps.
- "Remember to run the tests". GPT-6 runs them on its own; give only the project testing split.
- Capital-letter emphasis, and repeating one rule in several places.
- "Read X, Y and Z before you start". Point to them by job instead.
- `temperature` or `top_p` in API examples, since reasoning models reject them.
- Restating facts the repo already records, such as `package.json` scripts or the folder layout.

## Pre-delivery checklist

- [ ] The task maps to one routing row, or it's split into ordered prompts.
- [ ] The content gate passes: no explicit text in the task or its context.
- [ ] The model and effort are right-sized, with a one-line reason the cheaper option would fail.
- [ ] The prompt uses the chosen model's shape and the row's additions.
- [ ] "Done when" is checkable and "Stop" names the exact stopping point.
- [ ] The project lines this task touches are pasted word for word.
- [ ] Nothing in "What to leave out" is present.
- [ ] No instruction contradicts another one or a repo doc.

## Output format

Deliver exactly this:

````markdown
**Model:** GPT-6.1 Sol · **Effort:** High · **Run in:** Codex (cloud task)
**Why:** <one line: why this model and effort fit, and why the cheaper option would fail>
**Step up to:** <model and effort> if <signal>

```text
<the prompt>
```
````

When the task was split, deliver one block per prompt, in order, each with its own model card.
