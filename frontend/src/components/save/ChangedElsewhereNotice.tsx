import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 18, state B: another window (or tab) saved a newer revision of     */
/*  this Scene Card, so the latest version was loaded here instead of         */
/*  overwriting it. The design's "See what changed" button leads to an       */
/*  undrawn list of changes — it is intentionally NOT rendered here; only     */
/*  Dismiss is wired up, per the component contract.                          */
/* -------------------------------------------------------------------------- */

export function ChangedElsewhereNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-pendborder bg-pendbg p-5">
      <Icon icon="lucide:refresh-cw" width={20} className="mt-0.5 shrink-0 text-pendink" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">This Scene Card was changed somewhere else</p>
        <p className="mb-3">
          We&rsquo;ve loaded the latest version, so nothing gets overwritten. Your last change here wasn&rsquo;t
          applied.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-[44px] items-center px-2 font-medium underline underline-offset-4 focus-ring"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
