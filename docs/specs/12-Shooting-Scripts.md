# Fan Director Studio: AI Shooting Scripts

Date: 2026-09-16
Owner: Clay Mills
Written for: the coding agent building after doc 11 (GPT 6 Astra), and the owner
Status: Approved direction, not yet scheduled. Builds on [doc 11](11-Developer-Handoff-Phases-0-3.md); doc 11's rules apply here unless this document says otherwise.

---

## 1. What this is

When a creator approves a Scene Card, they can ask the AI for a **shooting script**: timed beats with camera direction, action and spoken lines, written for that exact commission. The creator reads it, edits it, and uses it to film. The AI saves the creator writing time. It never decides what gets filmed.

**Evidence it works.** In Phase 0 round 3 (`docs/reports/phase-0-live/RESULTS.md`), six models wrote 36 complete scripts from three approved Scene Cards with no refusals. The owner read them all and found strong camera direction and well-written explicit scenes. Qwen3 235B wrote the best, and DeepSeek V3.2 came second.

## 2. When to build it

**Phase S, after Gate 4** (doc 10 Phase 4: submission and creator approval). A script needs an approved, immutable Scene Card version, which doesn't exist before Phase 4. Nothing here may be built earlier. The adult path also needs doc 11 §5.4's switches and compliance record.

Stop at Gate S and write `docs/reports/phase-s-report.md` (doc 11 §9 format).

## 3. Rules (in addition to doc 11 §3)

1. **Creator-only by default.** The fan never sees the script unless the owner decides otherwise (§10).
2. **Only from an approved version.** A script is tied to one `scene_card_version` id. If the scope changes, the old script is marked out of date and can't be approved for the new version.
3. **The AI never adds scope.** No people, acts, props, settings, wardrobe or runtime beyond the approved Scene Card. Anything else is a check failure (§6).
4. **The fan's words stay the fan's.** If the Scene Card has the fan's own script (doc 11 §5.7), its lines appear verbatim as dialogue. The AI adds only direction around them.
5. **Labelled AI-assisted** wherever the script is shown or exported: "Drafted with AI from your approved Scene Card. Check it before filming." Counsel confirms whether any law needs more (§10).
6. **Adult content only on the gated path** (doc 11 §5.4). While a switch is off, the prompt asks for a non-explicit script and the output checks treat explicit content as out of scope.
7. **No money, contact details or real third parties** in any script.

## 4. Models and provider

| Role | Model | Notes |
| --- | --- | --- |
| Primary | `qwen/qwen3-235b-a22b-2507` (Qwen3 235B Instruct 2507) | Owner's first choice for scripts (2026-09-16). Also the recommended Director model. Apache 2.0 licence |
| Fallback | `deepseek/deepseek-v3.2` | Owner's second choice. MIT licence |

- Called through the doc 11 Phase 3 provider adapter, via OpenRouter with `provider.data_collection: "deny"`, more than one host allowed, and no fallback to models outside this table.
- **Before launch:** written confirmation that each allowed host permits explicit content between consenting adults (doc 11 §10).
- A prompt or model change is versioned, and re-run against the §8 quality set before release.

## 5. Input the model receives

Everything is sent **as data**, inside clearly delimited fields. None of it is treated as instructions.

- the approved Scene Card version: item labels and descriptions, runtime in minutes, setting, wardrobe, orientation, resolution;
- performers by display name, each verified (doc 11 §5.3.1);
- the fan's display name and `name_use` choice (once or throughout);
- the fan's own script, if any, marked "use verbatim";
- the custom request **only if the creator accepted and priced it**;
- creator limits: every `hard_no` as "never include", and each `ask_me` limit the creator **accepted for this request** as allowed;
- the hard list (doc 11 §5.3.2) and the §5.3.1 roles rule;
- the creator's style settings (§7): tone, how explicit, camera setup, dialogue density;
- an optional regenerate note from the creator (at most 500 characters, hard-list checked).

Never send the fan's account id, email, payment data, IP address, conversation history or anything from other requests.

## 6. Output contract and checks

The model returns JSON; the app renders it. Reject anything else.

```ts
interface ShootingScript {
  title: string                      // <= 80 chars
  runtimeSeconds: number             // must be within ±15% of the Scene Card runtime
  setup: { setting: string; wardrobe: string; camera: string; props: string[] }
  beats: {
    startSecond: number              // ascending, starts at 0
    camera: string                   // <= 300 chars
    action: string                   // <= 1,200 chars
    lines: { speaker: string; text: string; verbatimFromFan: boolean }[]
  }[]                                // 3–20 beats
}
```

**Checks after every generation, on the server, before the creator sees anything:**

