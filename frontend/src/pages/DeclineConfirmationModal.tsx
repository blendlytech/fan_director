import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { Modal } from '../components/common/Modal'
import { getRequestById } from '../data/requests'

/**
 * A protective confirmation modal before declining a request, layered on top of
 * CreatorDetailModal. Nested under /creator/requests/:id/decline; Cancel and a successful
 * confirmation both close back toward the dashboard.
 */
export function DeclineConfirmationModal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const request = getRequestById(id)

  const [note, setNote] = useState('')
  const [declined, setDeclined] = useState(false)

  useEffect(() => {
    if (!request) navigate('/creator/requests', { replace: true })
  }, [request, navigate])

  if (!request) return null

  const closeToDetail = () => navigate(`/creator/requests/${request.id}`)
  const fanName = request.detail?.fanFullName ?? request.fanHandle

  return (
    <Modal onClose={closeToDetail} size="sm" labelledBy="decline-heading">
      <div className="p-8 sm:p-10">
        {declined ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-alert/10 text-alert">
              <Icon icon="lucide:x-circle" width={24} />
            </div>
            <h2 id="decline-heading" className="mb-3 font-serif text-2xl font-semibold text-espresso">
              Request declined
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-muted">
              This is a demo: {fanName} has not actually been notified and no data has been changed. In the full
              product, declining notifies the fan and removes this request from your active queue.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => navigate('/creator/requests')}>
              Back to Queue
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-alert/10 text-alert">
              <Icon icon="lucide:alert-triangle" width={24} />
            </div>

            <h2 id="decline-heading" className="mb-3 font-serif text-3xl font-semibold leading-tight text-espresso">
              Decline this request?
            </h2>

            <p className="mb-6 text-base leading-relaxed text-muted">
              This fan will be notified that the request cannot be fulfilled at this time. They can always submit a
              new request later.
            </p>

            <div className="mb-6 flex items-center gap-4 rounded-xl border border-divider bg-cream p-4">
              {request.avatarImageUrl ? (
                <img
                  src={request.avatarImageUrl}
                  alt={request.avatarAlt ?? ''}
                  className="h-10 w-10 shrink-0 rounded-full border border-divider bg-panel"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-panel text-sm font-medium text-espresso">
                  {request.avatarInitials}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-espresso">{request.title}</p>
                <p className="text-xs text-muted">{request.fanHandle}</p>
              </div>
            </div>

            <div className="mb-8">
              <label htmlFor="decline-reason" className="mb-2 block text-sm font-medium text-espresso">
                Internal Note <span className="font-normal text-muted">(optional, not shown to fan)</span>
              </label>
              <textarea
                id="decline-reason"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="E.g., Schedule too tight this week..."
                className="w-full resize-none rounded-xl border border-divider bg-panel p-4 text-sm transition-colors duration-160 focus:border-espresso focus:outline-none focus:ring-1 focus:ring-espresso"
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-divider pt-6 sm:flex-row">
              <Button
                variant="secondary"
                type="button"
                icon="lucide:arrow-left"
                className="order-2 flex-1 sm:order-1"
                onClick={closeToDetail}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                icon="lucide:x-circle"
                className="order-1 flex-1 sm:order-2"
                onClick={() => setDeclined(true)}
              >
                Confirm Decline
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
