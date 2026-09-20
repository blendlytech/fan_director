import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { E2E_MODE, SAVED_NOTICE } from './mode.ts'

/* -------------------------------------------------------------------------- */
/*  Smoke tests for /saved and the Director's "Save idea" button.              */
/*                                                                            */
/*  The draft lives in the shared CommissionContext for the current tab only, */
/*  so a page.goto resets it. Each test below does at most one page.goto('/') */
/*  and navigates every step after that by clicking in-app links/buttons.     */
/* -------------------------------------------------------------------------- */

/** Begin the journey from the entrance on a curated theme card, landing on
 *  /ai-director with the draft seeded to that setting. */
async function beginWithBackstage(page: Page) {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Begin Your Vision — Intimate Backstage' })
    .click()
  await expect(page).toHaveURL('/ai-director')
}

/** The Director's whole-dollar total ("$125") to the two-decimal currency
 *  string ("$125.00") the Saved ideas / Review / Confirmation screens show.
 *  `money()` in the domain module never prints decimals, so this is exact. */
function toCurrencyString(moneyText: string): string {
  return `${moneyText}.00`
}

test.describe('saved ideas', () => {
  test('a direct load shows the default draft, honestly labelled as unsaved', async ({
    page,
  }) => {
    await page.goto('/saved')

    await expect(page.getByRole('heading', { level: 1, name: 'Saved ideas' })).toBeVisible()
    await expect(page.getByText(SAVED_NOTICE)).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 3, name: 'Vintage Lounge Greeting' }),
    ).toBeVisible()
    await expect(page.getByText('$145.00')).toBeVisible()

    await expect(page.getByRole('link', { name: 'Saved ideas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('a changed draft in the Director is reflected on Saved ideas', async ({ page }) => {
    await beginWithBackstage(page)

    // Read the Director's own live total instead of hardcoding the Backstage
    // default, so this test doesn't duplicate the domain's pricing math.
    const directorTotal = await page.locator('.animate-price-flash:visible').first().textContent()
    expect(directorTotal).toBeTruthy()

    await page.getByRole('link', { name: 'Saved ideas' }).click()
    await expect(page).toHaveURL('/saved')

    await expect(page.getByRole('heading', { level: 3, name: 'Backstage Greeting' })).toBeVisible()
    await expect(page.getByText(toCurrencyString(directorTotal!.trim()))).toBeVisible()

    await page.getByRole('link', { name: 'Continue editing' }).click()
    await expect(page).toHaveURL('/ai-director')
  })

  test('the Director\'s Save idea button never claims anything was saved', async ({ page }) => {
    // Demo only: staging really does save a signed-in fan's draft (design 18,
    // owner-approved 2026-09-18), so "Not saved — demo" would be the false
    // claim there. The test below, which no build may fail, covers both.
    test.skip(E2E_MODE === 'staging', 'Staging saves drafts for real; this is the demo’s honest no-save state.')
    await page.goto('/ai-director')

    const saveButton = page.getByRole('button', { name: 'Save idea' })
    await expect(saveButton).toBeVisible()

    // Empty until clicked — nothing to announce yet.
    const status = page.getByRole('status')
    await expect(status).toHaveText('')

    await saveButton.click()

    await expect(page.getByRole('button', { name: 'Not saved — demo' })).toBeVisible()
    // The rendered apostrophe is a typographic "&rsquo;" (U+2019), not "'".
    await expect(page.getByText(/This demo can.t save ideas\./)).toBeVisible()

    await page.getByRole('link', { name: 'See why' }).click()
    await expect(page).toHaveURL('/saved')
  })

  test('the page never claims a save succeeded or that a profile exists', async ({ page }) => {
    await page.goto('/saved')

    await expect(page.getByText(/saved (successfully|to your profile)/i)).toHaveCount(0)
  })
})
