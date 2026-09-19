import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import { defaultSelections } from '../../shared/domain/ranges.ts'
import type { CatalogContent, Selection } from '../../shared/domain/types.ts'
import { validateForSubmission, type SubmissionContext } from '../src/submission'
import type { DraftContent } from '../src/types'

const gate = { adultAllowed: false }
/** Maya's catalog with brand mentions as "Ask me" and politics as "Hard no". */
const content: CatalogContent = {
  ...PILOT_V1,
  boundaries: { ...PILOT_V1.boundaries, checklist: { ...PILOT_V1.boundaries.checklist, no_brand_mentions: { enabled: true, mode: 'ask_me' } } },
}
const ctx: SubmissionContext = { versionId: 'v1', currentVersionId: 'v1', content, gate, verifiedPerformers: 0 }
const selections: Selection[] = [...defaultSelections(content, gate), { itemId: 'maya_setting_vintage', qty: 1 }]
const draft = (over: Partial<DraftContent> = {}): DraftContent => ({
  selections, fanDisplayName: null, customRequest: null, fanScript: null, notes: [], budget: null, ...over,
})
const swap = (from: string, to: string) => selections.map((s) => (s.itemId === from ? { itemId: to, qty: 1 } : s))

describe('validateForSubmission (no endpoint until Phase 4)', () => {
  it('accepts a plain draft with its quote', () => {
    const result = validateForSubmission(draft(), ctx)
    expect(result).toMatchObject({ ok: true, flags: [], quote: { total: 12_500 } })
  })

  it('rejects a draft with a hard-no request', () => {
    expect(validateForSubmission(draft({ customRequest: 'say who to vote for' }), ctx)).toEqual({
      ok: false, problems: [{ code: 'hard_no', limitKey: 'no_political_content', field: 'custom_request' }],
    })
  })

  it('accepts an ask-me request, with its flag for the creator', () => {
    expect(validateForSubmission(draft({ customRequest: 'hold a Starbucks cup' }), ctx)).toMatchObject({
      ok: true,
      flags: [{ source: 'custom_request', limit: { kind: 'checklist', key: 'no_brand_mentions' }, mode: 'ask_me' }],
    })
  })

  it('rejects a hard-list request', () => {
    expect(validateForSubmission(draft({ notes: [{ id: 1, text: 'invite another girl' }] }), ctx)).toEqual({
      ok: false, problems: [{ code: 'hard_list', key: 'unverified_performers' }],
    })
  })

  it('rejects a draft on a version that is no longer current', () => {
    const result = validateForSubmission(draft(), { ...ctx, currentVersionId: 'v2' })
    expect(result).toEqual({ ok: false, problems: [{ code: 'catalog_version_stale', currentCatalogVersionId: 'v2' }] })
  })

  it('needs the fan’s name for a name item, and a script for the script item', () => {
    const named = swap('maya_rights_resell', 'maya_rights_exclusive').map((s) => (s.itemId === 'maya_name_none' ? { itemId: 'maya_name_once', qty: 1 } : s))
    expect(validateForSubmission(draft({ selections: named }), ctx)).toEqual({ ok: false, problems: [{ code: 'name_required' }] })
    expect(validateForSubmission(draft({ selections: named, fanDisplayName: 'Sam' }), ctx).ok).toBe(true)

    const scripted = [...swap('maya_rights_resell', 'maya_rights_exclusive'), { itemId: 'maya_fan_script', qty: 1 }]
    expect(validateForSubmission(draft({ selections: scripted }), ctx)).toEqual({ ok: false, problems: [{ code: 'script_required' }] })
    expect(validateForSubmission(draft({ fanScript: 'Hi Sam, ...' }), ctx)).toEqual({ ok: false, problems: [{ code: 'script_without_item' }] })
  })

  it('reports an invalid selection by its typed reason', () => {
    expect(validateForSubmission(draft({ selections: swap('maya_name_none', 'maya_name_once') }), { ...ctx })).toMatchObject({
      ok: false, problems: [{ code: 'selection_invalid', reason: 'personalised_video_resale_forbidden' }],
    })
  })

  it('refuses a custom request when the creator declines them', () => {
    const declining = { ...ctx, content: { ...content, boundaries: { ...content.boundaries, customRequestPolicy: 'decline' as const } } }
    expect(validateForSubmission(draft({ customRequest: 'a red dress' }), declining)).toEqual({
      ok: false, problems: [{ code: 'custom_requests_not_accepted' }],
    })
  })
})
