# 05 — Browser checks at 375, 768 and 1280 px

Doc 11 §3 rule 10: a clean typecheck is not evidence that a screen works. These are
the three widths every Phase 4 screen has to survive.

There are two ways to see the screens. Use both if you can; the first is fast and
covers every state, the second is the real thing.

---

## Route 1 — The dev preview (no sign-in, every state)

`/__preview/creator` exists in the dev server only. It mounts the real creator and
fan screens and answers their API calls from fixtures, so you can reach states that
would take a long round trip to produce.

```powershell
cd C:\Users\DELL\fan_director_studio\frontend
npm run dev
```

Open <http://localhost:5173/__preview/creator>. The buttons along the top switch
scenarios:

| Scenario | What to check |
| --- | --- |
| Queue | Cards stack at 375, two columns at 1280; the filters stack; the "needs your decision" pill is legible |
| Needs a decision | The modal scrolls inside itself; the ask-first panel, the terms and the decision column are all reachable |
| Ask a question / Decline | The layered modal sits above the request and is fully reachable at 375 |
| Waiting on the fan / Changes proposed | The version list and the diff stay readable at 375 |
| Approved / Payment reported | The payment box reads as the creator's own report |
| Declined | The reason is shown; no decision buttons remain |
| Fan: requests / a question / a proposal / approved | The fan's four screens |

At each width, for each scenario:

1. **No sideways scrolling.** The page must not move left or right at 375.
2. **Nothing clipped.** Every button and field can be reached by scrolling.
3. **Targets are comfortable** — nothing tiny to tap.
4. **The wording is the wording** — no "paid", no "charged", no email promise, no
   "Awaiting Payment".

A script already checks 1, 3 and 4 mechanically across all 13 scenarios at all
three widths (it last reported no sideways scroll, no control under 40 px and no
banned claim). Your eyes are for the things it can't judge: crowding, alignment,
whether a state reads clearly.

Press **Ctrl+C** in the terminal when you are finished, so the dev server does not
interfere with doc 01.

---

## Route 2 — Staging, signed in (the real thing)

Needs doc 03 and a request made in doc 04.

1. Open the browser's device toolbar (F12 → the phone icon) and set the width to
   **375**, then **768**, then **1280**.
2. As the **fan**: `/requests`, then the request, in whatever state it is in.
3. As the **creator**: `/creator/requests`, then the request, then **Propose
   changes** open (its editor is the longest thing on the screen).

The same four checks as above. This is also the only way to see the screens with
real Clerk controls in the header, which the preview cannot show.

---

## What to report

For anything wrong: the width, the scenario or URL, and a screenshot. "Cramped at
768" is a finding; so is "I couldn't reach the Approve button without zooming".
