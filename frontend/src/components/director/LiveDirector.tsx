import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { SignInButton } from '@clerk/react'
import { PILOT_BOUTIQUE_NAME } from '../../../../shared/catalog/pilot-v1.ts'
import { api } from '../../api/client'
import type { DirectorSuggestion } from '../../api/types'
import { useSignedIn } from '../../auth/session'
import { Button } from '../common/Button'
import { BUDGET, changeChoice, extraMinutesIn, greetingOf, selectionsOf, settingOf, type GreetingId } from '../../domain/sceneCard'
import { useCommission } from '../../state/commission'
import { directorReducer, INITIAL_DIRECTOR } from '../../state/directorReducer'
import { useDraftSync } from '../../state/draftSync'
import { CatalogSheet } from './CatalogSheet'
import { CustomRequestOffer } from './CustomRequestOffer'
import { DirectorUnavailable } from './DirectorUnavailable'
import { LimitNotice } from './LimitNotice'
import { MessageBlocked } from './MessageBlocked'
import { RepliesCounter } from './RepliesCounter'
import { RepliesExhausted } from './RepliesExhausted'
import { SuggestionCard } from './SuggestionCard'
import { SuggestionOutcome } from './SuggestionOutcome'
import { ThinkingIndicator } from './ThinkingIndicator'
import { Turn } from './Turn'

/* -------------------------------------------------------------------------- */
/*  The live AI Director (design 17, design 13 C1–C3), staging only.           */
/*                                                                            */
/*  Every sentence and price here comes from the server: the Director's reply  */
/*  was written from fixed templates, and every amount is the server's quote.  */
/*  A suggestion changes nothing until the fan adds it; on any failure the     */
/*  Scene Card is untouched and the catalog stays one tap away (17 D, 17 F).   */
/* -------------------------------------------------------------------------- */

const MAX_MESSAGE = 2_000

