# Fan Director Studio

A design prototype of a boutique creator-commission flow, built for a fictional
creator, **Maya Atelier**. A fan chats with an "AI Director" to plan a custom
video, watches a priced Scene Card build up as they choose options, and
reviews it before "sending." On the creator side there's a request queue with
a detail view, and ask/decline flows for responding to a fan's request.

This is a **demo, not a product**: there is no real AI, no payment
processing, no backend, and nothing is persisted. The fan's draft lives in
React state for the current tab and is lost on a full page reload.

Repo: `blendlytech/fan_director`.

## Hard rules for contributors

These are load-bearing for the project's honesty, not style preferences:

- **No false claims.** Any action that would need a server (sending a
  request, saving an idea, charging a card) must say plainly, in the UI, that
  nothing was actually sent, saved, or charged. Never add a fake success
  state, and never remove or soften an existing disclaimer.
- **Every price is derived, never authored.** The estimated total is always
  `sumOf(buildLineItems(draft))` from `src/domain/sceneCard.ts`. Don't write a
  dollar amount as copy anywhere on a fan-facing screen.
- **Reference photos go through `SceneImage`.** Several of the draft photos in
  the design are dead links (404s); `SceneImage` catches the failure and
  renders an on-brand placeholder instead of a broken image. Never render a
  reference photo with a raw `<img>`.

## Ground truth

- `docs/design-html/` is the visual spec — a component library (01) plus HTML
  drafts of every screen: boutique entrance, AI Director, review, send
  confirmation, creator dashboard and modals (02–09), saved ideas (10), the
  mobile menu (11) and page not found (12). When in doubt about layout or copy,
  this is what to match.
- `docs/specs/01-design-context.md` and `02-design-system.md` are reliable and
  worth reading before touching copy, pricing, or styling. `03-developer-handoff.md`
  is reliable for design and page behaviour, but its backend/API/deployment
  sections are marked replaced.
- `docs/specs/10-Fan-Director-Implementation-Plan.md` is the proposed direction
  for a real app (Cloudflare, platform-paid AI, server-authoritative pricing).
  Nothing in it is built yet; it starts with a Phase 0 reconciliation.
  `docs/specs/11-Developer-Handoff-Phases-0-3.md` is the approved handoff for
  Phases 0–3, including the catalog and creator-boundaries model. The
  older backend specs (04–09) contradicted it and were removed; see
  `docs/specs/README.md`.
- One deliberate departure from the drafts: this build's confirmation screen
  says nothing was sent, instead of showing draft 08's (`08-send-confirmation.html`)
  success state.

## Stack

Vite 8, React 19, TypeScript 6, Tailwind v3, react-router v7, oxlint, Vitest,
Playwright.

## Commands

Run from `frontend/`:

```bash
npm install                          # install dependencies
npm run dev                          # start the dev server at http://localhost:5173
npm test                             # Vitest unit tests (Node env, no DOM)
npm run test:e2e                     # Playwright e2e tests (starts/reuses the dev server)
npm run lint                         # oxlint
npm run build                        # tsc -b && vite build
```

`test:e2e` needs a Chromium build the first time:

```bash
npx playwright install chromium
```

## Routes

Fan journey (share one `CommissionProvider`):

| Route | Screen |
| --- | --- |
| `/` | Boutique entrance |
| `/ai-director` | AI Director conversation + live Scene Card |
| `/review` | Review the Scene Card |
| `/confirmation` | Send confirmation (nothing is really sent) |
| `/saved` | Saved ideas — the one live draft, honestly labelled as unsaved (design `10-saved-ideas.html`) |

Creator side (separate data, no shared draft):

| Route | Screen |
| --- | --- |
| `/creator/requests` | Request queue |
| `/creator/requests/:id` | Request detail (modal) |
| `/creator/requests/:id/ask` | Ask a question (modal over detail) |
| `/creator/requests/:id/decline` | Decline confirmation (modal over detail) |

Any other path (`*`) renders **Page not found** (design `12-page-not-found.html`),
showing the exact address that was requested and links back into the demo.

## Hosted demo

<https://fan-director-studio.scmillsc0809.workers.dev> — a static build on
Cloudflare Workers Static Assets. There is no Worker script and no backend; every
demo disclaimer ships unchanged. `wrangler.jsonc` sets
`not_found_handling: "single-page-application"`, so deep links such as
`/creator/requests/:id/ask` load directly, and a genuinely unknown path renders the
app's own Page not found screen rather than Cloudflare's. The fan draft lives in
memory, so a direct load of `/review` or `/saved` shows the default draft.

```bash
npx wrangler login      # once, interactive
npm run build
npx wrangler deploy     # uploads dist/ as the fan-director-studio Worker
```

## Project layout

```text
src/
  domain/       sceneCard.ts — catalog, pricing, buildLineItems/sumOf, the Draft type
  state/        commissionReducer.ts (pure draft+history reducer), CommissionContext.tsx
  pages/        one file per screen/modal listed above
  components/   common/ (Button, Icon, Modal, SceneImage, StatusBadge), cards/, layout/
  data/         requests.ts — static seed data for the creator queue
e2e/            Playwright specs
```

## Architecture notes

- A single `CommissionProvider` wraps only the fan routes (`FanJourney` in
  `App.tsx`); the creator routes have their own local data and don't share it.
- The draft and its undo history move through **one** pure reducer
  (`commissionReducer.ts`), not two separate `setState` calls — a nested
  `setState` inside an updater previously double-pushed history under
  StrictMode. Keeping it as one pure function also lets it be unit-tested
  without React.
- Modals (`Modal.tsx`) portal to `<body>` and, while open, set `#root` and
  every modal layer beneath the topmost one to `inert`, so background content
  can't be focused, clicked, or reached by Tab or a screen reader.
- When writing Playwright tests against that inertness, don't rely on
  `getByRole` to prove an element is unreachable — it ignores the `inert`
  attribute and will still find "inert" elements by role.
- Fan-facing totals flow one way: `Draft` → `buildLineItems(draft)` →
  `sumOf(lineItems)`. The current draft's total is computed in
  `CommissionContext.tsx`. Hypothetical totals (the Director's choice cards,
  the entrance price ranges) come from `previewTotal` / `priceRangeOf` in the
  same module. No screen hardcodes a price.
