import { useId } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 18, states A1–A4: the Scene Card's save status, which always sits  */
/*  next to the "Draft" pill and only ever says "Saved" once the server has   */
/*  confirmed it (doc 11 rule 1). The design draws the pill with a rose dot   */
/*  for A1–A3 (saving/saved/failed) and, for A4 (signed out), a plain grey    */
/*  pill with no dot at all — that's reproduced verbatim below rather than    */
/*  the "grey dot" a literal reading of the contract prose might suggest.     */
/*                                                                              */
/*  'idle' isn't one of the drawn states; it's used before the fan has made   */
/*  a change worth saving. It reuses the same rose "Draft" pill with no       */
/*  right-hand status, per the contract.                                      */
/* -------------------------------------------------------------------------- */

export type SaveStatusValue = 'saving' | 'saved' | 'failed' | 'signed_out' | 'idle'

type Props = {
  status: SaveStatusValue
  savedAt: Date | null
  onRetry: () => void
  signInSlot?: ReactNode
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function DraftPill({ signedOut }: { signedOut: boolean }) {
  if (signedOut) {
    return (
      <span className="inline-flex items-center rounded-full border border-divider bg-panel px-2.5 py-1 text-xs font-medium text-muted">
        Draft
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-rose bg-panel px-2.5 py-1 text-xs font-medium">
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
      Draft
    </span>
  )
}

export function SaveStatus({ status, savedAt, onRetry, signInSlot }: Props) {
  const timeId = useId()

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <DraftPill signedOut={status === 'signed_out'} />

      {status === 'saving' && (
        <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Icon icon="lucide:loader" width={14} className="motion-safe:animate-spin" />
          Saving&hellip;
        </span>
      )}

      {status === 'saved' && (
        <span
          role="status"
          tabIndex={0}
          aria-describedby={savedAt ? timeId : undefined}
          title={savedAt ? `Saved at ${formatTime(savedAt)}` : undefined}
          className="inline-flex items-center gap-1.5 text-xs text-okink focus-ring"
        >
          <Icon icon="lucide:cloud-check" width={14} />
          Saved to your account
          {savedAt && (
            <span id={timeId} className="sr-only">
              Saved at {formatTime(savedAt)}
            </span>
          )}
        </span>
      )}

      {status === 'failed' && (
        <span role="alert" className="inline-flex items-center gap-2 text-xs text-alertink">
          <Icon icon="lucide:cloud-off" width={14} />
          Not saved
          <button type="button" onClick={onRetry} className="min-h-[44px] px-1 font-medium underline underline-offset-4 focus-ring">
            Try again
          </button>
        </span>
      )}

      {status === 'signed_out' && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Icon icon="lucide:user-round-x" width={14} />
          {signInSlot ?? (
            <a href="#sign-in" className="inline-flex min-h-[44px] items-center underline underline-offset-4 focus-ring">
              Sign in to save
            </a>
          )}
        </span>
      )}
    </div>
  )
}
