# 08 — The creator lookbook, by hand

The lookbook editor exists in both builds:

- **Public demo:** `/creator/lookbook` edits a sample profile held in memory. Fans see the
  edits on `/ai-director` in the same visit, and a refresh brings the sample back.
- **Staging:** `/creator/lookbook` loads and saves the **signed-in creator's own** profile
  (`GET`/`PUT /api/creator/profile`, migration 0005). Fans don't see it yet.

All three parts can run on staging: migration 0005 and the R2 bucket are in place (2026-10-01).

---

## Part A — The public demo (runs today, ~10 min)

Start the demo build: `cd frontend`, then `$env:VITE_CLERK_PUBLISHABLE_KEY=''; npm run dev`.
Open <http://localhost:5173>. Steps 1–9 are also automated in `frontend/e2e/lookbook.spec.ts`.

| # | Do this | Expected |
| --- | --- | --- |
| 1 | On the entrance, click **Begin Your Vision** on any card | `/ai-director` opens with **Make it yours**, the creator's limits, and a sticky bar of numbered categories: Clothing, Scene, Accessories, Props, Costumes |
| 2 | Look for Toys or Fetishes anywhere on the page | Not there. They are adult categories, off on every site |
| 3 | In Clothing, click **Black one-piece swimsuit** | It gets a rose border and ✓; "Model's preference" is no longer selected |
| 4 | Click the bar's **4. Props**, then pick two props | The page jumps to Props; the counter reads "Choose up to 2 · 2 chosen" |
| 5 | Try a third prop | It's dimmed and nothing changes; a line explains the limit |
| 6 | In Scene, pick **Floral studio** | The Scene Card's setting becomes Floral Studio and the total changes to match |
| 7 | Go to **Review** | A **Visual requests** box lists every category: your picks with thumbnails, the rest as "Model's preference" |
| 8 | Open the browser's Network tab and repeat steps 3–7 | No request to `/api/…` and none to any AI provider |
| 9 | Refresh the page | Every pick is gone; every category is back to "Model's preference" |
| 10 | Open `/creator/lookbook` | "Creator demo controls", the line "everything resets when you refresh", and an **Apply as a founding creator** link to studiolens.me |
| 11 | Toys and Fetishes in the editor | Shown, each with "Adult · off on this site…" and no upload form |
| 12 | Create a category **Shoes**, set "Fan choices allowed" to 3, add **Red heels** with any JPG/PNG | "Item added for this demo visit." and the image appears |
| 13 | Change the accent colour | Links and borders across the page change colour at once |
| 14 | Click **Preview fan choices** | `/ai-director` now has **6. Shoes** with Red heels, "Choose up to 3" |
| 15 | Refresh | Shoes and the colour change are gone |

## Part B — Staging, signed in as the creator (~10 min)

Sign in with the creator account in doc 03.

| # | Do this | Expected |
| --- | --- | --- |
| 1 | Signed **out**, open `/creator/lookbook` | "Sign in with your creator account to edit your lookbook. A fan account can't open this page." No editor |
| 2 | Sign in as a **fan**, open `/creator/lookbook` | "This account isn't a creator account on this site." No editor |
| 3 | Sign in as the **creator**, open `/creator/lookbook` | The editor, with the studio name set to the creator's display name, empty categories, and "Not saved yet. This is your starting point." |
| 4 | Header links | **Requests** and **Lookbook**; the queue at `/creator/requests` shows the same two |
| 5 | Every "Add your own item" area, and Background image | File pickers are there (uploads are Part C) |
| 6 | Change Style, add a limit "No feet" under **Things I will not do**, create category **Shoes** with limit 3 | The bar at the top says "You have unsaved changes." |
| 7 | Try to close the tab | The browser asks whether to leave |
| 8 | Click **Save changes** | "All changes saved to your account." |
| 9 | Reload | The style, "No feet" and Shoes are still there |
| 10 | Open the page in a second tab, save a change there, then save a different change in the first tab | The first tab says the lookbook was saved somewhere else and asks you to reload; nothing is overwritten |
| 11 | Put 11 lines under **Ask me first** | The counter turns red ("remove some before saving"); saving shows a plain-language error, not a code |
| 12 | Scroll to **How fans will see your choices** | The picker with your categories, marked as a preview that fans don't see yet |
| 13 | As a fan on `/ai-director` | Unchanged from Phase 4: no lookbook. That is expected for now |

## Part C — Image uploads on staging

Uploads go to the private R2 bucket `fan-director-media-staging` and are served only
through `/api/media/<id>`.

Signed in as the creator:

| # | Do this | Expected |
| --- | --- | --- |
| 1 | Open `/creator/lookbook` | Every category has an "Add your own item" form with a file picker |
| 2 | Add an item to Shoes with a JPG | "Image uploaded. Press Save changes to keep it in your lookbook." |
| 3 | Save, reload | The image is still there, served from `/api/media/<id>` |
| 4 | Rename a text file to `notes.png` and try to add it | "That file isn't a JPG, PNG or WebP image this site can use." Nothing is uploaded |
| 5 | Try a photo over 8 MB | "Choose a JPG, PNG, or WebP image under 8 MB." |
| 6 | Open an uploaded image's address (`/api/media/<id>`) in a private window | The image loads without signing in, as it will for fans |
