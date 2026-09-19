import type { SuggestionOutcomeKind } from '../../api/types'
import { money } from '../../domain/sceneCard'
import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 17, state C: once the fan chooses, a suggestion card collapses to   */
/*  one of these three one-line rows. Only the "accepted" row carries          */
/*  role="status" in the design; the other two rows have no explicit role      */
/*  there, so none is added here.                                             */
/* -------------------------------------------------------------------------- */

type Props = {
  kind: SuggestionOutcomeKind
  title: string
  totalCents?: number
  onUndo?: () => void
}

export function SuggestionOutcome({ kind, title, totalCents, onUndo }: Props) {
  if (kind === 'accepted') {
    return (
      <div role="status" className="flex items-center gap-3 rounded-card border border-okborder bg-okbg px-4 py-1 text-sm">
        <Icon icon="lucide:circle-check" width={18} className="shrink-0 text-okink" />
        <span className="flex-1 py-2">
          <span className="font-medium">{title}</span> added. Your estimate is now {money(totalCents ?? 0)}.
        </span>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 font-medium underline underline-offset-4 focus-ring"
          >
            <Icon icon="lucide:undo-2" width={14} />
            Undo
          </button>
        )}
      </div>
    )
  }

  if (kind === 'declined') {
    return (
      <div className="flex items-center gap-3 rounded-card border border-divider bg-secondary px-4 py-3 text-sm text-muted">
        <Icon icon="lucide:circle-minus" width={18} className="shrink-0" />
        <span>
          <span className="font-medium">{title}</span> not added.
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-card border border-pendborder bg-pendbg px-4 py-3 text-sm">
      <Icon icon="lucide:history" width={18} className="mt-0.5 shrink-0 text-pendink" />
      <span className="flex-1">
        <span className="font-medium">This suggestion is out of date.</span> Your Scene Card changed after the
        Director wrote it. Ask again for fresh ideas.
      </span>
    </div>
  )
}
