// Phase 2 checks that need no sign-in, against a running Worker (doc 11 §8
// Phase 2 criteria 1, 2 and 5 "through the API"). Read-only: the quote
// endpoint stores nothing.
//   node scripts/phase2-public-checks.mjs https://fan-director-studio-staging.blendly.workers.dev
const base = process.argv[2]
if (!base) {
  console.error('Usage: node scripts/phase2-public-checks.mjs <base url>')
  process.exit(2)
}
const creator = 'cr_maya'
let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`)
}

const catalogRes = await fetch(`${base}/api/creators/${creator}/catalog`)
const catalog = await catalogRes.json()
check('catalog 200', catalogRes.status === 200, String(catalogRes.status))
const v = catalog.catalogVersionId
check('no adult categories sent', !catalog.categories.some((c) => c.contentRating !== 'general'))
check(
  'ranges derived from selection groups',
  JSON.stringify(catalog.ranges) ===
    JSON.stringify({
      maya_setting_vintage: { min: 12500, max: 59000 },
      maya_setting_floral: { min: 13500, max: 61000 },
      maya_setting_backstage: { min: 10500, max: 55000 },
    }),
  JSON.stringify(catalog.ranges),
)
check('four templates', catalog.templates.length === 4)
check('hard list has 10 rules', catalog.boundaries.platform.length === 10)

const post = (body, origin = base) =>
  fetch(`${base}/api/creators/${creator}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  })
const selections = [
  ...catalog.defaults.filter((s) => s.itemId !== 'maya_greeting_standard'),
  { itemId: 'maya_setting_vintage', qty: 1 },
  { itemId: 'maya_greeting_detailed', qty: 1 },
]
const q = async (sel, budget = 15000) => {
  const res = await post({ catalogVersionId: v, selections: sel, budget })
  return { status: res.status, body: await res.json() }
}

let r = await q(selections)
check('§9: $145, $5 under a $150 budget', r.body.quote?.total === 14500 && r.body.quote?.budgetDifference === 500, JSON.stringify(r.body.quote?.total))
r = await q([...selections, { itemId: 'maya_extra_minute', qty: 1 }])
check('§9: +1 minute = $185, $35 over', r.body.quote?.total === 18500 && r.body.quote?.budgetDifference === -3500)
r = await q(selections)
check('§9: removing it restores $145', r.body.quote?.total === 14500)

const swap = (from, to) => selections.map((s) => (s.itemId === from ? { itemId: to, qty: 1 } : s))
r = await q(swap('maya_rights_resell', 'maya_rights_exclusive').map((s) => (s.itemId === 'maya_delivery_standard' ? { itemId: 'maya_delivery_rush', qty: 1 } : s)), null)
check('percent lines on the subtotal: 14500 + 7250 + 7250', r.body.quote?.total === 29000 && r.body.quote?.deliveryDaysFromPayment === 2)
r = await q(swap('maya_name_none', 'maya_name_once'))
check('personalised + resell rejected', r.status === 422 && r.body.error === 'personalised_video_resale_forbidden')

r = await q([...selections, { itemId: 'free_upgrade', qty: 1 }])
check('tampered: unknown item', r.status === 422 && r.body.reason === 'unknown_item')
r = await q([...selections, { itemId: 'maya_extra_minute', qty: 3 }])
check('tampered: over-limit quantity', r.status === 422 && r.body.reason === 'qty_out_of_range')
r = await q([...selections, { itemId: 'maya_props', qty: 1 }])
check('tampered: adult/hidden id not in catalog', r.status === 422 && r.body.reason === 'unknown_item')
let res = await post({ catalogVersionId: v, selections: [{ itemId: 'maya_base_video', qty: 1, amount: 1 }], budget: null })
check('tampered: edited price', res.status === 400 && (await res.json()).error === 'invalid_quote')
res = await post({ catalogVersionId: v, selections, budget: null, total: 1 })
check('tampered: client total', res.status === 400)
res = await post({ catalogVersionId: v, selections, budget: null }, 'https://evil.example')
check('cross-site request refused', res.status === 403)

console.log(failures ? `${failures} check(s) failed` : 'All checks passed')
process.exit(failures ? 1 : 0)
