import { Icon } from '../common/Icon'
import { useCommission } from '../../state/commission'

/* -------------------------------------------------------------------------- */
/*  Design 20 A / 24 A: the creator's own words on how they price a commission */
/*  (doc 11 §5.7). Plain text, at most 400 characters, line breaks kept, no    */
/*  links or formatting rendered. Omitted entirely — no empty heading — when   */
/*  the creator hasn't written one.                                           */
/* -------------------------------------------------------------------------- */

export function PricingNote() {
  const { view } = useCommission()
  const note = view.content.pricingNote

  if (!note) return null

  return (
    <div className="flex items-start gap-3 rounded-card border border-divider bg-secondary p-5">
      <Icon icon="lucide:message-square-quote" width={20} className="mt-0.5 shrink-0 text-rose-deep" />
      <div>
        <p className="mb-1 text-sm font-semibold">Why {view.creatorName} prices it this way</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">&ldquo;{note}&rdquo;</p>
        <p className="mt-2 text-xs text-muted">In {view.creatorName}&rsquo;s own words.</p>
      </div>
    </div>
  )
}
