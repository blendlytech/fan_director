import { useCallback, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { CommissionContext, type CommissionValue } from './commission'
import {
  BUDGET,
  INITIAL_DRAFT,
  buildLineItems,
  sumOf,
  type Draft,
} from '../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  Shared state for the fan journey.                                          */
/*                                                                            */
/*  Deliberately a context and not a store library: the fan journey needs one  */
/*  draft that survives Director → Review → Confirmation and the "Back to      */
/*  Edit" trip back again. Router state would lose the draft on a refresh or   */
/*  a direct visit to /review, and would not survive the backwards leg.        */
/*                                                                            */
/*  Draft and undo history move together through one reducer, so a change and  */
/*  the history entry that records it can never fall out of step.              */
/*                                                                            */
/*  This is in-memory only. Nothing is persisted; nothing is sent anywhere.    */
/* -------------------------------------------------------------------------- */

type CommissionState = {
  draft: Draft
  /** Previous drafts, oldest first. The last entry is what undo restores. */
  history: Draft[]
}

type Action =
  | { type: 'commit'; changes: Partial<Draft> }
  | { type: 'note'; text: string }
  | { type: 'undo' }
  | { type: 'reset' }

const INITIAL_STATE: CommissionState = { draft: INITIAL_DRAFT, history: [] }

function reducer(state: CommissionState, action: Action): CommissionState {
  switch (action.type) {
    case 'commit':
      return {
        draft: { ...state.draft, ...action.changes },
        history: [...state.history, state.draft],
      }
    case 'note': {
      const text = action.text.trim()
      if (!text) return state
      return {
        draft: {
          ...state.draft,
          notes: [...state.draft.notes, { id: Date.now(), text }],
        },
        history: [...state.history, state.draft],
      }
    }
    case 'undo': {
      if (state.history.length === 0) return state
      return {
        draft: state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
      }
    }
    case 'reset':
      return INITIAL_STATE
  }
}

export function CommissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

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
