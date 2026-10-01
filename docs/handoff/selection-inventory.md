# Selection inventory: the hand-off for AI playback

**For:** the agent building AI playback (the two recorded AI conversations and their scripts).
**From:** the lookbook integration on branch `demo-lookbook` (2026-10-01).

The conversations and their script content are yours. This document covers only the data you
read: one structured object describing what the fan chose, what the creator allows, and the
priced Scene Card. Read this object. Don't reach into React state, the DOM or the lookbook
context to rebuild it.

## Where it lives

| What | Where |
| --- | --- |
| The type and the pure builder | `shared/domain/selectionInventory.ts`: `SelectionInventory`, `buildSelectionInventory()`, `SELECTION_INVENTORY_SCHEMA` |
| The React hook | `frontend/src/state/selectionInventory.ts`: `useSelectionInventory()` |
| The Scene Card part on its own | the same file: `sceneCardSnapshot(commission)` |
| Tests that pin the contract | `frontend/src/domain/lookbook.test.ts` ("the selection inventory") |

`useSelectionInventory()` must be called inside the fan journey (any page under `FanJourney` in
`frontend/src/App.tsx`: `/`, `/ai-director`, `/review`, `/confirmation`, `/saved`). It returns
`null` where no lookbook is mounted. Today that means the staging build's fan journey, which
doesn't show the lookbook to fans yet. In the public demo it is never null.

## Guarantees

- `schema` is `"fds.selection-inventory/v1"`. It changes only if a field is removed or changes
  meaning. New optional fields keep the same string.
- `categories` lists **every category the fan could see**, in the creator's order, whether or
  not the fan chose anything. A category with no pick has `choice: { kind: "model_preference" }`.
  It means "leave it to the creator", not "nothing".
- A `selected` choice lists items in the creator's order, never more than `maxSelections`, and
  only items that exist in the creator's lookbook.
- **Adult categories never appear** while adult content is off (doc 11 §5.4). The demo models
  `Toys` and `Fetishes` but always leaves them out, so your scripts must never mention them.
- `image` is a servable path (`/lookbook/…`, `/scenes/…`, or `/api/media/<uuid>` in staging),
  or `null` for an image a demo visitor uploaded, which exists only in their tab.
- `boundaries.hardNo` and `boundaries.askFirst` are plain sentences from the one boundaries
  renderer (`shared/domain/boundaries.ts`), plus the creator's own lookbook additions, with
  repeats removed. `boundaries.platform` is the platform hard list, always in full.
- `sceneCard.totalCents` always equals the sum of `sceneCard.lineItems[].amountCents`.
  Amounts are integer cents from the catalog's quote. Never print a price that isn't in here.
- The object is plain JSON: `JSON.parse(JSON.stringify(x))` gives back an equal object.

## Example (generated from the demo, not typed by hand)

A fan picked the swimsuit, the glasses and the feather fan, left everything else to Maya, and
added one note:

```json
{
  "schema": "fds.selection-inventory/v1",
  "source": "demo",
  "creator": { "name": "Maya Atelier", "style": "Cinematic and personal", "tone": "Warm and confident", "mood": "Intimate, editorial" },
  "categories": [
    { "categoryId": "clothing", "name": "Clothing", "maxSelections": 1,
      "choice": { "kind": "selected", "items": [{ "itemId": "swimsuit", "name": "Black one-piece swimsuit", "image": "/lookbook/swimsuit.webp" }] } },
    { "categoryId": "scene", "name": "Scene", "maxSelections": 1, "choice": { "kind": "model_preference" } },
    { "categoryId": "accessories", "name": "Accessories", "maxSelections": 2, "choice": { "kind": "model_preference" } },
    { "categoryId": "props", "name": "Props", "maxSelections": 2,
      "choice": { "kind": "selected", "items": [
        { "itemId": "glasses", "name": "Cat-eye glasses", "image": "/lookbook/glasses.webp" },
        { "itemId": "feather", "name": "Feather fan", "image": "/lookbook/feather.webp" } ] } },
    { "categoryId": "costumes", "name": "Costumes", "maxSelections": 1, "choice": { "kind": "model_preference" } }
  ],
  "boundaries": {
    "hardNo": ["Anything explicit", "Anything political", "Brand mentions or ads"],
    "askFirst": ["Wardrobe changes", "Props and accessories"],
    "platform": ["Anyone under 18, or anything that suggests it", "… 11 lines in all …", "Hate or harassment"]
  },
  "sceneCard": {
    "catalogVersionId": "cv_maya_1",
    "settingKey": "vintage", "settingLabel": "Vintage Lounge", "sceneTitle": "Vintage Lounge Greeting",
    "minutes": 3,
    "lineItems": [
      { "label": "3-Minute Video", "detail": "Standard base rate", "amountCents": 9000 },
      { "label": "Vintage Lounge Setup", "detail": "Set dressing & lighting", "amountCents": 3500 },
      { "label": "Personalized Greeting", "detail": "Detailed opening & closing", "amountCents": 2000 }
    ],
    "totalCents": 14500, "budgetCents": 15000, "deliveryDays": 7,
    "notes": ["Please say my name at the start."],
    "fanDisplayName": null, "customRequest": null
  }
}
```

## Rules that bind the playback

These come from the product's no-false-claims rule (`docs/specs/01`, doc 11 §3). They aren't
style preferences.

1. **The public demo makes no AI call, no submission and no payment.** Recorded playback must
   read as recorded: never imply a model is answering live, and never send a network request.
   The demo's lookbook spec (`frontend/e2e/lookbook.spec.ts`) fails on any `/api` or
   off-site request, and the same check is worth adding to yours.
2. **Name only what is in the inventory.** A `model_preference` category is the creator's call:
   say so ("Maya will choose the props") rather than inventing an item.
3. **Respect `hardNo`.** Playback never suggests a hard-no line. `askFirst` items may appear,
   framed as something the creator will confirm.
4. **Prices come only from `sceneCard`.** Don't compute, round or restate a total that isn't
   `totalCents`.
5. **Refresh clears everything.** The inventory is rebuilt from in-memory state on every
   render. Don't cache it in `localStorage` or anywhere else.

## Not yet true in staging

The signed-in creator can edit and save their lookbook (`/creator/lookbook`, `PUT
/api/creator/profile`), but staging's fan journey doesn't show it, and a sent request doesn't
carry the fan's visual choices. Adding them would change the Phase 4 commission content and its
hash. Until that lands, `useSelectionInventory()` is `null` in staging, so build playback
against the demo.
