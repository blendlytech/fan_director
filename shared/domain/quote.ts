import type { CatalogContent, Cents, GateOptions, PricedDraft, Quote, QuoteLine, Result } from './types.ts'
import { validateSelections, type ResolvedSelection } from './validate.ts'

/** Rounds `basis × basisPoints / 10000` to the nearest cent, half up, in integer arithmetic. */
export function percentOf(basis: Cents, basisPoints: number): Cents {
  return Math.floor((basis * basisPoints + 5_000) / 10_000)
}

function percentLabel(basisPoints: number): string {
  return `${Number((basisPoints / 100).toFixed(2))}%`
}

/**
 * Prices a draft against one catalog version (doc 11 §6, §5.7). The server's
 * result is the only price that counts; the browser may run this for an
 * instant preview but always shows the server's figures once they arrive.
 *
 * - Fixed and per-unit lines make the subtotal.
 * - Each percentage line is computed on that subtotal only, so percentages
 *   never compound, and each is rounded half up.
 * - The custom request is never priced and never part of the subtotal.
 */
export function quote(
  content: CatalogContent,
  catalogVersionId: string,
  draft: PricedDraft,
  opts: GateOptions,
): Result<Quote> {
  const checked = validateSelections(content, draft.selections, opts)
  if (!checked.ok) return checked
  const ordered = [...checked.value].sort(
    (a, b) => a.category.sortOrder - b.category.sortOrder || a.item.sortOrder - b.item.sortOrder,
  )

  const line = (r: ResolvedSelection, label: string, amount: Cents): QuoteLine => ({
    itemId: r.item.id,
    key: r.item.key,
    categoryKey: r.category.key,
    groupKey: r.item.groupKey ?? null,
    label,
    qty: r.qty,
    amount,
    pricingKind: r.item.pricing.kind,
  })

  let subtotal = 0
  const amounts = new Map<ResolvedSelection, Cents>()
  for (const r of ordered) {
    const p = r.item.pricing
    const amount = p.kind === 'fixed' ? p.amount : p.kind === 'per_unit' ? p.amountPerUnit * r.qty : 0
    amounts.set(r, amount)
    subtotal += amount
  }

  const lines = ordered.map((r) => {
    const p = r.item.pricing
    if (p.kind !== 'percent') return line(r, r.item.label, amounts.get(r)!)
    return line(r, `${r.item.label} (+${percentLabel(p.basisPoints)})`, percentOf(subtotal, p.basisPoints))
  })

  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const minutes = ordered.reduce((sum, r) => sum + (r.item.effects?.minutes ?? 0) * r.qty, 0)
  const days = ordered.reduce(
    (sum, r) => sum + (r.item.effects?.deliveryDaysDelta ?? 0) * r.qty,
    content.delivery.standardDaysFromPayment,
  )

  return {
    ok: true,
    value: {
      catalogVersionId,
      lines,
      total,
      budgetDifference: draft.budget === null ? null : draft.budget - total,
      minutes,
      deliveryDaysFromPayment: Math.max(1, days),
      customRequestPending: draft.customRequest !== null && draft.customRequest.trim() !== '',
    },
  }
}
