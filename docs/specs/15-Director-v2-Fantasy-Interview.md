# Fan Director Studio: Director v2, the Fantasy Interview

Date: 2026-10-01
Owner: Clay Mills
Written for: the owner (to approve) and the coding agent who builds it
Status: **Draft for owner approval.** Nothing here is built. Once approved, it replaces doc 11 §5.6 item 15 and the §8 Phase 3 reply contract, and adds the fantasy brief to doc 12's script input (§5).

---

## 1. Why

The Phase 3 Director names catalog items, and the server writes every sentence the fan sees. That kept the AI from promising prices or approval, but it also left out what the fan is paying for.

**Evidence: the recorded demo run** (2026-10-01, `worker/.live-recordings/demo-2026-10-01/RESULTS.md`, git-ignored):

- Every reply opened with the same template sentence.
- A whole anniversary fantasy was reduced to a single custom-request line listing the outfit and the acts, with none of the story. The exact wording is in the git-ignored record.
- The Director never asked about the story, because it isn't allowed to.
- A budget question came back "unavailable": the money-word check fired on the hidden `note` field.
- The Director added a paid item the fan hadn't asked for.

**The owner's direction:** solo play to orgasm is what nearly every video includes. What makes a custom video worth hundreds of dollars is **the where, the how, the why, the build-up and the backstory**. The Director's job is to draw that out of the fan.

## 2. Owner decisions (2026-10-01)

1. **Voice: Maya's AI assistant.** Warm and flirty, and always honest that it is an AI working for Maya. It never speaks as Maya, never claims to be her, and never says what she feels, thinks or will agree to.
2. **A short interview: 3–5 questions** before the brief is ready. The fan can keep talking after that.
3. **Language mirrors the fan:** as explicit as the fan is, never more, and always within the creator's limits.
4. **Explicit is the baseline** where adult content is on. Solo play to orgasm is included in the base video. What a creator won't do (for example pee, degradation, violence, specific acts) is set in her limits.
5. **Every video is exclusive,** and the fan's name is on by default with an opt-out, used at least twice (this updates doc 14). Maya's default base price stays $90, name included.
6. **Every brief has the six story fields, and any of them can be left to Maya's choice** (§4).

Unchanged from doc 11: prices, delivery and approval come only from the server and the creator. The platform hard list applies to every word. Adult content is gated by doc 11 §5.4's switches.

## 3. What the fan experiences

1. **It opens from what the fan already chose** (the lookbook picks and the draft), never a blank prompt.
2. **The interview:** the assistant asks what the brief is still missing, one or two questions at a time. The brief builds up beside the chat as the fan answers.
3. **Priced choices appear only when the story calls for them.** "She takes her time" can bring an offer of extra minutes. The server prices it, and the fan adds it with one tap, as today.
4. **Off-limits requests:** the server shows the "not offered" notice (as today), and the assistant offers something Maya does do, without lecturing.
5. **The close:** "Here's your fantasy. Anything to change?" The fan confirms, and the brief goes into the draft.

An illustration only; this is not model output. A real run is recorded after the build (§10).

> **Maya's assistant (AI):** Burgundy lace in the vintage lounge, good taste. What's the occasion? And when you walk in, is she already waiting for you, or does she slip into the lace while you watch?
>
> **Fan:** Our anniversary. She's waiting on the chaise.
>
> **Maya's assistant (AI):** Perfect. How do you want it to build: slow and teasing, talking to you the whole time? And what's the moment that gets you every time?

## 4. The fantasy brief

What the fan confirms. It goes into the Scene Card, the creator reads it, and the script is written from it.

| Field | Content | Limit |
| --- | --- | --- |
| `setting` | Where it happens and the mood | 300 characters |
| `role` | Who she is to the fan (girlfriend, neighbour, a stranger…), within the hard list's roles rule | 200 |
| `backstory` | Why tonight | 400 |
| `buildUp` | How it starts and what escalates it | 600 |
| `peak` | What pushes the fan over the edge: what she's doing and saying | 600 |
| `ending` | How it ends | 300 |
| `wordsToSay` | The fan's own phrases, used **word for word** in the script (like doc 11 §5.7's fan script) | 5 lines of 150 |
| `avoid` | Anything the fan doesn't want | 300 |

