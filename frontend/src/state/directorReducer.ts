import type { DirectorReply, DirectorThread, SuggestionOutcomeKind } from '../api/types'

/* -------------------------------------------------------------------------- */
/*  The live AI Director's conversation (design 17), as one pure reducer.      */
/*  The draft itself lives in the commission reducer; this only tracks the     */
/*  thread, what the fan did with each suggestion, and the Director's state.   */
/* -------------------------------------------------------------------------- */

export interface Outcome {
  kind: SuggestionOutcomeKind
  /** For "added": the estimate right after adding it, from the server. */
  totalCents?: number
}

export interface TurnEntry {
  requestId: string
  fanMessage: string
  response: DirectorReply
  outcomes: Record<string, Outcome>
  customRequest: 'offered' | 'added' | 'dismissed'
}

export type DirectorPhase =
  | 'loading' // reading the thread
  | 'ready' // the fan can send
  | 'thinking' // 17 A: one message at a time
  | 'unavailable' // 17 D: error, timeout or AI turned off
  | 'exhausted' // 17 E: all 20 replies used

export interface DirectorState {
  phase: DirectorPhase
  turns: TurnEntry[]
  /** The message being answered (shown as the fan's bubble while thinking). */
  pending: string | null
  repliesLeft: number | null
  /** 13 C3: the last message broke a platform rule. The composer keeps the fan's words. */
  blockedLines: string[] | null
  /** The suggestion (or custom request) being accepted or declined right now. */
  busy: string | null
}

export type DirectorAction =
  | { type: 'loaded'; thread: DirectorThread }
  | { type: 'send'; message: string }
  | { type: 'replied'; message: string; reply: DirectorReply }
  | { type: 'unavailable'; repliesLeft?: number }
  | { type: 'exhausted' }
  | { type: 'blocked'; lines: string[] }
  | { type: 'ready' }
  | { type: 'busy'; id: string | null }
  | { type: 'outcome'; suggestionId: string; outcome: Outcome }
  | { type: 'customRequest'; requestId: string; state: 'added' | 'dismissed' }

export const INITIAL_DIRECTOR: DirectorState = {
  phase: 'loading',
  turns: [],
  pending: null,
  repliesLeft: null,
  blockedLines: null,
  busy: null,
}

export function directorReducer(state: DirectorState, action: DirectorAction): DirectorState {
  switch (action.type) {
    case 'loaded': {
      const { thread } = action
      const turns: TurnEntry[] = thread.turns
        .filter((t) => t.response !== null)
        .map((t) => {
          const response = t.response!
          const outcomes: Record<string, Outcome> = {}
          for (const s of response.suggestions) {
            const status = thread.suggestionStatus[s.id]
            if (status === 'accepted') outcomes[s.id] = { kind: 'accepted', totalCents: s.newTotalCents }
            else if (status === 'declined' || status === 'out_of_date') outcomes[s.id] = { kind: status }
          }
          return { requestId: t.requestId, fanMessage: t.fanMessage, response, outcomes, customRequest: 'offered' as const }
        })
      const phase: DirectorPhase = !thread.available ? 'unavailable' : thread.repliesLeft <= 0 ? 'exhausted' : 'ready'
      return { ...state, phase, turns, repliesLeft: thread.repliesLeft }
    }
    case 'send':
      if (state.phase !== 'ready') return state
      return { ...state, phase: 'thinking', pending: action.message, blockedLines: null }
    case 'replied':
      return {
        ...state,
        phase: action.reply.repliesLeft <= 0 ? 'exhausted' : 'ready',
        pending: null,
        repliesLeft: action.reply.repliesLeft,
        turns: [
          ...state.turns,
          { requestId: action.reply.requestId, fanMessage: action.message, response: action.reply, outcomes: {}, customRequest: 'offered' },
        ],
      }
    case 'unavailable':
      return { ...state, phase: 'unavailable', pending: null, repliesLeft: action.repliesLeft ?? state.repliesLeft }
    case 'exhausted':
      return { ...state, phase: 'exhausted', pending: null, repliesLeft: 0 }
    case 'blocked':
      return { ...state, phase: 'ready', pending: null, blockedLines: action.lines }
    case 'ready':
      return { ...state, phase: state.repliesLeft !== null && state.repliesLeft <= 0 ? 'exhausted' : 'ready', blockedLines: null }
    case 'busy':
      return { ...state, busy: action.id }
    case 'outcome':
      return {
        ...state,
        busy: null,
        turns: state.turns.map((t) =>
          t.response.suggestions.some((s) => s.id === action.suggestionId)
            ? { ...t, outcomes: { ...t.outcomes, [action.suggestionId]: action.outcome } }
            : t,
        ),
      }
    case 'customRequest':
      return {
        ...state,
        busy: null,
        turns: state.turns.map((t) => (t.requestId === action.requestId ? { ...t, customRequest: action.state } : t)),
      }
  }
}