1. **Schema and runtime.** Beats in order; runtime within tolerance.
2. **Scope.** Speakers and people are only the verified performers and the fan's display name. Props, setting and wardrobe match the Scene Card (normalised label match plus an allow-list of neutral words such as "bed" or "lamp" for the chosen set).
3. **Fan script verbatim.** Every fan line appears unchanged, with `verbatimFromFan: true`.
4. **Hard list.** Rules layer and classifier over every text field (doc 11 §5.3.3), failing closed.
5. **Creator limits.** The same two layers with the creator's `hard_no` limits as data. The checks must read context: "the camera never shows her face" passes a "no face" limit, and a face close-up fails it.
6. **Money, contact details, real people.** Rejected.

**Outcomes:**

- A **hard-list** hit: discard the output. Retry once with the violated rule restated. If it fails again, try the fallback model once. If that fails, show "Script unavailable" and keep the Scene Card untouched. Blocked text is never shown or stored; only the audit subject (doc 11 §5.3.3) is kept.
- A **hard-no limit** hit or scope failure: the same retry path.
- An **uncertain limit match** (the classifier's confidence is below its block threshold): show the script with that beat **highlighted for the creator**, naming the limit it may touch. The creator must edit or confirm each highlight before approving.

## 7. Creator workspace

Needs a design before any UI is built (design 21, not yet drawn; its first open question is in §10). It has these states:

- **Style settings,** saved per creator: tone (warm, playful, commanding), explicitness (from suggestive to fully explicit, capped by the §5.4 switches), camera setup (handheld POV, fixed tripod, two angles) and dialogue density.
- **Generate:** a loading state, then the script.
- **Script view:** beats with timestamps, camera direction, action and lines; fan-verbatim lines marked; any highlights (§6).
- **Regenerate** with an optional note. Each request allows up to 5 generations (configurable).
- **Edit** any field. Edits are hard-list checked on save, like any creator text.
- **Approve for filming:** locks that script version to the Scene Card version.
- **Export:** print view and plain-text copy. No sharing link.
- **Out of date:** the Scene Card changed after the script was written.
- **Unavailable:** AI off, budget reached or checks failed twice. The creator can still film without a script.

## 8. Tests and Gate S

**Automated:**

- Contract validation, runtime tolerance, scope and verbatim checks against synthetic outputs passed straight to the checker.
- Hard-list and hard-no checks, tested locally with synthetic strings only. **Never ask a model to write a violation** (doc 11 §5.3.3).
- Out-of-date handling when the Scene Card version changes; approval locked to one version.
- Budget reservation and the generation limit under concurrent requests.
- Adult switch off: explicit output is rejected and the prompt asks for non-explicit.

**Quality set (live, owner's machine, within the test budget):**

- At least 10 synthetic approved Scene Cards covering: solo, verified partner, POV with the fan's name, a status-role costume, the fan's own script, a short 3-minute card and a long card, and at least 3 different creator limit sets.
- 2 scripts per card from the primary model and 1 from the fallback.
- Pass: no refusals; no hard-list or hard-no hits reaching the creator; every fan line verbatim; runtime within tolerance on at least 90%.
- **The owner reads the full scripts** (never excerpts) and approves the quality, as in round 3. The scripts stay in a gitignored folder.

**Gate S complete when:** every automated test passes, the quality set passes, the owner approves the quality read, design 21 is implemented and verified at 375, 768 and 1280 px, and costs per script are reported.

## 9. Data, retention and cost

- `shooting_script` table: id, request id, `scene_card_version_id`, model and prompt version, status (`draft`, `approved`, `out_of_date`), the JSON, creator edits as new revisions, and timestamps.
- Scripts are adult content. Store them in access-restricted storage readable only by that creator and platform staff on a safety case. Never write script text to logs. `ai_request` keeps tokens, cost, model, check results and audit subjects only.
- Retention: delete scripts a set time after the request is delivered or cancelled (proposed 90 days; owner decides, §10).
- Cost: round 3 averaged well under a cent per script. Use doc 11's atomic reservation, with a per-creator monthly script allowance as configuration.

## 10. Open decisions (owner)

| Decision | Needed by |
| --- | --- |
| Does the fan ever see the script (for example a non-explicit outline before paying)? Default: no | Before design 21 |
| Is script writing free for creators, included in a plan, or metered? | Before Gate S |
| Generations per request (default 5) and monthly allowance per creator | Before Gate S |
| Script retention after delivery (proposed 90 days) | Before Gate S |
| Counsel: AI-assisted labelling duties, and whether stored explicit scripts add record-keeping duties | Before launch |
| Written confirmation from each allowed host that adult use is permitted | Before launch |
