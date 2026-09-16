import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { Modal } from '../components/common/Modal'
import { SceneImage } from '../components/common/SceneImage'
import { cn } from '../lib/cn'
import { getRequestById, type Request } from '../data/requests'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * The creator's full review of one request: left column is the fan's Scene Card detail
 * (reference image, components, itemized pricing, timeline); right column is the decision
 * controls (Approve, Propose Changes, Ask a Question, Decline).
 *
 * Nested under /creator/requests/:id — renders its own <Outlet /> so the Ask Question and
 * Decline routes can layer their own modals on top of this one.
 */
export function CreatorDetailModal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const request = getRequestById(id)

  useEffect(() => {
    if (!request) navigate('/creator/requests', { replace: true })
  }, [request, navigate])

  if (!request) return null

  const closeToQueue = () => navigate('/creator/requests')
  const detail = request.detail
  const fanFirstName = detail?.fanFullName.split(' ')[0]

  return (
    <>
      <Modal onClose={closeToQueue} size="lg" labelledBy="detail-heading">
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* LEFT COLUMN: Scene Card Summary */}
          <div className="w-full border-b border-divider p-8 lg:w-[60%] lg:border-b-0 lg:border-r lg:p-12">
            <div className="mb-6 flex items-center gap-3">
              {request.avatarImageUrl ? (
                <img
                  src={request.avatarImageUrl}
                  alt={request.avatarAlt ?? ''}
                  className="h-10 w-10 rounded-full border border-divider bg-cream"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-divider bg-cream text-sm font-medium text-espresso">
                  {request.avatarInitials}
                </div>
              )}
              <div>
                <p className="mb-0.5 text-xs uppercase tracking-wider text-muted">Request from</p>
                <p className="text-sm font-medium text-espresso">
                  {detail ? (
                    <>
                      {detail.fanFullName}{' '}
                      <span className="font-normal text-muted">({request.fanHandle})</span>
                    </>
                  ) : (
                    request.fanHandle
                  )}
                </p>
              </div>
            </div>

            <h2 id="detail-heading" className="mb-8 font-serif text-4xl font-semibold leading-tight text-espresso">
              {request.title}
            </h2>

            {detail && (
              <div className="mb-10">
                <div className="relative mb-3 aspect-video overflow-hidden rounded-card border border-divider">
                  <SceneImage src={detail.referenceImageUrl} alt={detail.referenceImageAlt} />
                  <div className="absolute left-3 top-3 rounded-full border border-divider bg-panel/90 px-3 py-1.5 backdrop-blur-md">
                    <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
                      Style Reference
                    </span>
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Icon icon="lucide:info" width={14} />
                  Reference imagery, not a preview of your final order.
                </p>
              </div>
            )}

            {detail && (
              <div className="mb-10">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                  Scene Components
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {detail.sceneComponents.map((component) => (
                    <div key={component.label} className="rounded-xl border border-divider bg-cream/50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Icon icon={component.icon} width={18} className="text-rose" />
                        <span className="text-sm font-medium">{component.label}</span>
                      </div>
                      <p className="text-sm text-muted">{component.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-divider bg-cream p-6 md:p-8">
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted">
                Estimate &amp; Delivery
              </h3>

              {detail ? (
                <>
                  <div className="mb-6 space-y-3">
                    {detail.lineItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted">{item.label}</span>
                        <span>{currency.format(item.amount)}</span>
                      </div>
                    ))}
                    <div className="mt-3 flex items-center justify-between border-t border-divider pt-3">
                      <span className="font-medium">{request.totalLabel}</span>
                      <span className="text-lg font-semibold">{currency.format(detail.estimatedTotal)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-divider pt-6 sm:flex-row">
                    <div className="flex flex-1 items-start gap-3 rounded-lg border border-divider bg-panel p-3">
                      <Icon icon="lucide:wallet" width={18} className="mt-0.5 text-rose" />
                      <div>
                        <p className="mb-0.5 text-xs font-medium">Budget Remaining</p>
                        <p className="text-xs text-muted">{detail.budgetRemaining}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 items-start gap-3 rounded-lg border border-divider bg-panel p-3">
                      <Icon icon="lucide:calendar-clock" width={18} className="mt-0.5 text-rose" />
                      <div>
                        <p className="mb-0.5 text-xs font-medium">Delivery Timeline</p>
                        <p className="text-xs text-muted">{detail.deliveryTimeline}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{request.totalLabel}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{currency.format(request.total)}</span>
                      {request.previousTotal !== undefined && (
                        <span className="text-xs text-muted line-through">
                          {currency.format(request.previousTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                  {request.deliveryLabel && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">{request.deliveryLabel}</span>
                      <span className="font-medium">{request.deliveryValue}</span>
                    </div>
                  )}
                  {request.unresolvedCount !== undefined && (
                    <div className="flex items-center gap-2 rounded-lg border border-divider bg-panel p-3 text-xs text-muted">
                      <Icon icon="lucide:message-circle-question" width={16} className="text-rose" />
                      {request.unresolvedCount} unresolved question{request.unresolvedCount === 1 ? '' : 's'}
                    </div>
                  )}
                  <p className="pt-3 text-xs leading-relaxed text-muted">
                    Full scene-component and itemized pricing details aren&rsquo;t on file for this request in this
                    demo — showing the summary from the request queue instead.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Decision Controls */}
          <div className="flex w-full flex-col bg-panel p-8 lg:w-[40%] lg:p-12">
            <div className="mb-10 flex-1">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
                <Icon icon="lucide:quote" width={16} />
                {detail ? `Notes from ${fanFirstName}` : 'Request Summary'}
              </h3>
              <div className="rounded-xl border border-divider bg-cream/40 p-6">
                <p className={cn('text-sm leading-relaxed text-espresso', detail && 'italic')}>
                  {detail ? detail.fanNotes : request.description}
                </p>
              </div>
            </div>

            <RequestDecisionPanel key={request.id} request={request} closeToQueue={closeToQueue} />
          </div>
        </div>
      </Modal>

      <Outlet />
    </>
  )
}

/**
 * Holds the Approve / Propose Changes / Decline decision state for one request. Keyed by
 * request.id in the parent so that React Router's reuse of the CreatorDetailModal instance
 * across /creator/requests/:id navigations doesn't leak one request's in-progress decision
 * (approved, proposalSent, the draft new total/message) into the next request viewed.
 */
function RequestDecisionPanel({ request, closeToQueue }: { request: Request; closeToQueue: () => void }) {
  const [approved, setApproved] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [proposalSent, setProposalSent] = useState(false)
  const [newTotal, setNewTotal] = useState(() => currency.format(request.total))
  const [proposalMessage, setProposalMessage] = useState('')

  return (
    <div className="space-y-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Creator Decision</h3>

      {approved ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
            <Icon icon="lucide:check-circle-2" width={18} />
            Marked as approved
          </div>
          <p className="text-xs leading-relaxed text-muted">
            This is a demo: no payment has been charged and {request.fanHandle} has not actually been
            notified. In the full product, approving sends the fan a payment request and production begins
            once they pay.
          </p>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={closeToQueue}>
            Back to Queue
          </Button>
        </div>
      ) : proposalSent ? (
        <div className="rounded-xl border border-divider bg-cream p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-deep">
            <Icon icon="lucide:check-circle-2" width={18} />
            Proposal drafted
          </div>
          <p className="text-xs leading-relaxed text-muted">
            This is a demo: the new total of {newTotal || currency.format(request.total)} and your message
            were not actually sent to {request.fanHandle}. In the full product, proposing changes asks the
            fan to approve the new estimate before production begins.
          </p>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={closeToQueue}>
            Back to Queue
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="primary"
            icon="lucide:check-circle-2"
            className="w-full"
            onClick={() => setApproved(true)}
          >
            Approve Commission
          </Button>

          {!proposeOpen ? (
            <button
              type="button"
              onClick={() => setProposeOpen(true)}
              className="flex h-[48px] w-full select-none items-center justify-center gap-2 rounded-card border border-divider bg-cream font-medium text-espresso transition-all duration-160 hover:border-espresso hover:bg-cream/80 focus-ring"
            >
              <Icon icon="lucide:pen-tool" width={18} />
              Propose Changes
            </button>
          ) : (
            <div className="mt-2 animate-slide-up rounded-xl border border-divider bg-cream p-5">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Icon icon="lucide:arrow-right-left" width={16} className="text-rose" />
                Adjust Estimate
              </h4>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="mb-1 block text-xs text-muted">Original Total</span>
                  <div className="rounded-lg border border-divider bg-panel p-2 text-sm text-muted line-through">
                    {currency.format(request.total)}
                  </div>
                </div>
                <div>
                  <label htmlFor="new-total" className="mb-1 block text-xs font-medium text-espresso">
                    New Total
                  </label>
                  <input
                    id="new-total"
                    type="text"
                    inputMode="decimal"
                    value={newTotal}
                    onChange={(event) => setNewTotal(event.target.value)}
                    className="w-full rounded-lg border border-espresso bg-panel p-2 text-sm text-espresso focus:outline-none focus:ring-1 focus:ring-rose focus-ring"
                  />
                </div>
              </div>
              <label htmlFor="proposal-message" className="mb-1 block text-xs font-medium text-espresso">
                Message to Fan
              </label>
              <textarea
                id="proposal-message"
                rows={2}
                value={proposalMessage}
                onChange={(event) => setProposalMessage(event.target.value)}
                placeholder="Explain the changes..."
                className="mb-4 w-full resize-none rounded-lg border border-divider bg-panel p-3 text-sm focus:border-espresso focus:outline-none focus-ring"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setProposeOpen(false)}
                  className="h-[40px] flex-1 rounded-lg border border-divider bg-panel text-sm font-medium text-espresso transition-colors duration-160 hover:bg-cream focus-ring"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newTotal.trim() || !proposalMessage.trim()}
                  onClick={() => setProposalSent(true)}
                  className="h-[40px] flex-1 rounded-lg bg-espresso text-sm font-medium text-cream transition-colors duration-160 hover:bg-espresso/90 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send Proposal
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button variant="secondary" size="sm" icon="lucide:message-circle-question" to={`/creator/requests/${request.id}/ask`}>
              Ask Question
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon="lucide:x-circle"
              to={`/creator/requests/${request.id}/decline`}
              className="text-alert hover:bg-alert/10"
            >
              Decline
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
