import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import type { Quote } from '../../../shared/domain/types.ts'
import { capabilities } from '../config'
import { CommissionContext, type CommissionValue } from './commission'
import { CREATOR_ID, useCatalog } from './catalog'
import { BUDGET, buildLineItems, localQuote, selectionsOf, type Draft } from '../domain/sceneCard'
import { INITIAL_STATE, commissionReducer } from './commissionReducer'

/* -------------------------------------------------------------------------- */
/*  Shared state for the fan journey.                                          */
/*                                                                            */
/*  Deliberately a context and not a store library: the fan journey needs one  */
/*  draft that survives Director → Review → Confirmation and the "Back to      */
/*  Edit" trip back again. Router state would lose the draft on a refresh or   */
/*  a direct visit to /review, and would not survive the backwards leg.        */
/*                                                                            */
/*  Draft and undo history move together through one reducer — see             */
/*  commissionReducer.ts.                                                      */
/*                                                                            */
/*  This is in-memory only. Nothing is persisted; nothing is sent anywhere,   */
/*  except, in staging, the choices themselves to the quote endpoint, which   */
/*  prices them and stores nothing.                                           */
/* -------------------------------------------------------------------------- */

export function CommissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(commissionReducer, INITIAL_STATE)
  const { view } = useCatalog()

  const commit = useCallback(
    (changes: Partial<Draft>) => dispatch({ type: 'commit', changes }),
    [],
  )
  const addNote = useCallback((text: string) => dispatch({ type: 'note', text }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  const selections = useMemo(() => selectionsOf(view, state.draft), [view, state.draft])
  const key = `${view.versionId}|${JSON.stringify(selections)}`
  const local = useMemo(() => localQuote(view, state.draft), [view, state.draft])
  const serverQuote = useServerQuote(view.versionId, selections, key)
  // The server's figures are authoritative in staging (doc 11 §3 rule 3); the
  // shared module's identical preview shows until they arrive.
  const quote = serverQuote ?? local

  const value = useMemo<CommissionValue>(() => {
    const lineItems = buildLineItems(view, state.draft, quote)
    const total = quote.total
    const difference = BUDGET - total
    return {
      view,
      draft: state.draft,
      lineItems,
      total,
      difference,
      overBudget: difference < 0,
      deliveryDays: quote.deliveryDaysFromPayment,
      canUndo: state.history.length > 0,
      commit,
      addNote,
      undo,
      reset,
    }
  }, [view, quote, state.draft, state.history.length, commit, addNote, undo, reset])

  return <CommissionContext.Provider value={value}>{children}</CommissionContext.Provider>
}

/**
 * Staging only: asks the server to price the current choices. A response for
 * choices that have since changed is dropped, and an in-flight request is
 * aborted when they change, so an older answer never replaces a newer one.
 */
function useServerQuote(versionId: string, selections: unknown, key: string): Quote | null {
  const [answer, setAnswer] = useState<{ key: string; quote: Quote } | null>(null)

  useEffect(() => {
    if (!capabilities.serverCatalog) return
    const controller = new AbortController()
    fetch(`/api/creators/${CREATOR_ID}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catalogVersionId: versionId, selections, budget: BUDGET }),
      signal: controller.signal,
      credentials: 'omit',
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`quote ${res.status}`))))
      .then((body: { quote?: Quote }) => {
        if (body.quote && Number.isInteger(body.quote.total)) setAnswer({ key, quote: body.quote })
      })
      .catch(() => {
        // Keep the local preview; a failure state needs design 18 first.
      })
    return () => controller.abort()
  }, [key, versionId, selections])

  return answer && answer.key === key ? answer.quote : null
}