/** The page owns whether the catalog (17 F) is open, so the Scene Card's Edit links can open it too. */
export function LiveDirector({ catalogOpen, setCatalogOpen }: { catalogOpen: boolean; setCatalogOpen: (open: boolean) => void }) {
  const { view, draft, commit, undo } = useCommission()
  const sync = useDraftSync()
  const signedIn = useSignedIn()
  const [state, dispatch] = useReducer(directorReducer, INITIAL_DIRECTOR)
  const [message, setMessage] = useState('')
  const threadEndRef = useRef<HTMLDivElement>(null)
  const draftId = sync?.server?.draftId ?? null

  // Load the thread once the draft is known.
  useEffect(() => {
    if (!draftId) return
    let cancelled = false
    void api.director(draftId).then((res) => {
      if (cancelled) return
      if (res.ok) dispatch({ type: 'loaded', thread: res.body })
      else dispatch({ type: 'unavailable' })
    })
    return () => {
      cancelled = true
    }
  }, [draftId])

  const scrollToEnd = () =>
    window.requestAnimationFrame(() => threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !sync || state.phase !== 'ready') return
      dispatch({ type: 'send', message: trimmed })
      scrollToEnd()
      // The Director plans from the saved draft, so save what's on screen first.
      let ref = await sync.flush()
      if (!ref) return dispatch({ type: 'unavailable' })
      let res = await api.directorTurn(ref.draftId, crypto.randomUUID(), ref.revision, trimmed)
      if (!res.ok && res.error === 'revision_conflict') {
        ref = await sync.flush()
        if (ref) res = await api.directorTurn(ref.draftId, crypto.randomUUID(), ref.revision, trimmed)
      }
      if (res.ok) {
        dispatch({ type: 'replied', message: trimmed, reply: res.body })
        setMessage('')
        scrollToEnd()
        return
      }
      if (res.error === 'hard_list_blocked') {
        return dispatch({ type: 'blocked', lines: Array.isArray(res.body.lines) ? (res.body.lines as string[]) : [] })
      }
      if (res.error === 'ai_replies_exhausted') return dispatch({ type: 'exhausted' })
      dispatch({ type: 'unavailable', repliesLeft: typeof res.body.repliesLeft === 'number' ? res.body.repliesLeft : undefined })
    },
    [sync, state.phase],
  )

  async function accept(suggestion: DirectorSuggestion) {
    if (!sync) return
    dispatch({ type: 'busy', id: suggestion.id })
    const ref = await sync.flush()
    if (!ref) return dispatch({ type: 'busy', id: null })
    const res = await api.acceptSuggestion(ref.draftId, suggestion.id, ref.revision)
    if (res.ok) {
      // One undoable step, already saved by the server.
      sync.adopt(res.body, { asUndoableChange: true })
      return dispatch({ type: 'outcome', suggestionId: suggestion.id, outcome: { kind: 'accepted', totalCents: res.body.quote?.total } })
    }
    if (res.error === 'suggestion_out_of_date') {
      return dispatch({ type: 'outcome', suggestionId: suggestion.id, outcome: { kind: 'out_of_date' } })
    }
    dispatch({ type: 'busy', id: null })
  }

  async function decline(suggestion: DirectorSuggestion) {
    if (!draftId) return
    dispatch({ type: 'busy', id: suggestion.id })
    const res = await api.declineSuggestion(draftId, suggestion.id)
    if (res.ok) dispatch({ type: 'outcome', suggestionId: suggestion.id, outcome: { kind: 'declined' } })
    else dispatch({ type: 'busy', id: null })
  }

  function openCatalog() {
    setCatalogOpen(true)
  }

  const setting = settingOf(view, draft)
  const greeting = greetingOf(view, draft)
  const extraMinutes = extraMinutesIn(view, draft)
  const pick = (choice: { setting?: string; greeting?: GreetingId; extraMinutes?: number }) => {
    const changes = changeChoice(view, draft, choice)
    const before = JSON.stringify(selectionsOf(view, draft).map((s) => [s.itemId, s.qty]).sort())
    const after = JSON.stringify((changes.selections ?? []).map((s) => [s.itemId, s.qty]).sort())
    if (before !== after) commit(changes)
  }

  const composerDisabled = signedIn !== true || state.phase !== 'ready' || !draftId
  const placeholder =
    state.phase === 'thinking' ? 'Wait for the Director to reply…' : 'Tell the Director what you have in mind or ask for suggestions...'

  return (
    <>
      <div className="mb-8 flex-1 space-y-8">
        {signedIn === false && (
          // NEW wording (no design yet): pending the owner's approval at the UI checkpoint.
          <Turn speaker="director">
            <p className="text-sm leading-relaxed sm:text-base">
              Sign in to plan with the Director. You can still build your Scene Card from {view.creatorName}’s catalog.
            </p>
            <div className="flex flex-wrap gap-3">
              <SignInButton mode="modal">
                <Button type="button" variant="primary" size="sm">Sign in</Button>
              </SignInButton>
              <Button type="button" variant="secondary" size="sm" onClick={openCatalog}>Choose from the catalog</Button>
            </div>
          </Turn>
        )}

        {state.turns.map((turn) => (
          <div key={turn.requestId} className="space-y-8">
            <Turn speaker="fan">
              <p className="whitespace-pre-wrap text-sm leading-relaxed sm:text-base">{turn.fanMessage}</p>
            </Turn>
            <Turn speaker="director">
              {turn.response.reply && <p className="text-sm leading-relaxed sm:text-base">{turn.response.reply}</p>}
              {turn.response.clarifyingQuestion && (
                <p className="text-sm leading-relaxed sm:text-base">{turn.response.clarifyingQuestion}</p>
              )}
              {turn.response.notOffered.map((n, i) => (
                <LimitNotice key={i} heading={n.heading} body={n.body} />
              ))}
              {turn.response.suggestions.map((s) => {
                const outcome = turn.outcomes[s.id]
                return outcome ? (
                  <SuggestionOutcome
                    key={s.id}
                    kind={outcome.kind}
                    title={s.title}
                    totalCents={outcome.totalCents}
                    onUndo={outcome.kind === 'accepted' ? undo : undefined}
                  />
                ) : (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    creatorName={view.creatorName}
                    budgetSet={BUDGET !== null}
                    busy={state.busy === s.id}
                    onAccept={() => void accept(s)}
                    onDecline={() => void decline(s)}
                  />
                )
              })}
              {turn.response.customRequest && turn.customRequest === 'offered' && (
                <CustomRequestOffer
                  {...turn.response.customRequest}
                  busy={false}
                  onAccept={() => {
                    commit({ customRequest: turn.response.customRequest!.text })
                    dispatch({ type: 'customRequest', requestId: turn.requestId, state: 'added' })
                  }}
                  onDecline={() => dispatch({ type: 'customRequest', requestId: turn.requestId, state: 'dismissed' })}
                />
              )}
              {turn.response.footer && <p className="text-xs text-muted">{turn.response.footer}</p>}
            </Turn>
          </div>
        ))}

        {state.pending && (
          <Turn speaker="fan">
            <p className="whitespace-pre-wrap text-sm leading-relaxed sm:text-base">{state.pending}</p>
          </Turn>
        )}
        {state.phase === 'thinking' && <ThinkingIndicator />}
        {state.phase === 'unavailable' && (
          <DirectorUnavailable onCatalog={openCatalog} onRetry={() => dispatch({ type: 'ready' })} />
        )}
        {state.phase === 'exhausted' && <RepliesExhausted onCatalog={openCatalog} />}

        <CatalogSheet
          open={catalogOpen}
          onClose={() => setCatalogOpen(false)}
          creatorName={view.creatorName}
          settings={view.settings.map((s) => ({ id: s.id, name: s.name, priceCents: s.price }))}
          settingId={setting.id}
          greetings={[
            { id: 'standard', name: 'Standard greeting', priceCents: 0 },
            { id: 'detailed', name: 'Detailed greeting', priceCents: greetingPrice(view.content, view.itemIds.greetingDetailed) },
          ]}
          greetingId={greeting}
          extraMinutes={extraMinutes}
          maxExtraMinutes={view.maxExtraMinutes}
          perExtraMinuteCents={view.perExtraMinute}
          onSetting={(id) => pick({ setting: id })}
          onGreeting={(id) => pick({ greeting: id as GreetingId })}
          onExtraMinutes={(n) => pick({ extraMinutes: n })}
        />

        <div ref={threadEndRef} />
      </div>

      <div className="sticky bottom-28 z-30 bg-cream pt-2 lg:bottom-4 lg:pt-4">
        {state.blockedLines && (
          <div className="mb-3">
            <MessageBlocked boutiqueName={PILOT_BOUTIQUE_NAME} creatorName={view.creatorName} lines={state.blockedLines} />
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send(message)
          }}
          className="overflow-hidden rounded-card border border-divider bg-panel shadow-subtle transition-shadow focus-within:border-espresso"
        >
          <label htmlFor="director-composer" className="sr-only">
            Message to the Director
          </label>
          <textarea
            id="director-composer"
            value={message}
            maxLength={MAX_MESSAGE}
            disabled={composerDisabled}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] w-full resize-none border-0 bg-transparent p-4 text-sm text-espresso placeholder:text-muted focus:outline-none disabled:cursor-not-allowed sm:p-5 sm:text-base"
          />
          <div className="flex items-center justify-between gap-2 border-t border-divider bg-secondary px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              {state.repliesLeft !== null && <RepliesCounter left={state.repliesLeft} />}
            </div>
            <Button type="submit" variant="primary" size="sm" icon="lucide:send" disabled={composerDisabled || message.trim() === ''}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

function greetingPrice(content: import('../../../../shared/domain/types.ts').CatalogContent, itemId: string): number {
  for (const c of content.categories) {
    const item = c.items.find((i) => i.id === itemId)
    if (item) return item.pricing.kind === 'fixed' ? item.pricing.amount : 0
  }
  return 0
}
