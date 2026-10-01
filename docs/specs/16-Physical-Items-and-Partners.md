# Fan Director Studio: Physical Items and Partners

Date: 2026-10-01
Owner: Clay Mills
Written for: the owner (to approve) and the coding agent who builds it
Status: **Draft for owner approval.** Nothing here is built. It adds new catalog item kinds, shipping and partner rules on top of docs 11, 14 and 15.

---

## 1. What this is

Owner ideas, 2026-10-01:

1. **Keepsakes:** the fan buys something the creator wore or used in their video (underwear, socks, a cloth, and so on), and it is sent to them after the video.
2. **Gifts for her:** the fan buys something the creator doesn't own, for her to wear or use in the video. The cost is included in the price. The creator or the platform orders it and has it shipped to her.
3. **Sponsors and affiliates:** brands pay to be featured, or pay commission on items sold. The revenue is shared with creators. Creators may also get their own sponsorships from brands they use and promote.

The custom-video market research (`docs/reports/custom-video-market-research.md`) already describes gifts for her as common practice: fans fund an outfit through a wishlist, at the item's cost plus $20–40 of prep.

## 2. Rules for every physical item

1. **Neither side ever sees the other's address** through the platform. Where that can't be guaranteed, the person whose address would be seen is told before they choose (§5).
2. **Prices come only from the server's quote,** like everything else. Items are part of the Scene Card the creator approves (Phase 4), and the AI never names a price.
3. **Item text is checked like any creator or fan text:** the platform hard list and the creator's limits.
4. **Discreet packaging** and a neutral sender name, always.
5. **Addresses are never sent to an AI model,** never written to logs, and deleted a set time after delivery (§9).

## 3. Keepsakes

- **The creator lists what she's willing to part with,** per item, in a new catalog category, **"Keepsakes"**. She sets a price, writes a short description and adds a photo of the unworn item. Each listing is a choice she offers, not a promise of every video.
- **The fan adds a keepsake to their Scene Card** like any item. The Director (doc 15) may mention keepsakes only when the fan's story touches on them (for example, "the lace she wore").
- **It ships after filming,** with its own delivery date. The video's date doesn't move.
- **The default is "worn".** Listings that involve bodily fluids raise mailing and health rules. Whether they are allowed at all is a counsel question (§12, question 4). Until then, the platform allows worn items only.
- **Shipping (owner decision, 2026-10-01):** the creator mails it **from her PO box** to the fan's **PO box or mail-forwarding company**, never to a home address. See §5.

## 4. Gifts for her

- **The creator keeps a list of items she's willing to receive and use on camera:** her wishlist. Each entry has a product name, a link, the cost and the expected shipping time. Her sizes are stored privately and never shown to fans.
- **The fan picks an item.** The price is the item's cost plus the creator's prep fee, quoted by the server.
- **The creator buys it herself** and it is built into the price (owner decision, 2026-10-01). The platform holds no money and ships nothing. Later, a sponsor may supply items instead (§6).
- **Fast shipping only (owner decision, 2026-10-01):** wishlist items should be available with two-day shipping (for example Amazon Prime). Any slower item shows its expected arrival date on the Review screen before the fan sends.
- **The clock starts when the item arrives.** The Review screen says so: "Maya films within 7 days of the item arriving (expected around [date])."
- **Arrival notice (owner decision, 2026-10-01):**
  - When the item arrives, Maya marks it received. The fan gets a discreet service email ("Maya has something to show you"), with **no photo and nothing suggestive in the email itself**.
  - The link opens the app, where Maya's photo of herself wearing or holding the item sits with her playful caption. That builds anticipation behind sign-in, where explicit and suggestive content belongs (doc 11 §5.8).
  - The caption is hers. It is written or approved by her and hard-list checked like any creator text. If AI drafts it, the AI-help question for letters (doc 12 §8.3) applies.
  - The photo is part of the fan's commission: exclusive to them, and deleted with the commission record.
- **If the price changes or the item sells out** before she buys it, the creator proposes a change through Phase 4's "propose changes". The fan accepts or declines, as with any change.
- The item becomes the creator's.

## 5. Shipping and address privacy

**The constraint:** whoever prints a shipping label sees the address on it. So:

| Item goes | Who could see an address | How it's kept private |
| --- | --- | --- |
| Gift → creator, bought by herself | No one new | Nothing is shared |
| Gift → creator, supplied by a sponsor (later) | The sponsor and the platform | The fan never sees it. The address is stored encrypted and used only for that order |
| Keepsake → fan | The creator sees a **PO box or forwarding address**, never a home | The creator ships from her own PO box. The fan gives a PO box or a mail-forwarding company's address |

**Keepsakes (owner decision, 2026-10-01):**

