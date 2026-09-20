import { Icon } from '../common/Icon'
import { videoNotice } from '../../domain/options'
import { useCommission } from '../../state/commission'

/* -------------------------------------------------------------------------- */
/*  Design 20 C / C2: whether this video is only for the fan or may be resold */
/*  later. Shown wherever the total is shown (Scene Card and Review), and     */
/*  never collapsed. Null when the draft has no rights choice yet.            */
/* -------------------------------------------------------------------------- */

export function VideoNotice() {
  const { view, draft } = useCommission()
  const notice = videoNotice(view, draft)

  if (notice === null) return null

  if (notice === 'exclusive') {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted">
        <Icon icon="lucide:lock" width={14} className="mt-0.5 shrink-0" />
        Only you get this video. {view.creatorName} won&rsquo;t sell it to anyone else.
      </p>
    )
  }

  return (
    <p className="flex items-start gap-2 rounded-lg border border-limitask-border bg-limitask-bg px-3 py-2 text-xs text-limitask-ink">
      <Icon icon="lucide:store" width={14} className="mt-0.5 shrink-0" />
      {view.creatorName} may sell this video to other fans later. Choose &ldquo;Just for you&rdquo; to keep it
      private.
    </p>
  )
}
