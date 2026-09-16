import { useCallback, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { CommissionContext, type CommissionValue } from './commission'
import { BUDGET, buildLineItems, sumOf, type Draft } from '../domain/sceneCard'
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
/*  This is in-memory only. Nothing is persisted; nothing is sent anywhere.    */
/* -------------------------------------------------------------------------- */

export function CommissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(commissionReducer, INITIAL_STATE)

  const commit = useCallback(
    (changes: Partial<Draft>) => dispatch({ type: 'commit', changes }),
    [],
  )
  const addNote = useCallback((text: string) => dispatch({ type: 'note', text }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  const value = useMemo<CommissionValue>(() => {
    const lineItems = buildLineItems(state.draft)
    const total = sumOf(lineItems)
    const difference = BUDGET - total
    return {
      draft: state.draft,
      lineItems,
      total,
      difference,
      overBudget: difference < 0,
      canUndo: state.history.length > 0,
      commit,
      addNote,
      undo,
      reset,
    }
  }, [state.draft, state.history.length, commit, addNote, undo, reset])

  return <CommissionContext.Provider value={value}>{children}</CommissionContext.Provider>
}
