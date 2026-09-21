import { useState, type FormEvent } from 'react'
import { creatorApi } from '../../api/client'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { creatorCopy as copy } from '../../copy/creatorRequests'
import { currency } from '../../domain/sceneCard'
import { MESSAGE_MAX } from '../../../../shared/domain/commission.ts'
import { useRequestContext } from './requestContext'

/**
 * Design 06 on real data: the creator's question to the fan. Sending moves the
 * request to "waiting on the fan" on the server; this modal closes back to the
 * request only after the server returns that state.
 */
export function CreatorAskModal() {
  const { view, busy, act, closeToRequest } = useRequestContext()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const current = view.versions.find((v) => v.id === view.commission.currentVersionId)
  // Reached by URL after the request moved on: the server would refuse this,
  // so the form isn't offered either.
  const allowed = view.commission.actions.includes('ask')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = message.trim()
    if (!body) {
      setError('Write your question before sending.')
      return
    }
    setError(null)
    if (await act(() => creatorApi.ask(view.commission.id, body), copy.askSent)) closeToRequest()
  }

  return (
    <Modal onClose={closeToRequest} size="sm" labelledBy="creator-ask-heading">
      <div className="border-b border-divider px-8 pb-6 pr-16 pt-8">
        <h2 id="creator-ask-heading" className="font-serif text-3xl font-semibold text-espresso">
          {copy.askHeading}
        </h2>
      </div>

      <div className="p-8">
        <div className="mb-8 rounded-xl border border-divider bg-cream p-5">
          <p className="mb-1 text-xs uppercase tracking-wider text-muted">{copy.reference(view.commission.id)}</p>
          <p className="text-sm text-espresso">
            {view.versions[0]?.terms.fanDisplayName ?? copy.fanNameMissing}
            <span className="text-xs text-muted"> · {copy.fanNameUnverified}</span>
            {current && <> · {currency.format(current.terms.totalCents)}</>}
          </p>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-muted">{allowed ? copy.askIntro : copy.notOpenNow}</p>

        {allowed ? (
          <form onSubmit={(event) => void onSubmit(event)} noValidate>
            <label htmlFor="creator-question" className="mb-2 block text-sm font-medium text-espresso">
              {copy.askLabel}
            </label>
            <textarea
              id="creator-question"
              required
              rows={5}
              maxLength={MESSAGE_MAX}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value)
                if (error) setError(null)
              }}
              aria-describedby="creator-question-count"
              aria-invalid={error ? true : undefined}
              className="h-32 w-full resize-none rounded-xl border border-divider bg-panel p-4 text-sm text-espresso transition-all duration-160 focus:border-rose focus:outline-none focus-ring"
            />

            <div className="mb-2 mt-2 flex items-center justify-between gap-4">
              <span className="text-xs text-alert">{error}</span>
              <span id="creator-question-count" className="text-xs font-medium text-muted">
                {copy.charCount(message.length, MESSAGE_MAX)}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row">
              <Button variant="secondary" type="button" className="flex-1" onClick={closeToRequest}>
                {copy.proposeCancel}
              </Button>
              <Button variant="primary" type="submit" icon="lucide:send" className="flex-1" disabled={busy}>
                {copy.askSend}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" type="button" className="w-full" onClick={closeToRequest}>
            {copy.backToRequest}
          </Button>
        )}
      </div>
    </Modal>
  )
}