- The creator always ships from a **PO box**, never her home.
- The fan gives **a PO box or a mail-forwarding company's address**. It is entered on the platform (not sent by email), so it can be deleted automatically after delivery (§9) and nobody's inbox keeps it. The fan confirms "This is a PO box or forwarding address, not my home." The platform can't verify that, so the fan is told why it matters.
- The creator sees that address only to address the parcel. It disappears from her view once she marks the parcel shipped.

**Proposed for the pilot:** domestic shipping only, since customs forms name the contents and some countries restrict these items.

## 6. Sponsors and affiliates

- **Affiliate links:** gift-for-her items can come from partner brands that pay a commission. The revenue is shared with the creator (§12, question 1). **Amazon is probably not an option for commissions:** its Associates program has historically excluded sites with sexually explicit content. Creators buying on Amazon themselves is unaffected. Confirm before relying on it (§12, question 8).
- **A sponsor catalog:** brands supply items (toys, lingerie) that creators can add to their wishlists. A creator chooses which ones she'll use.
- **Creator sponsorships:** a brand can sponsor a creator directly, as an ambassador. The platform introduces them and the creator agrees the deal. The platform's share, if any, is set in the creator terms.
- **Disclosure is required.** In the US, the FTC's endorsement rules require a clear disclosure of any paid or affiliate relationship. Sponsored items carry a "Sponsored" label on the site. If a sponsored product is shown in a video because of the sponsorship, the creator discloses it in her own channels. Counsel confirms the details (§12, question 5).
- **Opt-in per creator.** A creator with a "no brand mentions" limit can still receive gifts. She just doesn't show or name brands on camera.
- **Partner rules:** only adult-wellness brands with body-safe materials, and nothing that touches the platform hard list. The owner approves each partner.

## 7. Payments

- **Pilot (doc 10's model):** the fan pays the creator on her own platform, and the Scene Card price includes the items. The platform records what was agreed but holds no money. Each creator checks that her platform allows selling and shipping physical items (as in doc 13 §7).
- **Later:** a platform-run hub, platform-ordered gifts and affiliate payouts all mean the platform handles money. That needs an adult-friendly payment processor, the compliance work described for private delivery, and its own spec.

## 8. Phases

| Phase | What ships |
| --- | --- |
| **Pilot** | Keepsakes, shipped PO box to PO box or forwarder; gifts bought by the creator with fast shipping and priced in; the arrival notice with her photo in the app; both as catalog item kinds the Director understands |
| **Later** | Sponsor-supplied gifts, the sponsor catalog, affiliate revenue and payouts. Needs platform payments (§7) |

## 9. Data and retention

- Addresses and sizes are stored encrypted, used only for that shipment, and deleted **30 days after delivery** (proposed; §12, question 6).
- They are never shown to the other party, never sent to an AI model, and never written to logs.
- Shipping records keep only the carrier, the tracking status and the dates.

## 10. The Director (doc 15)

- Keepsakes and gifts are catalog items in the per-request enum, so the Director can offer them, priced by the server.
- They come up only when the story calls for them, under doc 15 §6 rule 6. For example, "I want her in red stockings" can bring up a gift-for-her card if red stockings are on her wishlist.
- The Director never asks for or repeats an address or a size.

## 11. What the build touches

| Area | Change |
| --- | --- |
| Catalog model | Item kinds `keepsake` and `gift`; the creator's wishlist; prep fees; ship-after-filming and arrive-before-filming dates |
| Quote | Item cost plus prep; delivery days from the item's arrival |
| Fan screens | Keepsake and gift choices, the address notice, the locker option, an address form (only once, at the end) |
| Creator screens | Keepsake listings, the wishlist with private sizes, shipping status |
| Data | Encrypted addresses and sizes, retention job, shipping records |
| Creator terms | The worn-items default, discreet packaging, disclosure duties |
| Designs | New designs for the fan's item choices and address step, and the creator's listings and wishlist |

## 12. Open questions for the owner

| # | Question | Needed by |
| --- | --- | --- |
| 1 | The revenue share on affiliate and sponsor income (platform vs creator) | Before partners |
| 2 | ~~Pilot keepsake shipping?~~ **Decided (owner, 2026-10-01):** creator's PO box → fan's PO box or mail forwarder | Done |
| 3 | Domestic shipping only in the pilot? (Proposed: yes) | Before build |
| 4 | Counsel: are items involving bodily fluids allowed at all, and under what shipping rules? | Before those listings |
| 5 | Counsel: disclosure wording for sponsored items and in-video products | Before partners |
| 6 | How long addresses are kept after delivery (proposed: 30 days) | Before build |
| 7 | Which brands to approach first, and whether partners are vetted by the owner alone | Before partners |
| 8 | Confirm whether Amazon Associates (or any mainstream affiliate program) accepts this site | Before counting on affiliate income |
