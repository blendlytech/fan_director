import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { expectedRanges, NEVER_WITHOUT_A_SERVER, NOTHING_SENT_HEADING, REVIEW_NOTICE } from './mode.ts'

/* -------------------------------------------------------------------------- */
/*  Smoke tests for the fan journey: / -> /ai-director -> /review ->           */
/*  /confirmation, sharing one in-memory draft via React context.              */
/*                                                                            */
/*  The draft is lost on a full page load, so after the first page.goto('/')  */
/*  every step below navigates by clicking in-app links/buttons only.         */
/* -------------------------------------------------------------------------- */

/** The live total shown in the Director's sidebar (desktop) and sticky bar
 *  (mobile). Both share the `animate-price-flash` class; only one is visible
 *  at the default desktop viewport used by the chromium project. */
function liveTotal(page: Page): Locator {
  return page.locator('.animate-price-flash:visible').first()
}

/** Begin the journey from the entrance on a curated theme card, landing on
 *  /ai-director with the draft seeded to that setting. */
async function beginWithBackstage(page: Page) {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Begin Your Vision — Intimate Backstage' })
    .click()
  await expect(page).toHaveURL('/ai-director')
}

test.describe('fan journey', () => {
  test('a total set in the Director survives into Review and Confirmation', async ({
    page,
  }) => {
    await beginWithBackstage(page)

    // Backstage + Longer Video + the extra-minute add-on: 90 base + 80
    // runtime (2 extra minutes) + 15 setup + $0 standard greeting = $185,
    // which is over the $150 budget. This differs from the $145 default
    // (vintage + richer + no extra minute), so a reset back to the default
    // would be caught by the assertions below.
    await page
      .getByRole('radiogroup', { name: 'Where to spend the budget' })
      .getByRole('radio', { name: /Longer Video/ })
      .click()

    const extraMinuteToggle = page.getByRole('button', {
      name: /Extra minute of runtime/,
    })
    await extraMinuteToggle.click()
    await expect(extraMinuteToggle).toHaveAttribute('aria-pressed', 'true')

    await expect(liveTotal(page)).toHaveText('$185')

    await page.locator('a[href="/review"]:visible').first().click()
    await expect(page).toHaveURL('/review')

    const totalEstimateLabel = page.getByText('Total Estimate', { exact: true })
    const totalEstimateValue = totalEstimateLabel.locator('xpath=following-sibling::span[1]')
    await expect(totalEstimateValue).toHaveText('$185.00')

    // Signed out, neither build sends anything — but only the demo may call
    // itself a demo with no backend (mode.ts).
    await expect(page.getByText(REVIEW_NOTICE)).toBeVisible()

    await page.getByRole('link', { name: 'Send to Creator' }).click()
    await expect(page).toHaveURL('/confirmation')

    await expect(page.getByRole('heading', { level: 1, name: NOTHING_SENT_HEADING })).toBeVisible()

    const estimatedPriceCard = page
      .locator('div.rounded-xl')
      .filter({ has: page.getByRole('heading', { level: 3, name: 'Estimated Price' }) })
    await expect(estimatedPriceCard.locator('p').first()).toHaveText('$185.00')

    const overBudgetCard = page
      .locator('div.rounded-xl')
      .filter({ has: page.getByRole('heading', { level: 3, name: 'Over Budget' }) })
    await expect(overBudgetCard.locator('p').first()).toHaveText('$35.00')

    for (const claim of NEVER_WITHOUT_A_SERVER) {
      await expect(page.getByText(claim)).toHaveCount(0)
    }
  })

  test('undoing once in the Director reverts exactly one change', async ({ page }) => {
    await beginWithBackstage(page)

    // Change 1: setting -> Floral (backstage + richer + no extra = $125,
    // floral + richer + no extra = 90 + 45 + 20 = $155).
    await page
      .getByRole('radiogroup', { name: 'Scene setting' })
      .getByRole('radio', { name: /Floral Studio/ })
      .click()
    await expect(liveTotal(page)).toHaveText('$155')

    // Change 2: focus -> Longer Video (floral + longer + no extra =
    // 90 + 40 runtime + 45 + $0 standard greeting = $175).
    await page
      .getByRole('radiogroup', { name: 'Where to spend the budget' })
      .getByRole('radio', { name: /Longer Video/ })
      .click()
    await expect(liveTotal(page)).toHaveText('$175')

    // A single Undo should land back on the state after change 1 ($155) --
    // not on the pre-change-1 state ($125, which would mean undo fired
    // twice under StrictMode's double dispatch) and not still at $175
    // (which would mean undo did nothing).
    await page.getByRole('button', { name: /Undo last change/ }).click()
    await expect(liveTotal(page)).toHaveText('$155')
  })

  test('re-clicking the selected option does not add an undo step', async ({ page }) => {
    await beginWithBackstage(page) // $125

    const settings = page.getByRole('radiogroup', { name: 'Scene setting' })
    await settings.getByRole('radio', { name: /Floral Studio/ }).click()
    await expect(liveTotal(page)).toHaveText('$155')

    // Re-click what is already selected, in both groups. Neither is a change.
    await settings.getByRole('radio', { name: /Floral Studio/ }).click()
    await page
      .getByRole('radiogroup', { name: 'Where to spend the budget' })
      .getByRole('radio', { name: /Richer Setting/ })
      .click()

    // One Undo must revert the Floral change. With empty steps recorded, it
    // would stay at $155.
    await page.getByRole('button', { name: /Undo last change/ }).click()
    await expect(liveTotal(page)).toHaveText('$125')
  })

  test('entrance cards show the derived price ranges', async ({ page, request }) => {
    const ranges = await expectedRanges(request)
    await page.goto('/')

    const vintageCard = page.locator('div.rounded-xl').filter({ hasText: 'Vintage Lounge Greeting' })
    await expect(vintageCard.getByText(/^From \$\d+ – \$\d+$/)).toHaveText(ranges.vintage)

    const floralCard = page.locator('div.rounded-xl').filter({ hasText: 'Floral Studio Scene' })
    await expect(floralCard.getByText(/^From \$\d+ – \$\d+$/)).toHaveText(ranges.floral)

    const backstageCard = page.locator('div.rounded-xl').filter({ hasText: 'Intimate Backstage' })
    await expect(backstageCard.getByText(/^From \$\d+ – \$\d+$/)).toHaveText(ranges.backstage)
  })
})
