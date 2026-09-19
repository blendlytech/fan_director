import type { APIRequestContext } from '@playwright/test'

/* -------------------------------------------------------------------------- */
/*  One suite, two targets (doc 11 §5.6 item 22).                             */
/*                                                                            */
/*  E2E_MODE=demo (the default) runs against the local dev server with no     */
/*  Clerk key. E2E_MODE=staging with E2E_BASE_URL runs the same tests against  */
/*  the deployed staging site. Only what differs by design changes here: the   */
/*  header badge, and the entrance ranges, which staging derives from the      */
/*  catalog (Gate 0 decision 2). Every other assertion is shared.              */
/* -------------------------------------------------------------------------- */

export const E2E_MODE: 'demo' | 'staging' = process.env.E2E_MODE === 'staging' ? 'staging' : 'demo'

/** The header badge text. */
export const BADGE = E2E_MODE === 'staging' ? 'Staging' : 'Demo'

type Ranges = { vintage: string; floral: string; backstage: string }

/** "$145" from cents, the way the app prints whole dollars. */
const dollars = (cents: number) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`

/**
 * The range text each entrance card must show. The demo keeps its own
 * ranges; staging must show exactly what the catalog API derives.
 */
export async function expectedRanges(request: APIRequestContext): Promise<Ranges> {
  if (E2E_MODE === 'demo') {
    return { vintage: 'From $145 – $205', floral: 'From $155 – $215', backstage: 'From $125 – $185' }
  }
  const res = await request.get('/api/creators/cr_maya/catalog')
  if (!res.ok()) throw new Error(`catalog API answered ${res.status()}`)
  const { ranges } = (await res.json()) as { ranges: Record<string, { min: number; max: number }> }
  const text = (itemId: string) => {
    const range = ranges[itemId]
    if (!range) throw new Error(`no range for ${itemId}`)
    return `From ${dollars(range.min)} – ${dollars(range.max)}`
  }
  return {
    vintage: text('maya_setting_vintage'),
    floral: text('maya_setting_floral'),
    backstage: text('maya_setting_backstage'),
  }
}
