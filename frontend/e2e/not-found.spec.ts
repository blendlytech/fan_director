import { test, expect } from '@playwright/test'

/* -------------------------------------------------------------------------- */
/*  Smoke tests for the catch-all "page not found" route.                     */
/*                                                                            */
/*  Deployed as a static SPA, so every unknown path serves index.html and     */
/*  must resolve client-side to NotFound — this covers that the wildcard      */
/*  route catches unknown paths without swallowing any real route.            */
/* -------------------------------------------------------------------------- */

const NOT_FOUND_HEADING = "This page isn’t part of the demo"

test.describe('page not found', () => {
  test('an unknown path shows the not-found screen with the exact address', async ({ page }) => {
    await page.goto('/nope')

    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_HEADING })).toBeVisible()
    await expect(page.getByText('Page not found', { exact: true })).toBeVisible()
    await expect(page.locator('code')).toHaveText('/nope')

    await expect(page.getByText('Demo', { exact: true })).toBeVisible()
  })

  test('the shown address includes query and hash', async ({ page }) => {
    await page.goto('/creator/request/sarah-smiles?x=1#top')

    await expect(page.locator('code')).toHaveText('/creator/request/sarah-smiles?x=1#top')
  })

  test('the buttons navigate in-app to the real routes', async ({ page }) => {
    await page.goto('/nope')

    await page.getByRole('link', { name: 'Back to collection' }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/nope')
    await page.getByRole('link', { name: 'Open the Director' }).click()
    await expect(page).toHaveURL('/ai-director')
  })

  test('existing routes are not swallowed by the catch-all', async ({ page }) => {
    await page.goto('/saved')
    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_HEADING })).toHaveCount(0)

    await page.goto('/creator/requests')
    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_HEADING })).toHaveCount(0)

    await page.goto('/creator/requests/sarah-smiles-vintage-lounge/ask')
    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_HEADING })).toHaveCount(0)
  })

  test('a long path wraps without horizontal overflow at 375x812', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const longPath =
      '/creator/requests/sarah-smiles-vintage-lounge/this-is-a-very-long-mistyped-segment'
    await page.goto(longPath)

    await expect(page.getByRole('heading', { level: 1, name: NOT_FOUND_HEADING })).toBeVisible()

    const overflow = await page
      .locator('html')
      .evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    await expect(page.locator('code')).toHaveText(longPath)
  })

  test('the page never implies anything was saved or sent', async ({ page }) => {
    await page.goto('/nope')

    await expect(page.getByText(/(saved|sent) successfully/i)).toHaveCount(0)
  })
})
