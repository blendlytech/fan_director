import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_DRAFT, buildLineItems, sumOf, type Draft } from '../domain/sceneCard'
import {
  INITIAL_STATE,
  commissionReducer,
  type CommissionAction,
  type CommissionState,
} from './commissionReducer'

/* Helpers ------------------------------------------------------------------ */

/** Recursively freezes a value so any mutation inside the reducer throws. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

/** A frozen copy, so tests never freeze the shared INITIAL_STATE / INITIAL_DRAFT. */
function frozen(state: CommissionState): CommissionState {
  return deepFreeze(structuredClone(state))
}

const totalOf = (draft: Draft) => sumOf(buildLineItems(draft))

function run(state: CommissionState, actions: CommissionAction[]): CommissionState {
  return actions.reduce(commissionReducer, state)
}

/* commit -------------------------------------------------------------------- */

describe('commit', () => {
  it('merges changes into the draft and pushes the previous draft onto history', () => {
    const before = frozen(INITIAL_STATE)
    const after = commissionReducer(before, { type: 'commit', changes: { focus: 'longer' } })

    expect(after.draft).toEqual({ ...INITIAL_DRAFT, focus: 'longer' })
    expect(after.history).toHaveLength(before.history.length + 1)
    expect(after.history[after.history.length - 1]).toEqual(before.draft)
  })

  it('does not mutate the input state, its draft, or its history', () => {
    const start = run(structuredClone(INITIAL_STATE), [
      { type: 'commit', changes: { setting: 'floral' } },
    ])
    const snapshot = structuredClone(start)
    const input = deepFreeze(start)

    // Frozen input: any in-place write would throw in strict-mode ES modules.
    const after = commissionReducer(input, {
      type: 'commit',
      changes: { focus: 'longer', extraMinute: true },
    })

    expect(input).toEqual(snapshot)
    expect(after).not.toBe(input)
    expect(after.draft).not.toBe(input.draft)
    expect(after.history).not.toBe(input.history)
  })
})

/* commit that changes nothing ---------------------------------------------- */

describe('a commit that changes nothing', () => {
  it('re-selecting the current setting returns the same state and records no undo step', () => {
    const state = frozen(INITIAL_STATE)
    expect(commissionReducer(state, { type: 'commit', changes: { setting: 'vintage' } })).toBe(state)
  })

  it('an empty commit returns the same state', () => {
    const state = frozen(INITIAL_STATE)
    expect(commissionReducer(state, { type: 'commit', changes: {} })).toBe(state)
  })

  it('the "back within budget" commit is a no-op when the draft already matches', () => {
    const state = frozen(INITIAL_STATE) // already richer, no extra minute
    const after = commissionReducer(state, {
      type: 'commit',
      changes: { focus: 'richer', extraMinute: false },
    })
    expect(after).toBe(state)
  })

  it('a multi-field commit where only one field differs still records exactly one step', () => {
    const state = frozen(INITIAL_STATE)
    const after = commissionReducer(state, {
      type: 'commit',
      changes: { focus: 'richer', extraMinute: true },
    })
    expect(after.draft).toEqual({ ...INITIAL_DRAFT, extraMinute: true })
    expect(after.history).toEqual([INITIAL_DRAFT])
    expect(commissionReducer(deepFreeze(after), { type: 'undo' }).draft).toEqual(INITIAL_DRAFT)
  })

  it('re-selecting after a real change leaves one undo that reverts that change', () => {
    const changed = commissionReducer(frozen(INITIAL_STATE), {
      type: 'commit',
      changes: { setting: 'floral' },
    })
    const reclicked = commissionReducer(deepFreeze(changed), {
      type: 'commit',
      changes: { setting: 'floral' },
    })
    expect(reclicked).toBe(changed)
    const undone = commissionReducer(reclicked, { type: 'undo' })
    expect(undone.draft).toEqual(INITIAL_DRAFT)
    expect(undone.history).toHaveLength(0)
  })
})

/* undo ---------------------------------------------------------------------- */

