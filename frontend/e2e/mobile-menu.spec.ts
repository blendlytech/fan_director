import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { BADGE, E2E_MODE, FAN_LINKS, MENU_NOTE } from './mode.ts'

/* -------------------------------------------------------------------------- */
/*  The header's mobile menu: a disclosure (not a modal) below the md          */
/*  breakpoint. Note getByRole ignores `inert`, so inertness isn't asserted.  */
/* -------------------------------------------------------------------------- */

test.use({ viewport: { width: 375, height: 812 } })

/** The toggle's accessible name flips between "Menu" and "Close", so locate it
 *  by the attribute that stays put. */
const toggle = (page: Page) => page.locator('header button[aria-controls]')
const panel = (page: Page) => page.getByRole('navigation', { name: 'Main' })

async function openMenu(page: Page) {
  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(panel(page)).toBeVisible()
}

test.describe('mobile menu', () => {
  test('opens a disclosure listing the fan links with the current page marked', async ({
    page,
  }) => {
    await page.goto('/saved')

    await expect(toggle(page)).toBeVisible()
    await expect(toggle(page)).toHaveText('Menu')
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(panel(page)).toBeHidden()
    // The desktop nav's links are display:none at this width.
    await expect(page.getByRole('link', { name: 'Saved ideas' })).toHaveCount(0)

    await openMenu(page)
    await expect(toggle(page)).toHaveText('Close')
    const controlled = await toggle(page).getAttribute('aria-controls')
    await expect(panel(page)).toHaveAttribute('id', controlled!)

    const links = panel(page).getByRole('link')
    await expect(links).toHaveText(FAN_LINKS)
    await expect(panel(page).getByRole('link', { name: 'Saved ideas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(panel(page).getByRole('link', { name: 'Collection' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(
      panel(page).getByText(MENU_NOTE),
    ).toBeVisible()
    // The header's badge is untouched.
    await expect(page.locator('header').getByText(BADGE, { exact: true })).toBeVisible()
  })

  test('activating a row navigates and closes the menu', async ({ page }) => {
    await page.goto('/')
    await openMenu(page)

    await panel(page).getByRole('link', { name: 'Saved ideas' }).click()

    await expect(page).toHaveURL('/saved')
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(panel(page)).toBeHidden()
    await expect(page.getByTestId('mobile-menu-overlay')).toHaveCount(0)
  })

  test('Escape closes the menu and returns focus to the toggle', async ({ page }) => {
    await page.goto('/saved')
    await openMenu(page)
    await panel(page).getByRole('link', { name: 'Collection' }).focus()

    await page.keyboard.press('Escape')

    await expect(panel(page)).toBeHidden()
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle(page)).toBeFocused()
  })

  test('the Close button closes the menu and keeps focus', async ({ page }) => {
    await page.goto('/saved')
    await openMenu(page)

    await toggle(page).click()

    await expect(panel(page)).toBeHidden()
    await expect(toggle(page)).toBeFocused()
  })

  test('tapping the dimmed page closes the menu and restores scrolling', async ({ page }) => {
    await page.goto('/saved')
    await openMenu(page)
    const body = page.locator('body')
    expect(await body.evaluate((el) => el.style.overflow)).toBe('hidden')

    await page.mouse.click(187, 760)

    await expect(panel(page)).toBeHidden()
    await expect(page).toHaveURL('/saved')
    expect(await body.evaluate((el) => el.style.overflow)).toBe('')
  })

  test('the creator header marks unbuilt sections as disabled rows', async ({ page }) => {
    await page.goto('/creator/requests')
    await openMenu(page)

    await expect(panel(page).getByRole('link')).toHaveText(['Requests'])
    await expect(panel(page).getByRole('link', { name: 'Requests' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    for (const label of ['Completed', 'Settings']) {
      const row = panel(page).getByText(label, { exact: true })
      await expect(row).toBeVisible()
      await expect(row).toHaveAttribute('aria-disabled', 'true')
      expect(await row.evaluate((el) => el.tagName)).toBe('SPAN')
      expect(await row.evaluate((el) => el.closest('a'))).toBeNull()
    }
  })

  test('on the Director the open menu sits above the fixed bottom bar', async ({ page }) => {
    await page.goto('/ai-director')
    await openMenu(page)

    const row = panel(page).getByRole('link', { name: 'Collection' })
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    const insidePanel = await row.evaluate(
      (el, { x, y }) => {
        const hit = el.ownerDocument.elementFromPoint(x, y)
        return !!hit?.closest('nav[aria-label="Main"]')
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    )
    expect(insidePanel).toBe(true)

    // The overlay dims the bottom bar too: a tap there hits the overlay, not the bar.
    const bottomHit = await row.evaluate(
      (el) => el.ownerDocument.elementFromPoint(187, 800)?.getAttribute('data-testid') ?? null,
    )
    expect(bottomHit).toBe('mobile-menu-overlay')
  })

  test('closes when the viewport grows to desktop width', async ({ page }) => {
    await page.goto('/saved')
    await openMenu(page)

    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(toggle(page)).toBeHidden()
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('mobile-menu-overlay')).toHaveCount(0)
  })

  test('browser Back and Forward never reopen the menu on the creator queue', async ({ page }) => {
    // Demo only: it opens the demo's own request by name. Staging's queue holds
    // real requests, and a signed-out visitor sees none of them, so there is
    // nothing to open. The behaviour itself is not mode-specific.
    test.skip(E2E_MODE === 'staging', 'Opens the demo’s fixed request; staging has no request to open signed out.')
    // The dashboard's Header stays mounted while its modal routes change, so every
    // step after the first load must be in-app history (no page.goto reloads).
    await page.goto('/creator/requests')
    await page.getByRole('link', { name: /request from @sarah_smiles/ }).click()
    await expect(page).toHaveURL('/creator/requests/sarah-smiles-vintage-lounge')
    await page.goBack()
    await expect(page).toHaveURL('/creator/requests')
    await openMenu(page)

    await page.goForward()
    await expect(page).toHaveURL('/creator/requests/sarah-smiles-vintage-lounge')
    await page.goBack()
    await expect(page).toHaveURL('/creator/requests')
    await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('desktop header', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('hides the Menu button and keeps the inline nav', async ({ page }) => {
    await page.goto('/saved')

    await expect(toggle(page)).toBeHidden()
    await expect(page.getByRole('link', { name: 'Saved ideas' })).toBeVisible()
  })
})