- **The six story fields are part of every brief:** `setting`, `role`, `backstory`, `buildUp`, `peak` and `ending` (owner, 2026-10-01). `wordsToSay` and `avoid` are optional and empty by default.
- **Any field can be left to the creator** (owner, 2026-10-01). Each story field holds either the fan's answer or **"Maya's choice"**. The fan is told this at the start ("Anything you'd rather leave to Maya, just say so"), and every field in the brief panel has a "Leave it to Maya" control. When the fan says something like "up to her", the model sets that field to Maya's choice instead of asking again.
- **The brief is ready** once every story field is either answered or left to Maya, and the interview stops asking. Usually that takes 3–5 questions, because one answer often fills several fields. A fan can leave everything to Maya in one tap.
- **Brief fields are written by the model, but they describe the fan's wishes.** The fan can edit any field before confirming. Each field is checked like fan text (§6), and confirming saves it through the normal draft save.
- **The fan's name** comes from the name option (doc 14, on by default), not from the brief.

## 5. The model's reply contract (replaces the Phase 3 contract)

```ts
interface DirectorReplyV2 {
  message: string                 // shown to the fan, at most 600 characters
  brief: Partial<FantasyBrief>    // fields to set or replace; omitted fields stay as they were.
                                  // A story field is { kind: 'fan', text } or { kind: 'creator_choice' }
  briefReady: boolean             // the server recomputes this: every story field answered or left to the creator
  options: Option[]               // 0-2, catalog item ids from the per-request enum, exactly as today
  notOffered: string[]            // short names of anything on the creator's hard-no list
  customRequest: string | null    // something not in the catalog that the creator would have to price
}
```

- The schema is still built per request: item ids are an enum of what this fan may choose.
- **`note` is removed.** It was never shown, and the money-word check on it made budget questions fail.
- **The DATA message gains:** the brief so far, the lookbook picks, the creator's style and tone (from her profile), whether adult content is on, and an **explicitness level** worked out by the server from the fan's own messages (§6, "Mirroring").

## 6. What stays strict

Every check runs on `message` **and** every brief field, before anything reaches the fan:

1. **No money, delivery dates or approval** (`output-checks`): no prices, totals, budgets, discounts, dates, or what Maya will agree to. The server shows all of that from its quote. This is the same list as today, with `note` gone.
2. **The platform hard list:** the rules layer, then the classifier, failing closed (doc 11 §5.3.3). Unchanged.
3. **The creator's hard nos:** the message never mentions or suggests one. When the fan asks for one, the model lists it in `notOffered`, the server renders the template notice, and the message offers an alternative.
4. **Honesty about being AI:** the message never claims to be Maya, and never states what Maya feels, thinks, wants or will do. A short check rejects first-person claims as Maya, and "Maya says", "Maya loves", "Maya will". Every message is labelled **"Maya's assistant (AI)"** in the UI.
5. **Mirroring:** the server rates each fan message (not explicit, suggestive, explicit) with the existing explicit-terms rule. If the fan has written nothing explicit and the model's text is explicit, the reply is rejected and retried. The rule never lowers explicit content between consenting adults the fan asked for.
6. **No upsell without a reason:** an option must relate to something in the fan's message or the brief. The model is told this, and the server records unrequested options for the gate measure (§9).

**Retry and failure:** one retry with the reasons, as today, then the fallback model once. If those fail, the fan sees a template ("I couldn't put that one together. Could you say it another way?") instead of "unavailable". The draft and manual selection keep working.

## 7. Adult as the baseline (amends doc 11 §5.2 and §5.4 for the demo and tests)

