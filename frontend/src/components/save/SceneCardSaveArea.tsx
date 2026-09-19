import { useState } from 'react'
import { SignInButton } from '@clerk/react'
import { useCommission } from '../../state/commission'
import type { DraftSyncValue } from '../../state/draftSync'
import { ChangedElsewhereNotice } from './ChangedElsewhereNotice'
import { PriceChangeNotice } from './PriceChangeNotice'
import { SaveStatus } from './SaveStatus'

/**
 * The Scene Card header in staging (design 18): the save status (A), the
 * "changed somewhere else" notice (B) and the price-change notice (C). Every
 * state here reflects what the server said; nothing claims a save it didn't do.
 */
export function SceneCardSaveArea({ sync, onChangeChoices }: { sync: DraftSyncValue; onChangeChoices: () => void }) {
  const { view } = useCommission()
  const [accepting, setAccepting] = useState(false)
  const status =
    sync.status === 'signed_out' ? 'signed_out' : sync.status === 'loading' || sync.status === 'idle' ? 'idle' : sync.status
  const change = sync.priceChange

  const rows = change ? priceRows(change.before.lines, change.now.lines) : []

  return (
    <div className="mb-4 space-y-4">
      <SaveStatus
        status={status}
        savedAt={sync.savedAt}
        onRetry={sync.retry}
        signInSlot={
          <SignInButton mode="modal">
            <button type="button" className="inline-flex min-h-[44px] items-center underline underline-offset-4 focus-ring">
              Sign in to save
            </button>
          </SignInButton>
        }
      />
      {sync.changedElsewhere && <ChangedElsewhereNotice onDismiss={sync.dismissChangedElsewhere} />}
      {change && (
        <PriceChangeNotice
          creatorName={view.creatorName}
          rows={rows}
          beforeTotalCents={change.before.total}
          nowTotalCents={change.now.total}
          budgetDifferenceCents={change.now.budgetDifference}
          busy={accepting}
          onAccept={async () => {
            setAccepting(true)
            await sync.acceptPriceChange()
            setAccepting(false)
          }}
          onChange={onChangeChoices}
        />
      )}
    </div>
  )
}

type Line = { itemId: string; label: string; amount: number }

/** Before/now rows by item, in the "now" order, then items that are gone. */
function priceRows(before: Line[], now: Line[]): { label: string; beforeCents: number | null; nowCents: number | null }[] {
  const was = new Map(before.map((l) => [l.itemId, l]))
  const rows: { label: string; beforeCents: number | null; nowCents: number | null }[] = now
    .filter((l) => l.amount !== 0 || (was.get(l.itemId)?.amount ?? 0) !== 0)
    .map((l) => ({ label: l.label, beforeCents: was.get(l.itemId)?.amount ?? null, nowCents: l.amount }))
  for (const l of before) {
    if (!now.some((n) => n.itemId === l.itemId) && l.amount !== 0) rows.push({ label: l.label, beforeCents: l.amount, nowCents: null })
  }
  return rows
}
