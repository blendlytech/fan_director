/* -------------------------------------------------------------------------- */
/*  No design exists for this state yet. Layout follows the 17 B suggestion   */
/*  card (docs/designs/html/17-ai-director-live-states.html state B); the     */
/*  "Custom request" eyebrow, quoted fan text and offer sentence are wording  */
/*  from director-copy-v1, pending owner approval.                            */
/* -------------------------------------------------------------------------- */

type Props = {
  text: string
  offer: string
  accept: string
  decline: string
  onAccept: () => void
  onDecline: () => void
  busy: boolean
}

export function CustomRequestOffer({ text, offer, accept, decline, onAccept, onDecline, busy }: Props) {
  return (
    <div className="rounded-card border border-divider bg-panel p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Custom request</p>
      <blockquote className="mb-3 border-l-2 border-divider pl-3 text-sm italic leading-relaxed text-espresso">
        &ldquo;{text}&rdquo;
      </blockquote>
      <p className="mb-4 text-sm leading-relaxed">{offer}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="min-h-[44px] flex-1 rounded-card bg-rose px-3 text-sm font-medium shadow-sm transition-colors duration-160 hover:bg-rose-hover focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {accept}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="min-h-[44px] rounded-card border border-divider px-3 text-sm font-medium transition-colors duration-160 hover:bg-secondary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {decline}
        </button>
      </div>
    </div>
  )
}
