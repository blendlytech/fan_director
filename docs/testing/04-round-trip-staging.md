# 04 — The Phase 4 round trip, by hand on staging

This is the Gate 4 criterion "a full fan-to-creator round trip works". Everything
here happens in a real browser against the deployed staging site, with real Clerk
sessions and the real staging database.

**Before you start:** the creator account is already made and linked; its sign-in
details are in `docs/testing/local-creator-account.md` (git-ignored). You also need
a **second** account for the fan, signed in somewhere the creator is not: two
browsers, or one normal window and one private window. Keep them side by side;
several steps go back and forth.

Write down the request reference ("Request A1D04E21") from step B4. Every later
step refers to the same request.

---

## Part A — What must be true before you begin

| Check | Where | Expected |
| --- | --- | --- |
| A1 | <https://fan-director-studio-staging.blendly.workers.dev> | The site loads and the header badge says **Staging** |
| A2 | The header, fan window | **Sign in** and **Create account** are offered |
| A3 | `/creator/requests`, creator window | "Request Queue" opens, empty (doc 03 §4) |

---

## Part B — The fan builds and sends

**B1.** In the fan window, sign in (email link or code) with the fan's account.

**B2.** From the entrance, press **Begin Your Vision — Vintage Lounge Greeting**.
You land on `/ai-director`.

- The AI Director panel says it is unavailable or asks you to sign in to plan with
  it. That is correct: no OpenRouter key is set, so the Director is off. Everything
  below uses the catalog controls, not the AI.

**B3.** Make the Scene Card worth reviewing:

1. Under **Your name in the video**, choose **Says your name throughout (+$15)**.
   A field appears asking for the name Maya should use — type one.
2. Under **Video quality**, choose **4K (+$25)**.
3. Watch the running total change as you choose. Note the final figure.
4. The save indicator should settle on a saved state, not "Sign in to save".

**B4.** Press **Review** (or go to `/review`) and check, before sending:

| Look for | Expected |
| --- | --- |
| Total Estimate | The same figure as B3, with cents |
| The line above the buttons | "Sending asks Maya to review your Scene Card… Nothing is charged here." |
| Maya's limits | Listed in full, with the platform rules below them |
| Anywhere on the page | Nothing says a demo, and nothing says anything was sent |

**B5.** Press **Send to Creator**.

| Expected | Not acceptable |
| --- | --- |
| The button reads "Sending…" briefly, then the browser lands on `/requests/<id>?sent=1` | Any "sent" message appearing before the page changes |
| The panel says "With Maya for review" and "Sent to Maya. Maya will review it and answer here. There are no emails, so check back on this page." | An order number, an email promise, or a payment link |
| "What you asked for" lists the same line items and total | A different total from B3 |

**Write down the reference** shown under the title ("Request XXXXXXXX").

**B6.** Open `/requests` (header → **Your requests**). The request is listed as
"With Maya for review", with its reference, the date and the total.

**B7. Duplicate send.** Go back to `/review` in the same window and press **Send to
Creator** again.

- Expected: **"This draft was already sent."** and no second request.
- Then reload `/requests`: still exactly one row.

---

## Part C — The creator reviews

Switch to the creator window. Reload `/creator/requests` if it is already open.

**C1.** The queue shows one card:

| Look for | Expected |
| --- | --- |
| Status | "Needs your decision" |
| The fan | "The fan asked to be called \<the name from B3\> · Not verified" |
| Total | The same figure as B5 |
| The pill at the top right | "1 request needs your decision" |
| Anywhere | No platform handle, no avatar, no delivery date, no "Awaiting Payment" |

**C2.** Open the card. Check the left column:

- "What the fan asked for", the reference, when it was sent.
- "THE VERSION ON THE TABLE · VERSION 1" with the server's line items and the total.
- "About 7 days after the fan pays you, confirmed by you."

**C3. Ask a question.** Press **Ask a question**, type something, press **Send
question**.

- Expected: the modal closes and the decision panel says "Sent. This request is
  waiting on the fan's answer." The status reads "Waiting on the fan's answer".
- The approve button is gone, and the screen says "You asked the fan a question. You
  can approve once they answer."

**C4.** In the **fan** window, reload the request.

- Expected: "Maya asked you a question", the question text under "Maya asked", and a
  reply box with a 500-character count.
- Type an answer and press **Send answer**. Expected: "Answer sent to Maya."

**C5.** Back in the creator window, reload the request.

- Expected: status "Needs your decision" again, the answer in **Messages**, and the
  approve button offered once more.

**C6. Propose changes.** Press **Propose changes**.

1. The editor lists the catalog's own groups with the fan's choices selected.
2. Change something with a price — for example switch **Video quality** back to
   **HD 1080p**, or change the setting.
3. Watch "New total, worked out from your catalog" change, with the note that the
   server prices it again on send.
4. Optionally write a message to the fan.
5. Press **Send to the fan**.

