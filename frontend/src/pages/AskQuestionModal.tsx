import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { Modal } from '../components/common/Modal'
import { getRequestById } from '../data/requests'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const MAX_LENGTH = 500

/**
 * Smaller form modal, layered on top of CreatorDetailModal, for sending the fan a clarifying
 * question. Nested under /creator/requests/:id/ask; closes back to /creator/requests/:id.
 */
export function AskQuestionModal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const request = getRequestById(id)

  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!request) navigate('/creator/requests', { replace: true })
  }, [request, navigate])

  if (!request) return null

  const closeToDetail = () => navigate(`/creator/requests/${request.id}`)
  const fanName = request.detail?.fanFullName ?? request.fanHandle

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) {
      setError('Please enter a message before sending.')
      return
    }
    setError(null)
    setSent(true)
  }

  return (
    <Modal onClose={closeToDetail} size="sm" labelledBy="ask-question-heading">
      <div className="border-b border-divider px-8 pb-6 pt-8 pr-16">
        <h2 id="ask-question-heading" className="font-serif text-3xl font-semibold text-espresso">
          Ask a Question
        </h2>
      </div>

      <div className="p-8">
        <div className="mb-8 flex items-start gap-4 rounded-xl border border-divider bg-cream p-5">
          {request.avatarImageUrl ? (
            <img
              src={request.avatarImageUrl}
              alt={request.avatarAlt ?? ''}
              className="mt-0.5 h-10 w-10 shrink-0 rounded-full border border-divider bg-panel"
            />
          ) : (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-panel text-sm font-medium text-espresso">
              {request.avatarInitials}
            </div>
          )}
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted">Regarding request</p>
            <p className="mb-1 text-base font-medium text-espresso">{request.title}</p>
            <p className="text-sm text-muted">
              From {fanName} ({request.fanHandle}) &middot; {request.totalLabel} {currency.format(request.total)}
            </p>
          </div>
        </div>

        {sent ? (
          <div className="rounded-xl border border-rose/40 bg-cream p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose/20 text-rose-deep">
              <Icon icon="lucide:check-circle-2" width={24} />
            </div>
            <h3 className="mb-2 font-serif text-xl font-semibold text-espresso">Message drafted</h3>
            <p className="mb-6 text-sm leading-relaxed text-muted">
              This is a demo: your question was not actually sent to {fanName}. In the full product, sending a
              question notifies the fan and pauses this request until they reply.
            </p>
            <Button variant="secondary" className="w-full" onClick={closeToDetail}>
              Back to Request
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-2">
              <label htmlFor="question-input" className="mb-2 block text-sm font-medium text-espresso">
                Message to Fan
              </label>
              <textarea
                id="question-input"
                required
                maxLength={MAX_LENGTH}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value)
                  if (error) setError(null)
                }}
                aria-describedby="question-char-count"
                aria-invalid={error ? true : undefined}
                placeholder="Ask your question about the request details, wardrobe, or script..."
                className="h-32 w-full resize-none rounded-xl border border-divider bg-panel p-4 text-sm text-espresso transition-all duration-160 placeholder:text-muted/60 focus:border-rose focus:outline-none focus:ring-1 focus:ring-rose"
              />
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-alert">{error}</span>
              <span id="question-char-count" className="text-xs font-medium text-muted">
                {message.length} / {MAX_LENGTH} characters
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row">
              <Button variant="secondary" type="button" className="flex-1" onClick={closeToDetail}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" icon="lucide:send" className="flex-1">
                Send Message
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