describe('undo', () => {
  it('walks back multiple commits in exact reverse order, one change per undo', () => {
    const s0 = frozen(INITIAL_STATE)
    expect(totalOf(s0.draft)).toBe(145) // vintage + richer

    const s1 = commissionReducer(s0, { type: 'commit', changes: { focus: 'longer' } })
    expect(s1.draft).toEqual({ ...INITIAL_DRAFT, focus: 'longer' })
    expect(s1.history).toHaveLength(1)
    expect(totalOf(s1.draft)).toBe(165)

    const s2 = commissionReducer(deepFreeze(s1), {
      type: 'commit',
      changes: { extraMinute: true },
    })
    expect(s2.draft).toEqual({ ...INITIAL_DRAFT, focus: 'longer', extraMinute: true })
    expect(s2.history).toHaveLength(2)
    expect(totalOf(s2.draft)).toBe(205)

    const u1 = commissionReducer(deepFreeze(s2), { type: 'undo' })
    expect(u1.draft).toEqual(s1.draft)
    expect(u1.history).toHaveLength(1)
    expect(totalOf(u1.draft)).toBe(165)

    const u2 = commissionReducer(deepFreeze(u1), { type: 'undo' })
    expect(u2.draft).toEqual(INITIAL_DRAFT)
    expect(u2.history).toHaveLength(0)
    expect(totalOf(u2.draft)).toBe(145)
  })

  it('reverts a multi-field commit in a single undo', () => {
    const over = run(structuredClone(INITIAL_STATE), [
      { type: 'commit', changes: { focus: 'longer' } },
      { type: 'commit', changes: { extraMinute: true } },
    ])
    expect(totalOf(over.draft)).toBe(205)

    // The Director's "back within budget" button changes two fields at once.
    const back = commissionReducer(deepFreeze(over), {
      type: 'commit',
      changes: { focus: 'richer', extraMinute: false },
    })
    expect(back.draft).toEqual(INITIAL_DRAFT)
    expect(back.history).toHaveLength(3)
    expect(totalOf(back.draft)).toBe(145)

    const undone = commissionReducer(deepFreeze(back), { type: 'undo' })
    expect(undone.draft).toEqual(over.draft)
    expect(undone.draft.focus).toBe('longer')
    expect(undone.draft.extraMinute).toBe(true)
    expect(undone.history).toHaveLength(2)
    expect(totalOf(undone.draft)).toBe(205)
  })

  it('returns the same state object when history is empty', () => {
    const state = frozen(INITIAL_STATE)
    expect(commissionReducer(state, { type: 'undo' })).toBe(state)
    expect(commissionReducer(INITIAL_STATE, { type: 'undo' })).toBe(INITIAL_STATE)
  })
})

/* Purity / StrictMode ------------------------------------------------------- */