- Expected: "Sent. The fan has to accept these changes before you can approve them."
  Status: "Waiting on the fan to accept your changes".
- The left column now shows **Versions**: version 1 "Sent by the fan", version 2
  "Proposed by you", with what changed between them.
- The approve button is gone: "The fan hasn't accepted your proposed changes yet."

**C7. Try to approve anyway.** There should be no way to. If you find one, that is a
failure worth reporting immediately — it is the rule this phase exists to enforce.

---

## Part D — The fan accepts, the creator approves

**D1.** In the fan window, reload the request.

| Look for | Expected |
| --- | --- |
| Status | "Maya suggested changes" |
| The panel | "Maya can only approve a version you've accepted. Accept these changes, or keep your request as it was." |
| The diff | Each changed line with its amounts, then "Before" and "With these changes" |
| Buttons | "Accept these changes" and "Keep my request as it was" |

**D2.** Press **Accept these changes**.

- Expected: "You accepted the changes. Maya can now approve them." Status returns to
  "With Maya for review", and the totals shown are the new ones.

**D3.** In the creator window, reload. The approve button is back, and under it:
"Approves version 2 for $X." — check X equals the new total.

**D4.** Press **Approve this version**.

| Expected | Not acceptable |
| --- | --- |
| "Approved. The fan sees this on their requests page. Nothing has been charged." | Any mention of a charge, a payment taken, or an email |
| Then: "You approved version 2 on \<today\>." | Approval naming version 1 |
| A **Payment** box appears | A delivery countdown or a timer |

**D5.** In the fan window, reload.

- Expected: "Approved by Maya" and "Approved by Maya on \<today\>. You pay Maya on
  their own platform; nothing is charged here."
- There is no payment button, and nothing says the fan paid.

**D6. Payment.** In the creator window, read the payment box first: "Fans pay you on
your own platform. Nothing is charged here, and nothing is checked here." Press
**Mark payment as received**.

- Expected: "Recorded: you marked this payment as received." then "You marked
  payment as received on \<today\>."
- Press it again if it is still offered — it should not be.

**D7.** In the fan window, reload. Expected: "Maya marked your payment as received
on \<today\>." Nowhere does it say the fan paid, or that anything was confirmed by
the platform.

---

## Part E — The other endings (optional, but each is quick)

Each needs a **new** request: send another Scene Card as the fan (part B). A sent
draft is locked, and the next visit to the Director starts a fresh one, so this
works without any cleanup.

**E1. The fan withdraws.** On a request that is still with Maya, press **Withdraw
request** → "Withdraw this request?" → **Withdraw**.

- Fan: "You withdrew this request. Nothing more will happen with it."
- Creator, after reload: "The fan withdrew this", and no decision buttons.

**E2. The creator declines.** On another request, press **Decline**, write a reason
for the fan and a private note, then **Decline this request**.

- Creator: "Declined. The fan sees this on their requests page."
- Fan: "Declined by Maya", with the reason under "Maya's reason".
- **The private note must not appear anywhere in the fan's window.** Check the page
  and, if you want certainty, search the response in the Network tab for it.

**E3. Two tabs.** Open the same request in two creator tabs. Decline in one, then
press approve in the other.

- Expected: "This request changed while you were looking at it. Here's the latest."
  and the screen updates to the declined state. Exactly one outcome stands.

---

## Part F — Optional: check the records directly

```powershell
cd C:\Users\DELL\fan_director_studio\worker
npx wrangler d1 execute DB --env staging --remote --json --command "SELECT id, status, approved_version_id IS NOT NULL AS approved, payment_reported_at IS NOT NULL AS payment_reported FROM commission ORDER BY created_at;"
npx wrangler d1 execute DB --env staging --remote --json --command "SELECT commission_id, seq, author, status FROM commission_version ORDER BY commission_id, seq;"
npx wrangler d1 execute DB --env staging --remote --json --command "SELECT action, actor_kind, created_at FROM audit_event WHERE subject_kind = 'commission' ORDER BY created_at;"
```

Expected for the round trip above: one commission `approved` with
`approved = 1` and `payment_reported = 1`; two versions, version 1 `superseded`
(fan) and version 2 `accepted` (creator); and an audit trail reading
`commission_submitted`, `question_asked`, `commission_answered`,
`changes_proposed`, `proposal_accepted`, `commission_approved`, `payment_reported`.

---

## What this run cannot cover

**The custom request path.** A custom request only enters a draft through the AI
Director's offer, and the Director is off on staging (no OpenRouter key). So you
cannot produce a request that needs pricing before approval, and cannot see
"Price the custom request first: approving a version with no price isn't possible."
on a real request. That rule is covered by the worker suite ("approval waits for a
price") and by the unit tests. It becomes testable by hand once the AI key is set.

**Anything that needs a third account** — another fan trying to open this request,
another creator seeing it — is covered by the worker's tenant-isolation tests.
