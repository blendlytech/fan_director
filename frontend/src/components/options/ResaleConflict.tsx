import { useState } from 'react'
import { Icon } from '../common/Icon'
import { personalParts, resaleResolutions } from '../../domain/options'
import { money } from '../../domain/sceneCard'
import { useCommission } from '../../state/commission'
import type { DraftSyncValue } from '../../state/draftSync'
import { ScriptDiscardDialog } from './ScriptDiscardDialog'

/* -------------------------------------------------------------------------- */
/*  Design 24 D: the server rejected a save because the draft says the fan's   */
/*  name or uses their script while resale is also selected                   */
/*  (personalised_video_resale_forbidden). The normal UI can't build this      */
/*  combination itself, so it only shows up after an edit elsewhere, an old    */
/*  saved draft, or a template. The page never picks a resolution for the      */
/*  fan — it always asks.                                                     */
/* -------------------------------------------------------------------------- */

export function ResaleConflict({ sync }: { sync: DraftSyncValue }) {
  const { view, draft, commit } = useCommission()
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  if (sync.rejection?.error !== 'personalised_video_resale_forbidden') return null

  const { name, script } = personalParts(view, draft)
  const both = name && script
  const { keep, remove } = resaleResolutions(view, draft)

  const saysWhat = both ? 'says your name and uses your script' : script ? 'uses your script' : 'says your name'
  const keepLabel = both ? 'Keep my name and script' : script ? 'Keep my script' : 'Keep my name'
  const removeLabel = both ? 'Remove my name and script' : script ? 'Remove my script' : 'Remove my name'

  function applyRemove() {
    if (script && draft.fanScript?.trim()) {
      setConfirmDiscard(true)
      return
    }
    commit(remove.changes)
  }

  return (
    <div role="alert" className="rounded-card border border-limitask-border bg-limitask-bg p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Icon icon="lucide:git-compare-arrows" width={20} className="mt-0.5 shrink-0 text-limitask-ink" />
        <div className="text-sm leading-relaxed text-espresso">
          <p className="mb-1 font-semibold">Pick one: your name, or resale</p>
          <p className="mb-4">
            This video {saysWhat}, so {view.creatorName} can&rsquo;t sell it to anyone else. Nothing was changed
            and nothing was sent.
          </p>
          <div className="space-y-2">
            {keep && (
              <button
                type="button"
                onClick={() => commit(keep.changes)}
                className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-card border border-divider bg-panel px-4 text-left text-sm transition-colors duration-160 hover:border-espresso focus-ring"
              >
                <span>
                  <span className="font-medium">{keepLabel}</span>
                  <span className="block text-xs text-muted">Only you get the video</span>
                </span>
                <span className="shrink-0 font-medium">{keep.total !== null ? money(keep.total) : ''}</span>
              </button>
            )}
            <button
              type="button"
              onClick={applyRemove}
              className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-card border border-divider bg-panel px-4 text-left text-sm transition-colors duration-160 hover:border-espresso focus-ring"
            >
              <span>
                <span className="font-medium">{removeLabel}</span>
                <span className="block text-xs text-muted">{view.creatorName} may resell it later</span>
              </span>
              <span className="shrink-0 text-muted">{remove.total !== null ? money(remove.total) : ''}</span>
            </button>
          </div>
        </div>
      </div>
      {confirmDiscard && (
        <ScriptDiscardDialog
          view={view}
          draft={draft}
          onKeep={() => setConfirmDiscard(false)}
          onDelete={() => {
            commit(remove.changes)
            setConfirmDiscard(false)
          }}
        />
      )}
    </div>
  )
}
