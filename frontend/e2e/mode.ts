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

/* -------------------------------------------------------------------------- */
/*  What each build may honestly say about sending (doc 11 §3 rules 1 and 2).  */
/*                                                                            */
/*  The demo has no backend and says so. Staging has one: it never calls       */
/*  itself a demo, and it never says nothing is saved. What both builds share  */
/*  is that a signed-out visitor has sent nothing, so /confirmation reads the   */
/*  same in either one. These are written out rather than imported from        */
/*  src/copy, so rewording a disclaimer has to be a deliberate change here      */
/*  too, and the e2e project keeps its own compiler settings.                   */
/* -------------------------------------------------------------------------- */

/** The mobile menu's line about what this build does with your work. */
export const MENU_NOTE =
  E2E_MODE === 'staging'
    ? 'Staging — your draft is saved to your account, and you can send it for review.'
    : 'Demo — nothing you make here is saved or sent.'

/** What the Review page says above Send, signed out. */
export const REVIEW_NOTICE =
  E2E_MODE === 'staging'
    ? 'Sign in to send this to Maya. Nothing has been sent, and nothing is charged here.'
    : 'This is a demo with no backend, so nothing will actually be sent, and you won’t be notified or asked to pay.'

/**
 * The fan links in the header. Staging adds "Your requests", where an answer
 * to a sent request appears; the demo has nothing to send, so it has no such
 * page (Phase 4).
 */
export const FAN_LINKS =
  E2E_MODE === 'staging'
    ? ['Collection', 'Your studio', 'Saved ideas', 'Your requests']
    : ['Collection', 'Your studio', 'Saved ideas']

/**
 * What /saved says about keeping your work. The demo has no storage at all;
 * staging keeps a signed-in fan's draft, and tells a signed-out visitor how
 * to get that rather than claiming nothing is ever saved.
 */
export const SAVED_NOTICE =
  E2E_MODE === 'staging'
    ? 'Sign in to keep your draft on your account. Until then it lives in this tab only, and refreshing clears it.'
    : /This demo saves nothing/

/** The confirmation page, where a signed-out visitor lands in both builds. */
export const NOTHING_SENT_HEADING = 'Nothing was sent to Maya'

/** Sentences no build may show unless a server really did it. */
export const NEVER_WITHOUT_A_SERVER = ['Submitted Successfully', 'Order #']

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
