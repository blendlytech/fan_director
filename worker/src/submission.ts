import { effectiveLimits } from '../../shared/domain/boundaries.ts'
import { quote } from '../../shared/domain/quote.ts'
import { validateSelections } from '../../shared/domain/validate.ts'
import type { BoundaryFlag, CatalogContent, GateOptions, Quote } from '../../shared/domain/types.ts'
import { screenDraft } from './screening'
import type { DraftContent } from './types'

/**
 * Why a draft can't be submitted. Each reason is typed so the Phase 4 UI can
 * say which part to change; nothing is ever fixed on the fan's behalf.
 */
export type SubmissionProblem =
  | { code: 'catalog_version_stale'; currentCatalogVersionId: string }
  | { code: 'selection_invalid'; reason: string }
  | { code: 'hard_list'; key: string }
  | { code: 'hard_no'; limitKey: string; field: BoundaryFlag['source'] }
  | { code: 'custom_requests_not_accepted' }
  | { code: 'name_required' }
  | { code: 'script_required' }
  | { code: 'script_without_item' }

export type SubmissionCheck =
  | { ok: true; quote: Quote; flags: BoundaryFlag[] }
  | { ok: false; problems: SubmissionProblem[] }

export interface SubmissionContext {
  versionId: string
  /** The catalog's current published version; submitting on an older one isn't allowed. */
  currentVersionId: string | null
  content: CatalogContent
  gate: GateOptions
  verifiedPerformers: number
}

/**
 * Doc 11 §8 Phase 2 (Gate 0 decision 7): the checks a draft must pass before
 * it could be submitted. There is deliberately no submission endpoint until
 * Phase 4, so nothing calls this over HTTP yet.
 *
 * A hard-list hit or a hard-no limit rejects the draft. An ask-me limit is
 * accepted, with its flag, for the creator to decide.
 */
export function validateForSubmission(draft: DraftContent, ctx: SubmissionContext): SubmissionCheck {
  const problems: SubmissionProblem[] = []

  if (ctx.currentVersionId !== null && ctx.currentVersionId !== ctx.versionId) {
    problems.push({ code: 'catalog_version_stale', currentCatalogVersionId: ctx.currentVersionId })
  }

  const checked = validateSelections(ctx.content, draft.selections, ctx.gate)
  if (!checked.ok) problems.push({ code: 'selection_invalid', reason: checked.error.code })
  const traits = new Set(checked.ok ? checked.value.flatMap((r) => r.item.traits ?? []) : [])
  if (traits.has('uses_name') && !draft.fanDisplayName) problems.push({ code: 'name_required' })
  if (traits.has('uses_script') && !draft.fanScript) problems.push({ code: 'script_required' })
  if (!traits.has('uses_script') && draft.fanScript) problems.push({ code: 'script_without_item' })

  if (draft.customRequest && ctx.content.boundaries.customRequestPolicy === 'decline') {
    problems.push({ code: 'custom_requests_not_accepted' })
  }

  const screening = screenDraft(draft, effectiveLimits(ctx.content.boundaries, ctx.gate), ctx.verifiedPerformers)
  if (screening.hardList) problems.push({ code: 'hard_list', key: screening.hardList.hit.key })
  for (const hardNo of screening.hardNo) problems.push({ code: 'hard_no', limitKey: hardNo.limitKey, field: hardNo.source })

  if (problems.length > 0) return { ok: false, problems }
  const priced = quote(ctx.content, ctx.versionId, draft, ctx.gate)
  if (!priced.ok) return { ok: false, problems: [{ code: 'selection_invalid', reason: priced.error.code }] }
  return { ok: true, quote: priced.value, flags: screening.flags }
}
