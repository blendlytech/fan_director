import { useEffect, useRef } from 'react'
import { Modal } from '../common/Modal'
import { scriptItem } from '../../domain/options'
import { money, type CatalogView, type Draft } from '../../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  Design 24 C2: confirms discarding the fan's own script text. Reused        */
/*  wherever a change would drop it — removing the script option (design 20   */
/*  D / 24 C1), switching templates (design 20 A), or a resale conflict's      */
/*  "remove" resolution that also drops the script (design 24 D).             */
/*                                                                            */
/*  Focus starts on "Keep script" and Escape keeps it. Modal.tsx focuses the  */
/*  dialog's first focusable element (its own close button) on mount, so the  */
/*  explicit focus below runs on the next frame to win that race.             */
/* -------------------------------------------------------------------------- */

type Props = {
  view: CatalogView
  draft: Draft
  onKeep: () => void
  onDelete: () => void
}

export function ScriptDiscardDialog({ view, draft, onKeep, onDelete }: Props) {
  const keepRef = useRef<HTMLButtonElement>(null)
  const item = scriptItem(view)
  const priceLabel = item && item.pricing.kind === 'fixed' ? money(item.pricing.amount) : null
  const chars = draft.fanScript?.length ?? 0

  useEffect(() => {
    const frame = requestAnimationFrame(() => keepRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <Modal onClose={onKeep} size="sm" labelledBy="script-discard-heading">
      <div className="p-6 sm:p-8">
        <h2 id="script-discard-heading" className="mb-2 font-serif text-2xl font-semibold tracking-tight">
          Remove your script?
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-muted">
          What you&rsquo;ve written ({chars} character{chars === 1 ? '' : 's'}) will be deleted
          {priceLabel ? <>, and {priceLabel} comes off your total</> : null}. This can&rsquo;t be undone.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex min-h-[44px] items-center justify-center rounded-card border border-alertborder bg-panel px-5 text-sm font-medium text-alertink transition-colors duration-160 hover:bg-alertbg focus-ring"
          >
            Delete script
          </button>
          <button
            type="button"
            ref={keepRef}
            onClick={onKeep}
            className="inline-flex min-h-[44px] items-center justify-center rounded-card bg-espresso px-5 text-sm font-medium text-cream transition-colors duration-160 hover:bg-black focus-ring"
          >
            Keep script
          </button>
        </div>
      </div>
    </Modal>
  )
}
