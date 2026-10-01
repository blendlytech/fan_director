# Fan Director Studio: The Creator's Profile and Signature Fantasy

Date: 2026-10-01
Owner: Clay Mills
Written for: the owner (to approve) and the coding agent who builds it
Status: **Draft for owner approval.** Nothing here is built. It reworks the boutique entrance (design 02) and adds a creator onboarding step that uses doc 15's interview engine.

---

## 1. What this is

Owner idea, 2026-10-01. Each creator's profile homepage leads with three things:

- **A short intro video:** hot and attractive, but not explicit. She introduces herself, her age and something interesting about her, sexual or not, whatever she wants to say.
- **Her signature fantasy:** a vivid, explicitly worded story of her own deepest fantasy, written as role-play. It sits right below the profile picture and the video.
- **A way into the fan's own fantasy:** the layout leads from her story to "Start your fantasy" (doc 15).

**The signature fantasy is written by her AI assistant during onboarding.** The creator names her assistant, and it asks about her deepest fantasy. It then writes the story, which she edits and approves. That sets the tone of her page, and it shows her exactly what kind of role-play her assistant will write for her fans.

## 2. The profile homepage

**Order, top to bottom:**
1. Profile picture, name and a **"Verified 18+"** badge.
2. The intro video (a poster image first; it plays only when tapped).
3. The signature fantasy.
4. Her lookbook.
5. "Start your fantasy".

A sticky "Start your fantasy" button follows the fan down the page, so the next step is always one tap away.

**Visual quality:** the same bar as the studiolens.me landing page (owner, 2026-10-01): a modern, artistic layout with depth, motion and transitions, in the creator's own brand colours. It needs a new design (design 27).

## 3. The intro video

- **Recorded by the creator. Clothed and non-explicit:** no nudity and no sexual acts. Up to **45 seconds** (proposed).
- **What she says is hers:** her first name, her age and something interesting about her.
- **Age:**
  - The badge comes from her verified record (doc 11 §5.4), not from the video.
  - The age she says must match that record.
  - "Teen", "barely legal", "just turned 18" and similar framing are not allowed. They fall under the platform hard list's "anything that suggests a minor" (doc 11 §5.3.2).
- **Format:** MP4 (H.264), with a poster image and captions. Served from private R2 storage through the Worker, with byte-range support, as doc 10's media section describes. Cloudflare Stream only if playback quality becomes a problem.
- **Review before it goes live:**
  - An automated nudity check on sampled frames.
  - A transcript check of what she says, against the hard list and the age rule.
  - Then a person approves it: the owner, in the pilot.
  - Nothing is public until it's approved.
- Hosting a **non-explicit** clip avoids the record-keeping that explicit video would require. Explicit video stays out of scope.

## 4. Naming her assistant

- The creator picks a name, for example "Velvet". It is checked like any creator text: 2–24 characters, the hard list, and never her own name, a real person's name or a brand.
- Everywhere it speaks, the label is **"Velvet, Maya's assistant (AI)"**. The "(AI)" stays, for the honesty rule in doc 15 §6. The default, if she skips naming it, is "Maya's assistant".

## 5. The signature-fantasy interview (creator onboarding)

- **The same engine as the fan's interview** (doc 15), in creator mode:
  - Her assistant asks about her deepest fantasy: the setting, who she is in it, the build-up, the peak and the ending.
  - It mirrors her language and respects her own limits.
  - She can leave any part to the assistant.
- **The story:**
  - **Qwen3 writes it** (prompt `signature-story-v1`, a versioned file). It's 250–450 words and as explicit as her answers.
  - It's written as a role-play scene starring her and "you", so fans picture themselves in it (proposed; §10, question 2).
  - It never adds people, acts or anything on her limits.
- **She reviews it like a script** (doc 12 §7): edit any line, send it back with changes, or start over. **Nothing is published until she approves it.** She can also keep it private and use it only to set her style.
- **Checks on every version:** the platform hard list (the rules layer and the classifier), her hard-no limits, no money or contact details, and no real third parties (doc 12 §6, checks 4–6).
- **It sets her style:** the interview saves her tone, explicitness and dialogue density as her default style settings for scripts and letters (doc 12 §7).

## 6. Who sees the story

**Proposed (§10, question 1):**
- **Everyone** sees the profile picture, the intro video, the story's title and a teasing first line.
- **Signed-in fans who have confirmed they are 18+** read the full story. Fans already sign in before using the Director (doc 11 Gate 0).
- **The gated demo** (Cloudflare Access) shows the full story.

**Why:** doc 11 §5.8 promises explicit content only behind sign-in, and many US states and the UK require age checks for sexual content on open pages. The creator directory (doc 14 §3) stays non-explicit for the same reason.

## 7. Honesty

The story is labelled **"Written with Velvet (AI), from Maya's own fantasy."** Whether fans must be told that AI helped write it is the same counsel question as for letters (doc 12 §8.3). Until counsel answers, the label stays on.

## 8. Models

- **The story is written by Qwen3 235B, with DeepSeek V3.2 as the fallback** (doc 12 §4), through OpenRouter.
- No GPT model writes, edits or judges it, because of the content gate in `docs/handoff/how-to-prompt-gpt-models.md`. GPT can build the screens and storage around it, using placeholders.
- The interview uses doc 15's models, checks and budget ledger.

## 9. What the build touches

| Area | Change |
| --- | --- |
| Creator profile | Assistant name, signature story (versions, approved, private or public), intro video reference and review status |
| Media | Video upload to private R2, size and length limits, poster and captions, range requests, the review queue |
| Review | Frame nudity check, transcript check, the owner's approval screen |
| AI | Creator mode for the doc 15 interview; `signature-story-v1` prompt; the story's checks; saving style settings |
| Fan pages | Profile homepage (design 27); full story behind sign-in and 18+; the sticky "Start your fantasy" button |
| Creator screens | Naming the assistant, the fantasy interview, story review (design 28), video upload |

## 10. Open questions for the owner

| # | Question | Needed by |
| --- | --- | --- |
| 1 | Who sees the full story (proposed: signed-in fans who confirm 18+; a teaser for everyone else) | Before design 27 |
| 2 | The story's point of view (proposed: a scene starring her and "you") and length (proposed: 250–450 words) | Before the prompt |
| 3 | Intro video length (proposed: up to 45 seconds) | Before build |
| 4 | Who reviews intro videos after the pilot | Before launch |
| 5 | Counsel: the AI-help label on the story | Before launch |
