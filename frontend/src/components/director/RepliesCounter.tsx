import { cn } from '../../lib/cn'

/* -------------------------------------------------------------------------- */
/*  Design 17: the replies-left line under the composer. State A shows it     */
/*  plain ("14 replies left for this Scene Card"); state E's footnote says    */
/*  that from 5 replies left it turns tan, e.g. "5 replies left". This        */
/*  component always renders the full "for this Scene Card" copy, singular    */
/*  or plural, and switches to text-pendink at the same threshold.            */
/* -------------------------------------------------------------------------- */

export function RepliesCounter({ left }: { left: number }) {
  const label = left === 1 ? '1 reply left for this Scene Card' : `${left} replies left for this Scene Card`
  return <span className={cn('text-xs', left <= 5 ? 'text-pendink' : 'text-muted')}>{label}</span>
}