- **Base video:** where adult content is on, solo play to orgasm is included in the base price. It is never a custom request or an add-on.
- **Maya's adult categories get a few example items** (owner, 2026-10-01: "only include a couple as examples"). Each creator replaces them with her own:
  - **Toys:** a wand vibrator, and a dildo. Suction "rose" vibrators lead current sales by volume ([AsInsight, vibrating toys 2026](https://www.asinsight.com/report/US/vibrating-sex-toy)).
  - **Positions (solo):** riding a suction-cup dildo, and on all fours facing away.
  - **Kink outfits:** a latex or PVC set, and fishnet stockings with a garter belt. These match the domination and tease niches in `docs/reports/custom-video-market-research.md`.
  - **Never as examples:** schoolgirl or cheerleader costumes, or anything else that reads as a minor (the platform hard list, doc 11 §5.3.2).
  - The owner sets the example prices.
- **New checklist limits a creator can set to "Hard no" or "Ask me":** watersports and bodily fluids, degradation and humiliation, rough play and choking, plus a short list of specific acts. Creators can still write custom limits.
- **Where adult content is on:** the gated demo and the test processes. **Deployed staging stays adult-off** until a creator has the compliance records (doc 11 §5.4). Providers confirm adult use in writing before launch (doc 11 §10).

## 8. Into the Scene Card and the script

- The confirmed brief is stored in the draft as `fantasyBrief`, and it becomes part of the Scene Card version the fan sends. It is therefore covered by the Phase 4 content hash, which gets a new commission schema version.
- **The creator sees the brief, not the chat.** Raw conversations are still deleted after 30 days (Phase 3 decision).
- **Doc 12:** the script receives the brief. `wordsToSay` lines appear verbatim with `verbatimFromFan: true`, and the name follows doc 14.

## 9. Tests and gate

**Mocked (no provider):**

- the contract validator;
- each check in §6 with synthetic outputs, including first-person-as-Maya, explicit text against a non-explicit fan, a hard no named in `message`, and money in a brief field;
- the brief merge and `briefReady`;
- the fallback template.

**Live (the owner's machine, within the test budget, adult on in-process):**

- 12 synthetic fantasies across settings, roles, a hard-no request, a vague fan, a terse fan and a very explicit fan, each run to a confirmed brief.
- **To pass:**
  - no refusals;
  - nothing from §6 reaches the fan;
  - in at least 10 of 12, the brief is ready within 5 questions;
  - no unrequested options;
  - mirroring holds in every case.
- **The owner reads every transcript in full** before the gate, as in Phase 0 round 3.

**Then:** re-record the two demo cases on v2 (§10).

## 10. The demo recording

The two recorded cases (anniversary and summer) are recorded again on v2 with the same harness (`worker/test/live/demo-recording.live.test.ts`). They now include the interview, the brief and a script written from the brief. The 2026-10-01 v1 recording is kept as a record, not used in the demo.

## 11. What the build touches

| Area | Change |
| --- | --- |
| `worker/src/ai/prompts/` | `director-v2` prompt (voice, interview, mirroring, the brief) |
| `worker/src/ai/schema.ts` | The v2 contract and validator |
| `worker/src/ai/outputChecks.ts` | Checks on `message` and brief fields; drop `note`; the as-Maya and mirroring checks |
| `worker/src/ai/pipeline.ts`, `context.ts` | Brief in and out, explicitness level, lookbook picks, the fallback template |
| `shared/domain` | The `FantasyBrief` type and its checks, `fantasyBrief` on the draft, the Scene Card and the hash schema |
| Catalog | Base video includes solo explicit where adult is on; adult items for Maya; new checklist limits |
| Frontend | Chat with the assistant label, the live brief panel, edit and confirm the brief. **Needs a design** (design 26) at 375, 768 and 1280 px |
| Doc 12 prompt | Reads the brief |

## 12. Open questions for the owner

| # | Question | Needed by |
| --- | --- | --- |
| 1 | ~~Brief fields?~~ **Decided (owner, 2026-10-01):** role and backstory are included; any field can be left to Maya's choice, and the fan is told so | Done |
| 2 | Maya's adult items and prices, and the new checklist limits (§7) | Before the catalog change |
| 3 | The fallback sentence (§6) and the "Maya's assistant (AI)" label | Before build |
| 4 | Whether the assistant's first message may mention the lookbook picks by name (proposed: yes) | Before build |
| 5 | ~~Design first?~~ **Decided (owner, 2026-10-01): drawn first.** Design 26 (`docs/designs/html/26-fantasy-interview.html`, Superdesign draft `b4fdaa38`) is being redesigned by GPT to match the studiolens.me landing page's visual quality, with "Leave it to Maya" added | Before build |
