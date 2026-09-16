import { INITIAL_DRAFT, type Draft } from '../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  The fan journey's draft and its undo history, as one pure reducer.         */
/*                                                                            */
/*  Draft and history move together through a single transition, so a change  */
/*  and the history entry that records it can never fall out of step. (A       */
/*  nested setState inside an updater double-pushed history under StrictMode.) */
/*  Kept out of CommissionContext.tsx so it can be tested without React.       */
/* -------------------------------------------------------------------------- */

export type CommissionState = {
  draft: Draft
  /** Previous drafts, oldest first. The last entry is what undo restores. */
  history: Draft[]
}

export type CommissionAction =
  | { type: 'commit'; changes: Partial<Draft> }
  | { type: 'note'; text: string }
  | { type: 'undo' }
  | { type: 'reset' }

export const INITIAL_STATE: CommissionState = { draft: INITIAL_DRAFT, history: [] }

export function commissionReducer(
  state: CommissionState,
  action: CommissionAction,
): CommissionState {
  switch (action.type) {
    case 'commit': {
      // Re-selecting what is already chosen is not a change: recording it would
      // leave an undo step that visibly does nothing.
      const changed = (Object.keys(action.changes) as (keyof Draft)[]).some(
        (key) => !Object.is(action.changes[key], state.draft[key]),
      )
      if (!changed) return state
      return {
        draft: { ...state.draft, ...action.changes },
        history: [...state.history, state.draft],
      }
    }
    case 'note': {
      const text = action.text.trim()
      if (!text) return state
      // Ids only need to be unique within the list (they key React rows), and
      // must not depend on the clock: two notes in one millisecond would collide.
      const id = Math.max(0, ...state.draft.notes.map((note) => note.id)) + 1
      return {
        draft: {
          ...state.draft,
          notes: [...state.draft.notes, { id, text }],
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
