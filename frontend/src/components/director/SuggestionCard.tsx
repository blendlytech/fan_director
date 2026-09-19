import type { DirectorSuggestion } from '../../api/types'
import { money } from '../../domain/sceneCard'
import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 17, state B (the suggestion card) and design 13, state C1 (the     */
/*  "ask first" note that replaces the plain buttons when a suggestion        */
/*  touches one of the creator's "ask me first" limits).                      */
/*                                                                              */
/*  Item-line rendering: the design always pairs a lucide:plus/minus icon      */
/*  with the plain label (e.g. "+[icon] Detailed greeting"), and only adds a   */
/*  "× {qty}" suffix when the design wants the count called out (its own      */
/*  "Extra minute × 1" example). This component follows that literal          */
/*  markup — icon conveys the +/−, and a "× {qty}" suffix is appended only    */
/*  when qty > 1 — rather than adding a redundant textual "+ "/"− " prefix    */
/*  on top of the icon.                                                        */
/* -------------------------------------------------------------------------- */

type Props = {
  suggestion: DirectorSuggestion
  creatorName: string
  budgetSet: boolean
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}

export function SuggestionCard({ suggestion, creatorName: _creatorName, budgetSet, busy, onAccept, onDecline }: Props) {
  const { title, adds, removes, deltaCents, newTotalCents, budgetDifferenceCents, askFirst } = suggestion
  const saving = deltaCents < 0

  return (
    <div className="rounded-card border border-divider bg-panel p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Suggestion</p>
      <h3 className="mb-2 font-serif text-2xl font-semibold leading-tight">{title}</h3>

      <ul className="mb-3 space-y-1 text-sm">
        {adds.map((add, i) => (
          <li key={`add-${i}`} className="flex items-start gap-2">
            <Icon icon="lucide:plus" width={16} className="mt-0.5 shrink-0 text-rose-deep" />
            {add.qty > 1 ? `${add.label} × ${add.qty}` : add.label}
          </li>
        ))}
        {removes.map((remove, i) => (
          <li key={`remove-${i}`} className="flex items-start gap-2 text-muted">
            <Icon icon="lucide:minus" width={16} className="mt-0.5 shrink-0" />
            {remove.label}
          </li>
        ))}
      </ul>

      <div className="mb-4 rounded-[10px] bg-secondary px-3 py-2 text-sm">
        <div className="flex justify-between">
          {/* NEW wording pending owner approval: the design only shows "Adds" —
              "Saves" for a suggestion that reduces the total isn't drawn anywhere. */}
          <span className="text-muted">{saving ? 'Saves' : 'Adds'}</span>
          <span className="font-medium">{money(saving ? -deltaCents : deltaCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">New estimate</span>
          <span className="font-semibold">{money(newTotalCents)}</span>
        </div>
        {budgetSet && budgetDifferenceCents !== null && (
          <p className={budgetDifferenceCents > 0 ? 'mt-1 text-xs text-okink' : budgetDifferenceCents < 0 ? 'mt-1 text-xs text-pendink' : 'mt-1 text-xs text-muted'}>
            {budgetDifferenceCents === 0
              ? 'Exactly at your budget'
              : budgetDifferenceCents > 0
                ? `${money(budgetDifferenceCents)} under your budget`
                : `${money(Math.abs(budgetDifferenceCents))} over your budget`}
          </p>
        )}
      </div>

      {askFirst.length > 0 ? (
        <>
          {askFirst.map((notice, i) => (
            <div
              key={i}
              role="note"
              className="mb-4 flex items-start gap-3 rounded-card border border-limitask-border bg-limitask-bg p-4"
            >
              <Icon icon="lucide:message-circle-question" width={20} className="mt-0.5 shrink-0 text-limitask-ink" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">{notice.heading}</p>
                <p>{notice.body}</p>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-card bg-rose px-6 text-base font-medium shadow-sm transition-colors duration-160 hover:bg-rose-hover focus-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {askFirst[0].accept}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDecline}
              className="inline-flex min-h-[48px] items-center justify-center rounded-card border border-divider px-6 text-base font-medium transition-colors duration-160 hover:bg-secondary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {askFirst[0].decline}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">{askFirst[0].footnote}</p>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="min-h-[44px] flex-1 rounded-card bg-rose px-3 text-sm font-medium shadow-sm transition-colors duration-160 hover:bg-rose-hover focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to Scene Card
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="min-h-[44px] rounded-card border border-divider px-3 text-sm font-medium transition-colors duration-160 hover:bg-secondary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            No thanks
          </button>
        </div>
      )}
    </div>
  )
}
