import { useState } from 'react'
import { creatorApi } from '../../api/client'
import { Button } from '../../components/common/Button'
import { Icon } from '../../components/common/Icon'
import { Modal } from '../../components/common/Modal'
import { creatorCopy as copy } from '../../copy/creatorRequests'
import { MESSAGE_MAX } from '../../../../shared/domain/commission.ts'
import { useRequestContext } from './requestContext'

/**
 * Design 09 on real data: declining a request. The reason is shown to the fan;
 * the private note goes to the audit record only and never reaches them
 * (doc 11 §5.6 item 26). Both are optional, and both are capped like any
 * message.
 */
export function CreatorDeclineModal() {
  const { view, busy, act, closeToRequest, closeToQueue } = useRequestContext()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  // Reached by URL after the request was already decided: the server would
  // refuse this, so the confirmation isn't offered either.
  const allowed = view.commission.actions.includes('decline')

  async function decline() {
    if (await act(() => creatorApi.decline(view.commission.id, reason.trim() || null, note.trim() || null), copy.declinedJustNow)) {
      closeToRequest()
    }
  }

  return (
    <Modal onClose={closeToRequest} size="sm" labelledBy="creator-decline-heading">
      <div className="p-8 sm:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-alert/10 text-alert">
          <Icon icon="lucide:alert-triangle" width={24} />
        </div>

        <h2 id="creator-decline-heading" className="mb-3 font-serif text-3xl font-semibold leading-tight text-espresso">
          {allowed ? copy.declineHeading : copy.status(view.commission.status)}
        </h2>
        <p className="mb-6 text-base leading-relaxed text-muted">{allowed ? copy.declineIntro : copy.notOpenNow}</p>

        <div className="mb-6 rounded-xl border border-divider bg-cream p-4">
          <p className="text-sm font-semibold text-espresso">{copy.reference(view.commission.id)}</p>
          <p className="text-xs text-muted">
            {view.versions[0]?.terms.fanDisplayName ?? copy.fanNameMissing} · {copy.fanNameUnverified}
          </p>
        </div>

        {allowed && (
          <>
            <div className="mb-6">
              <label htmlFor="decline-reason" className="mb-2 block text-sm font-medium text-espresso">
                {copy.declineReasonLabel}
              </label>
              <textarea
                id="decline-reason"
                rows={3}
                maxLength={MESSAGE_MAX}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full resize-none rounded-xl border border-divider bg-panel p-4 text-sm transition-colors duration-160 focus:border-espresso focus:outline-none focus-ring"
              />
            </div>

            <div className="mb-8">
              <label htmlFor="decline-note" className="mb-2 block text-sm font-medium text-espresso">
                {copy.declineNoteLabel}
              </label>
              <textarea
                id="decline-note"
                rows={3}
                maxLength={MESSAGE_MAX}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full resize-none rounded-xl border border-divider bg-panel p-4 text-sm transition-colors duration-160 focus:border-espresso focus:outline-none focus-ring"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-divider pt-6 sm:flex-row">
              <Button variant="secondary" type="button" icon="lucide:arrow-left" className="order-2 flex-1 sm:order-1" onClick={closeToRequest}>
                {copy.declineCancel}
              </Button>
              <Button
                variant="destructive"
                type="button"
                icon="lucide:x-circle"
                className="order-1 flex-1 sm:order-2"
                disabled={busy}
                onClick={() => void decline()}
              >
                {copy.declineConfirm}
              </Button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={closeToQueue}
          className="mt-4 min-h-[44px] w-full text-sm text-muted underline transition-colors duration-160 hover:text-espresso focus-ring"
        >
          {copy.backToQueue}
        </button>
      </div>
    </Modal>
  )
}
