import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import { allowedItems, buildOption, DIRECTOR_SLOTS_V1 } from '../../shared/domain/director.ts'
import { defaultSelections } from '../../shared/domain/ranges.ts'
import type { CatalogContent, Selection } from '../../shared/domain/types.ts'
import { bodyOf, testEnv } from './helpers'
import { allStrings, directorSetup, option, reply } from './ai-helpers'

/**
 * The test-process-only adult path (doc 11 §5.4, §5.6 item 3: automated tests
 * may switch adult content on inside the test process, never in a deployed
 * environment). This file proves two things:
 *
 *  - while any switch is off (the default, and the only state any deployed
 *    environment is ever in), an adult item never reaches the model, the
 *    draft, or the fan, even if the mocked model somehow names it;
 *  - even with every switch on, the AI Director still can't offer an adult
 *    item, because DIRECTOR_SLOTS_V1 (doc 11 §5.6 decision 22) has no
 *    adult-gated slot. Nothing adult reaches a fan without the design-20 UI
 *    that would let a fan actually see and choose it.
 *
 * `buildOption` itself is unit-tested for the adult gate in
 * worker/test/domain/director.test.ts; the cases here extend that coverage
 * with a synthetic fixture named as doc 11 §8 describes it (`fx_prop_a`,
 * `props`), rather than duplicating that file's assertions verbatim.
 */

const off = { adultAllowed: false }
const on = { adultAllowed: true }

/** A synthetic adult fixture, built only in this test file: never seeded, never deployed. */
function withAdultProps(): CatalogContent {
  return {
    ...PILOT_V1,
    categories: PILOT_V1.categories.map((c) =>
      c.key !== 'props'
        ? c
        : {
            ...c,
            hidden: false,
            selection: { min: 0, max: 1 },
            items: [
              {
                id: 'fx_prop_a',
                key: 'fx_prop_a',
                label: 'Synthetic prop A',
                origin: 'starter',
                contentRating: 'adult',
                pricing: { kind: 'fixed', amount: 1_000 },
                hidden: false,
                sortOrder: 0,
              },
            ],
          },
    ),
  }
}

describe('AI Director + adult content: off by default (every deployed environment)', () => {
  it('a mock output naming fx_prop_a fails the schema parse and never reaches the draft; the DATA message never names it', async () => {
    const s = await directorSetup({ content: withAdultProps() })
    const hostile = { reply: reply({ options: [option('Add the prop', [['fx_prop_a', 1]])] }) }
    s.director.push(hostile, hostile)
    const before = await s.draft()
    const res = await s.turn('Could we add the synthetic prop?')
    expect(res.status).toBe(503)
    const body = await bodyOf(res)
    expect(body).toMatchObject({ error: 'ai_unavailable', repliesLeft: 20 })
    expect(allStrings(body).some((x) => x.includes('fx_prop_a'))).toBe(false)
    expect(allStrings(body).some((x) => x.includes('Synthetic prop A'))).toBe(false)

    const dataMessage = s.director.calls[0].messages.find((m) => m.role === 'user')
    expect(dataMessage?.content ?? '').not.toContain('fx_prop_a')
    expect(dataMessage?.content ?? '').not.toContain('Synthetic prop A')

    // The rejection is a fixed phrase, never the offending id.
    const retryContent = s.director.calls[1].messages.at(-1)?.content ?? ''
    expect(retryContent).toContain('is not an allowed item id')
    expect(retryContent).not.toContain('fx_prop_a')

    expect(await s.draft()).toEqual(before)
  })
})

