import { money } from '../../domain/sceneCard'
import { cn } from '../../lib/cn'
import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 18, state C: the creator republished the catalog with different    */
/*  prices after this Scene Card was quoted. The fan sees old and new lines   */
/*  side by side and must accept before sending (doc 11 rule: never silently  */
/*  re-priced).                                                               */
/*                                                                              */
/*  The design's own example only shows the "exactly at budget" wording       */
/*  ("Exactly at your $150 budget."). The under/over variants below follow    */
/*  the same sentence shape as SuggestionCard's budget line, but are NEW      */
/*  wording pending owner approval — the design never shows a changed         */
/*  estimate landing off-budget.                                              */
/* -------------------------------------------------------------------------- */

type Row = { label: string; beforeCents: number | null; nowCents: number | null }

type Props = {
  creatorName: string
  rows: Row[]
  beforeTotalCents: number
  nowTotalCents: number
  budgetDifferenceCents: number | null
  onAccept: () => void
  onChange: () => void
  busy: boolean
}

function cell(cents: number | null): string {
  return cents === null ? '—' : money(cents)
}

export function PriceChangeNotice({
  creatorName,
  rows,
  beforeTotalCents,
  nowTotalCents,
  budgetDifferenceCents,
  onAccept,
  onChange,
  busy,
}: Props) {
  // The budget itself isn't passed separately — it's implied by the new total
  // plus the difference from it (same relationship SuggestionCard uses).
  const budgetCents = budgetDifferenceCents === null ? null : nowTotalCents + budgetDifferenceCents

  return (
    <div className="rounded-card border border-divider bg-panel p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pendbg">
          <Icon icon="lucide:tag" width={20} className="text-pendink" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {creatorName} updated prices
          </h2>
          <p className="text-sm text-muted">Your Scene Card uses the new prices only if you accept them.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-divider">
        <table className="w-full text-sm">
          <caption className="sr-only">Old and new prices for your Scene Card</caption>
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">
                Item
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Before
              </th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">
                Now
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {rows.map((row, i) => {
              const changed = row.beforeCents !== row.nowCents
              return (
                <tr key={i} className={changed ? 'bg-pendbg/60' : undefined}>
                  <td className="px-4 py-3">
                    {changed ? (
                      <>
                        <span className="font-medium">{row.label}</span>
                        <span className="ml-1 rounded border border-pendborder bg-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-pendink">
                          Changed
                        </span>
                      </>
                    ) : (
                      row.label
                    )}
                  </td>
                  <td className={cn('px-3 py-3 text-right text-muted', changed && 'line-through')}>
                    {cell(row.beforeCents)}
                  </td>
                  <td className={cn('px-4 py-3 text-right', changed && 'font-semibold')}>{cell(row.nowCents)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-divider">
            <tr>
              <th scope="row" className="px-4 py-3 text-left font-semibold">
                Estimated total
              </th>
              <td className="px-3 py-3 text-right text-muted line-through">{money(beforeTotalCents)}</td>
              <td className="px-4 py-3 text-right font-serif text-xl font-bold">{money(nowTotalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {budgetCents !== null && budgetDifferenceCents !== null && (
        <p className="mt-2 text-xs text-muted">
          {budgetDifferenceCents === 0
            ? `Exactly at your ${money(budgetCents)} budget.`
            : budgetDifferenceCents > 0
              ? `${money(budgetDifferenceCents)} under your budget.`
              : `${money(Math.abs(budgetDifferenceCents))} over your budget.`}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="inline-flex min-h-[48px] items-center justify-center rounded-card bg-espresso px-6 text-base font-medium text-cream shadow-md transition-colors duration-160 hover:bg-black focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Accept new estimate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onChange}
          className="inline-flex min-h-[48px] items-center justify-center rounded-card border border-divider px-6 text-base font-medium transition-colors duration-160 hover:bg-secondary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Change my choices
        </button>
      </div>
    </div>
  )
}
