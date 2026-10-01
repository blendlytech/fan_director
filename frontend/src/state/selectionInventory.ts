import { useMemo } from 'react'
import { buildSelectionInventory, type SceneCardSnapshot, type SelectionInventory } from '../../../shared/domain/selectionInventory.ts'
import { capabilities } from '../config'
import { BUDGET, minutesOf, settingOf } from '../domain/sceneCard'
import type { CommissionValue } from './commission'
import { useCommission } from './commission'
import { useOptionalLookbook } from './lookbook'

/** The Scene Card as plain data. Every amount is the quote's; the total is the lines' sum. */
export function sceneCardSnapshot(commission: Pick<CommissionValue, 'view' | 'draft' | 'lineItems' | 'total' | 'deliveryDays'>): SceneCardSnapshot {
  const { view, draft, lineItems, total, deliveryDays } = commission
  const setting = settingOf(view, draft)
  return {
    catalogVersionId: view.versionId,
    settingKey: setting.id,
    settingLabel: setting.name,
    sceneTitle: setting.sceneTitle,
    minutes: minutesOf(view, draft),
    lineItems: lineItems.map((line) => ({ label: line.label, detail: line.detail, amountCents: line.amount })),
    totalCents: total,
    budgetCents: BUDGET,
    deliveryDays,
    notes: draft.notes.map((note) => note.text),
    fanDisplayName: draft.fanDisplayName ?? null,
    customRequest: draft.customRequest ?? null,
  }
}

/**
 * The fan's whole request as `SelectionInventory` (shared/domain/
 * selectionInventory.ts), for AI playback. Null where no lookbook is mounted
 * (staging's fan journey, for now). Use inside the fan journey's providers.
 */
export function useSelectionInventory(): SelectionInventory | null {
  const lookbook = useOptionalLookbook()
  const commission = useCommission()
  return useMemo(() => {
    if (!lookbook) return null
    return buildSelectionInventory({
      source: capabilities.serverCatalog ? 'staging' : 'demo',
      profile: lookbook.profile,
      choices: lookbook.choices,
      adultAllowed: lookbook.adultAllowed,
      boundaries: commission.view.boundaries,
      sceneCard: sceneCardSnapshot(commission),
    })
  }, [lookbook, commission])
}
