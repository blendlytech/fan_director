# Fan Director Studio: The Fan's Name, Exclusive Videos, and Letter Delivery

Date: 2026-10-01
Owner: Clay Mills
Written for: the owner (to approve) and the coding agent who builds it
Status: **Draft for owner approval.** Nothing here is built. Once approved, it amends doc 11 §5.2 and §5.7, doc 12 §3, §6 and §8, and doc 10's delivery scope for the letter only. It works together with doc 15 (Director v2).

---

## 1. What changes and why

Owner decisions, 2026-10-01 (the later ones replace the earlier ones):

1. **Every video is exclusive.** This is a platform rule, not an option. The full video is the fan's alone.
2. **The fan's name is on by default,** with an opt-out. The fan types their name. The AI uses it naturally in the script, **at least twice**, with no upper limit.
3. **Creators may use a few short, non-nude clips or stills** from a video to promote themselves. The fan is told before sending.
4. **The after-shoot letter is delivered in the app.** The video itself stays on the creator's own platform. The letter is also where the fan is invited, separately, to join the creator's newsletter (doc 13).

An earlier draft the same day had the name as a priced opt-in, and resale of named videos with the name removed. Both are withdrawn.

**Evidence:** in the 2026-10-01 recorded demo run (`worker/.live-recordings/demo-2026-10-01/`, git-ignored):

- Both fans' wishes about their name ended up as custom requests or manual edits, because the Director can't offer the name settings.
- The server refused a named video that could be resold, which added +50% for exclusivity to a $15 option.
- One script used the fan's name although the card said "No name", and no check caught it.

## 2. Exclusive videos (replaces doc 11 §5.7's rights options)

- **The `rights` group is removed:** no "Maya may resell it later", and no "Just for you (exclusive) +50%". Every video is made for one fan.
- **Creators set their base prices knowing that.** There is no resale income from customs on this platform. Maya's pilot prices need the owner's review (§6, question 1).
- **The promise is the creator's.** By offering custom videos here, she agrees in her creator terms never to sell or share a custom video, except for the promotional clips in §3. Breaking that is grounds for removal from the platform. The platform can't stop a copy from existing; what it guarantees is the agreement and its enforcement.
- **What the fan sees (draft wording for counsel):**

> **Made only for you.** The full video is yours alone. Maya agrees never to sell or share it. She may use a few short, non-nude clips or stills from it to promote herself, never with your name or your story. Maya owns the video; you're buying it for your own viewing.

- The wording is stored, by version, in the Scene Card version the fan sends, so it is covered by the Phase 4 content hash.
- **This also settles doc 11 §5.7's personalised-video rule.** A named video, or one with the fan's own words, can no longer be resold, because no video can be.

## 3. Promotional clips and stills

- **Allowed:** a few short clips or stills that are **non-nude and non-explicit**, used by the creator to promote herself and in the platform's creator directory (if one is built).
- **Never in a clip:** the fan's name (mute the audio or choose name-free moments), anything that reveals the fan's fantasy or story, and anything nude or explicit.
- **The fan may opt out?** Proposed: no. It is part of the platform rule and disclosed before sending (§6, question 3).
- Producing the clips (by hand now, perhaps automatically later) is out of scope here. It belongs to a future "production studio" phase together with private delivery.

## 4. The fan's name

### 4.1 Catalog and the fan's screen

- **The `name_use` group's three items are replaced by one setting on the draft, on by default:** "Use my name", with the name field beside it.
- **The name is required while it's on.** The fan can turn it off at any time before sending.
- **Included in the price** (owner, 2026-10-01). The creator can still choose not to offer it at all, in which case the box isn't shown.
- **The name field reuses `fanDisplayName` and its rules:** the length limit, the hard-list check, and the nickname states in design 24 (B1–B3). A first name or nickname only; a partner's first name for a gift is fine.
- **The promise, in the creator's name:** "Maya says your name at least twice."
- **A design is needed** for the box, the inline field and the disclosure in §2 (design 25), at 375, 768 and 1280 px.

### 4.2 The Director (doc 15)

- The Director never writes the fan's name; the server adds it.
- If the name is on but empty, the assistant asks what Maya should call the fan.
- Turning the name off is the fan's own choice on their screen, never a Director suggestion.

### 4.3 The script and the letter (amends doc 12 §3 rule 4 and §6)

- **On:** the script uses the name where a lover naturally would (the greeting, the build-up, the peak, the closing). It is part of the fantasy, with no upper limit and **at least two uses**.
- **Off:** the name never appears. It isn't sent to the model at all.
- **New check (doc 12 §6, check 7):** count whole-word, case-insensitive uses of the name in spoken lines. Fewer than two when on, or any use when off, follows the same retry path as a scope failure.
- The after-shoot letter uses the name when on, and "you" only otherwise.

## 5. Letter delivery in the app (amends doc 12 §8.1 step 5 and §8.3)

- **The video stays external** (doc 10). Only the letter is delivered by the platform.
- **The steps:** when the creator approves the letter and marks the request delivered, the fan gets a discreet service email ("Maya sent you something", with nothing explicit and no letter text). The fan signs in and reads the letter in the app, with a PDF download in the creator's colours.
- **This is a service message.** It needs no marketing consent (doc 11 §5.8, last point).
- **Retention:** the letter is kept as long as the commission record. The fan can delete it.
- **Beside the letter, never inside it,** sits the separate, unticked newsletter opt-in from doc 13. The letter itself stays free of selling (doc 12 §8.1 and §8.2: no P.S., nothing about another video).
- The AI-help disclosure line stays switched on until counsel decides (doc 12 §8.3).

## 6. What the build touches

| Area | Change |
| --- | --- |
| `shared/catalog/pilot-v1.ts` → a `pilot-v2` | No `rights` group; the name becomes a draft setting; new version id (`cv_maya_2`) |
| `shared/domain` validation and quote | Remove the resale rule and the exclusive percentage; the name setting and its check |
| Review and Scene Card UI | The name box and field, the "Made only for you" wording (design 25) |
| Creator terms and onboarding | The creator's agreement never to sell or share customs, and the clip rules in §3 |
| Submission (Phase 4) | The wording version stored in the Scene Card version |
| Doc 12 prompt and checks | Name rules in the prompt; check 7 (name count) |
| Letter delivery | Fan letter view, PDF, service email, the opt-in beside it (doc 13) |
| `marketing_consent.source` | Adds `letter` (a migration; the table stays append-only) |

## 7. Open questions for the owner

| # | Question | Needed by |
| --- | --- | --- |
| 1 | Maya's pilot base prices now that every video is exclusive (today: 3-minute base $90, and exclusive was +50%) | Before the catalog change |
| 2 | ~~Is the name included in the price?~~ **Decided (owner, 2026-10-01): included in the price.** | Done |
| 3 | Can a fan opt out of promotional clips? (Proposed: no; disclosed as a platform rule) | Before build |
| 4 | Counsel: "Made only for you" wording and "Maya owns the video; you're buying it for your own viewing" | Before launch |
| 5 | Re-record the two demo cases on the new catalog and Director v2 (doc 15 §10) | Before the demo goes to creators |
