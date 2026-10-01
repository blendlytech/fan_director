import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { E2E_MODE } from './mode.ts'

/* -------------------------------------------------------------------------- */
/*  The public demo's lookbook: fan choices, the creator editor, and the       */
/*  in-memory rule. Demo only: staging's lookbook belongs to a signed-in       */
/*  creator (worker/test/creator-profile.test.ts covers its API).              */
/*                                                                            */
/*  The lookbook lives in memory for the visit, so every step after the first  */
/*  page.goto is an in-app click; a page.goto is how a refresh is modelled.    */
/* -------------------------------------------------------------------------- */

test.skip(E2E_MODE === 'staging', 'The demo lookbook only exists in the demo build')

/** A 1×1 PNG, enough for the editor's resize-and-add path. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

/** Every request the page makes that would reach a server or an AI provider. */
function watchServerCalls(page: Page): string[] {
  const calls: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api') || !['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com', 'api.iconify.design', 'api.simplesvg.com', 'api.unisvg.com'].includes(url.hostname)) {
      calls.push(request.url())
    }
  })
  return calls
}

test.describe('the demo lookbook', () => {
  test('a fan moves through the categories, respects each limit, and sees the inventory on Review', async ({ page }) => {
    const calls = watchServerCalls(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Begin Your Vision — Intimate Backstage' }).click()

    const nav = page.getByRole('navigation', { name: 'Choice categories' })
    await expect(nav.getByRole('link')).toHaveText(['1. Clothing', '2. Scene', '3. Accessories', '4. Props', '5. Costumes'])
    // Adult categories are modelled but off: no fan ever sees them.
    await expect(nav.getByText(/Toys|Fetishes/)).toHaveCount(0)

    const clothing = page.getByRole('region', { name: 'Clothing' })
    await expect(clothing.getByRole('radio', { name: /Model’s preference/ })).toBeChecked()
    await clothing.getByRole('button', { name: /Black one-piece swimsuit/ }).click()
    await expect(clothing.getByRole('button', { name: /Black one-piece swimsuit/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(clothing.getByRole('radio', { name: /Model’s preference/ })).not.toBeChecked()

    await nav.getByRole('link', { name: '4. Props' }).click()
    const props = page.getByRole('region', { name: 'Props' })
    await props.getByRole('button', { name: /Cat-eye glasses/ }).click()
    await props.getByRole('button', { name: /Feather fan/ }).click()
    // Props allows two: the third is refused until one is removed.
    await expect(props.getByRole('button', { name: /Body oil/ })).toHaveAttribute('aria-disabled', 'true')
    await props.getByRole('button', { name: /Body oil/ }).click({ force: true })
    await expect(props.getByRole('button', { name: /Body oil/ })).toHaveAttribute('aria-pressed', 'false')
    await expect(props.getByText('Choose up to 2 · 2 chosen')).toBeVisible()

    await page.getByRole('link', { name: 'Review Scene Card' }).first().click()
    await expect(page).toHaveURL('/review')
    const inventory = page.getByRole('region', { name: 'Visual requests' })
    await expect(inventory.getByText('Black one-piece swimsuit')).toBeVisible()
    await expect(inventory.getByText('Cat-eye glasses')).toBeVisible()
    await expect(inventory.getByText('Feather fan')).toBeVisible()
    await expect(inventory.getByText('Model’s preference')).toHaveCount(3)

    expect(calls).toEqual([])
  })

  test('a demo creator’s edits reach the fan picker, and a refresh clears them', async ({ page }) => {
    const calls = watchServerCalls(page)
    await page.goto('/creator/lookbook')
    await expect(page.getByText(/everything resets when you refresh/)).toBeVisible()
    await expect(page.getByText(/Adult · off on this site/).first()).toBeVisible()

    await page.getByLabel('New category name').fill('Shoes')
    await page.getByRole('button', { name: 'Create category' }).click()
    const shoes = page.getByRole('region', { name: 'Shoes' })
    await shoes.getByLabel('Fan choices allowed').fill('3')
    await shoes.getByLabel('Item name').fill('Red heels')
    await shoes.getByLabel('Your image').setInputFiles({ name: 'heels.png', mimeType: 'image/png', buffer: PNG })
    await shoes.getByRole('button', { name: 'Add image' }).click()
    await expect(shoes.getByText('Item added for this demo visit.')).toBeVisible()
    await expect(shoes.getByText('Red heels')).toBeVisible()

    await page.getByRole('link', { name: 'Preview fan choices' }).click()
    await expect(page).toHaveURL('/ai-director')
    const nav = page.getByRole('navigation', { name: 'Choice categories' })
    await expect(nav.getByRole('link', { name: '6. Shoes' })).toBeVisible()
    const fanShoes = page.getByRole('region', { name: 'Shoes' })
    await expect(fanShoes.getByText('Choose up to 3 · 0 chosen')).toBeVisible()
    await fanShoes.getByRole('button', { name: /Red heels/ }).click()
    await expect(fanShoes.getByRole('button', { name: /Red heels/ })).toHaveAttribute('aria-pressed', 'true')

    // A refresh is a fresh visit: the sample profile, nothing chosen.
    await page.goto('/ai-director')
    await expect(page.getByRole('navigation', { name: 'Choice categories' }).getByRole('link', { name: /Shoes/ })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Clothing' }).getByRole('radio', { name: /Model’s preference/ })).toBeChecked()

    expect(calls).toEqual([])
  })
})