describe('purity (React StrictMode invokes reducers twice)', () => {
  const actions: CommissionAction[] = [
    { type: 'commit', changes: { setting: 'backstage' } },
    { type: 'commit', changes: { focus: 'longer', extraMinute: true } },
    { type: 'note', text: 'More neon, please' },
    { type: 'undo' },
    { type: 'reset' },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(actions)('same (state, action) gives equal results and leaves input unchanged: $type', (action) => {
    const start = run(structuredClone(INITIAL_STATE), [
      { type: 'commit', changes: { setting: 'floral' } },
    ])
    const snapshot = structuredClone(start)
    const input = deepFreeze(start)

    const first = commissionReducer(input, action)
    const second = commissionReducer(input, action)

    expect(second).toEqual(first)
    expect(input).toEqual(snapshot)
  })

  it('a double-invoked commit grows history by exactly one, and one undo reverts it', () => {
    const state = frozen(INITIAL_STATE)
    const action: CommissionAction = { type: 'commit', changes: { focus: 'longer' } }

    commissionReducer(state, action) // StrictMode's discarded first call
    const next = commissionReducer(state, action) // the result React keeps

    expect(next.history).toHaveLength(1)
    const undone = commissionReducer(deepFreeze(next), { type: 'undo' })
    expect(undone.draft).toEqual(INITIAL_DRAFT)
    expect(undone.history).toHaveLength(0)
  })

  it('a double-invoked note grows history by exactly one and adds one note', () => {
    const state = frozen(INITIAL_STATE)
    const action: CommissionAction = { type: 'note', text: 'Warm lighting' }

    commissionReducer(state, action)
    const next = commissionReducer(state, action)

    expect(next.history).toHaveLength(1)
    expect(next.draft.notes).toHaveLength(1)
  })
})

/* note ---------------------------------------------------------------------- */

describe('note', () => {
  const NOW = new Date('2026-09-16T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('trims the text, appends {id, text}, and pushes history', () => {
    const before = frozen(INITIAL_STATE)
    const after = commissionReducer(before, { type: 'note', text: '  Make it 80s  \n' })

    expect(after.draft.notes).toEqual([{ id: 1, text: 'Make it 80s' }])
    expect(after.draft).toEqual({ ...INITIAL_DRAFT, notes: after.draft.notes })
    expect(after.history).toEqual([before.draft])
  })

  it('appends after existing notes, and undo removes exactly that note', () => {
    const one = commissionReducer(frozen(INITIAL_STATE), { type: 'note', text: 'First' })
    vi.setSystemTime(NOW.getTime() + 1)
    const two = commissionReducer(deepFreeze(one), { type: 'note', text: 'Second' })

    expect(two.draft.notes).toEqual([
      { id: 1, text: 'First' },
      { id: 2, text: 'Second' },
    ])
    expect(two.history).toHaveLength(2)

    const undone = commissionReducer(deepFreeze(two), { type: 'undo' })
    expect(undone.draft).toEqual(one.draft)
    expect(undone.draft.notes).toEqual([{ id: 1, text: 'First' }])
    expect(undone.history).toHaveLength(1)
  })

  it.each(['', '   ', '\n\t  '])(
    'whitespace-only text %j returns the same state object and pushes no history',
    (text) => {
      const state = frozen(
        run(structuredClone(INITIAL_STATE), [{ type: 'commit', changes: { setting: 'floral' } }]),
      )
      const after = commissionReducer(state, { type: 'note', text })
      expect(after).toBe(state)
      expect(after.history).toHaveLength(1)
    },
  )

  it('never changes the derived total', () => {
    const base = frozen(
      run(structuredClone(INITIAL_STATE), [
        { type: 'commit', changes: { focus: 'longer', extraMinute: true } },
      ]),
    )
    const withNote = commissionReducer(base, { type: 'note', text: 'Any note at all' })
    expect(totalOf(withNote.draft)).toBe(totalOf(base.draft))
    expect(totalOf(withNote.draft)).toBe(205)
  })

  it('gives distinct ids to two notes added in the same millisecond', () => {
    // The clock is frozen at NOW for this whole test.
    const two = run(structuredClone(INITIAL_STATE), [
      { type: 'note', text: 'First' },
      { type: 'note', text: 'Second' },
    ])
    const ids = two.draft.notes.map((note) => note.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps ids unique after an undo followed by a new note', () => {
    const state = run(structuredClone(INITIAL_STATE), [
      { type: 'note', text: 'First' },
      { type: 'note', text: 'Second' },
      { type: 'undo' },
      { type: 'note', text: 'Replacement' },
    ])
    const ids = state.draft.notes.map((note) => note.id)
    expect(state.draft.notes.map((note) => note.text)).toEqual(['First', 'Replacement'])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

/* reset --------------------------------------------------------------------- */

describe('reset', () => {
  it('returns INITIAL_STATE from any state, with nothing left to undo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'))
    try {
      const busy = frozen(
        run(structuredClone(INITIAL_STATE), [
          { type: 'commit', changes: { setting: 'backstage' } },
          { type: 'note', text: 'Candid' },
          { type: 'commit', changes: { focus: 'longer', extraMinute: true } },
        ]),
      )
      expect(busy.history).toHaveLength(3)

      const after = commissionReducer(busy, { type: 'reset' })
      expect(after).toBe(INITIAL_STATE)
      expect(after.draft).toEqual(INITIAL_DRAFT)
      expect(after.history).toHaveLength(0) // canUndo === false
      expect(commissionReducer(INITIAL_STATE, { type: 'reset' })).toBe(INITIAL_STATE)
    } finally {
      vi.useRealTimers()
    }
  })
})

/* Interleaving -------------------------------------------------------------- */

describe('interleaving commits, notes and undos', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('commit, note, commit, undo, undo, undo returns to INITIAL_DRAFT with empty history', () => {
    const s1 = commissionReducer(frozen(INITIAL_STATE), {
      type: 'commit',
      changes: { setting: 'floral' },
    })
    const s2 = commissionReducer(deepFreeze(s1), { type: 'note', text: 'Peonies' })
    const s3 = commissionReducer(deepFreeze(s2), {
      type: 'commit',
      changes: { extraMinute: true },
    })
    expect(s3.history).toHaveLength(3)

    const u1 = commissionReducer(deepFreeze(s3), { type: 'undo' })
    expect(u1.draft).toEqual(s2.draft)
    expect(u1.history).toHaveLength(2)

    const u2 = commissionReducer(deepFreeze(u1), { type: 'undo' })
    expect(u2.draft).toEqual(s1.draft)
    expect(u2.draft.notes).toEqual([])
    expect(u2.history).toHaveLength(1)

    const u3 = commissionReducer(deepFreeze(u2), { type: 'undo' })
    expect(u3.draft).toEqual(INITIAL_DRAFT)
    expect(u3.history).toHaveLength(0)
  })
})