describe('AI Director + adult content: every switch on, inside this test process only', () => {
  it('adult items are still absent from the per-request enum, because DIRECTOR_SLOTS_V1 has no adult-gated slot', async () => {
    const s = await directorSetup({ content: withAdultProps(), env: { ADULT_CATALOG_ENABLED: 'true' } })
    await testEnv.DB.batch([
      testEnv.DB.prepare('UPDATE creator SET adult_content_enabled = 1 WHERE id = ?').bind(s.creatorId),
      testEnv.DB.prepare(
        `INSERT INTO compliance_status (creator_id, identity_verified, age_verified, records_complete, payouts_enabled, adult_catalog_approved, updated_at)
         VALUES (?, 1, 1, 1, 1, 1, ?)`,
      ).bind(s.creatorId, new Date().toISOString()),
    ])
    s.director.push({ reply: reply({ clarifyingQuestion: 'Would you like the vintage or floral setting?' }) })
    const res = await s.turn('Could we make the greeting more special?')
    expect(res.status).toBe(200)

    const sent = s.director.calls[0]
    const enumIds: string[] = (sent.schema as any).properties.options.items.properties.wants.items.properties.itemId.enum
    // Only the general items the fan screens already show: no adult item snuck in.
    expect([...enumIds].sort()).toEqual([
      'maya_extra_minute',
      'maya_greeting_detailed',
      'maya_greeting_standard',
      'maya_setting_backstage',
      'maya_setting_floral',
      'maya_setting_vintage',
    ])
    expect(enumIds).not.toContain('fx_prop_a')

    const dataMessage = sent.messages.find((m) => m.role === 'user')
    expect(dataMessage?.content ?? '').not.toContain('fx_prop_a')
    expect(dataMessage?.content ?? '').not.toContain('Synthetic prop A')
  })
})

describe('buildOption: the adult gate, unit-level (shared/domain/director.ts)', () => {
  const content = withAdultProps()
  const PROP_SLOTS = [...DIRECTOR_SLOTS_V1, 'props']

  function start(): Selection[] {
    const picks = new Map(defaultSelections(content, off).map((s) => [s.itemId, s.qty]))
    for (const id of ['maya_setting_vintage', 'maya_setting_floral', 'maya_setting_backstage']) picks.delete(id)
    picks.set('maya_setting_vintage', 1)
    return [...picks].map(([itemId, qty]) => ({ itemId, qty }))
  }

  const allowedOn = new Set(allowedItems(content, on, { slots: PROP_SLOTS }).map((e) => e.item.id))

  it('strips fx_prop_a when adult is allowed but nothing intimate was asked for, even alongside an ordinary change in the same option', () => {
    const r = buildOption(
      content,
      start(),
      {
        label: 'model label',
        wants: [
          { itemId: 'maya_greeting_detailed', qty: 1 },
          { itemId: 'fx_prop_a', qty: 1 },
        ],
        removes: [],
      },
      on,
      { allowed: allowedOn, intimate: false },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.selections.some((s) => s.itemId === 'fx_prop_a')).toBe(false)
      expect(r.value.strippedAdult).toEqual(['fx_prop_a'])
      // The ordinary, non-adult change still goes through.
      expect(r.value.adds.map((a) => a.itemId)).toContain('maya_greeting_detailed')
    }
  })

  it('keeps fx_prop_a once the fan asked for something intimate', () => {
    const r = buildOption(content, start(), { label: 'model label', wants: [{ itemId: 'fx_prop_a', qty: 1 }], removes: [] }, on, {
      allowed: allowedOn,
      intimate: true,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.selections.some((s) => s.itemId === 'fx_prop_a')).toBe(true)
      expect(r.value.strippedAdult).toEqual([])
    }
  })

  it('never offers fx_prop_a at all while the adult gate is off, whatever the model asks for and whatever "intimate" says', () => {
    const allowedOff = new Set(allowedItems(content, off, { slots: PROP_SLOTS }).map((e) => e.item.id))
    expect(allowedOff.has('fx_prop_a')).toBe(false)
    const r = buildOption(content, start(), { label: 'model label', wants: [{ itemId: 'fx_prop_a', qty: 1 }], removes: [] }, off, {
      allowed: allowedOff,
      intimate: true,
    })
    expect(r).toEqual({ ok: false, error: { code: 'unknown_item', itemId: 'fx_prop_a' } })
  })
})
