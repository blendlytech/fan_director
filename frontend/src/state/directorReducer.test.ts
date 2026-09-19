import { describe, expect, it } from 'vitest'
import type { DirectorReply, DirectorThread } from '../api/types'
import { directorReducer, INITIAL_DIRECTOR, type DirectorState } from './directorReducer'

const reply = (over: Partial<DirectorReply> = {}): DirectorReply => ({
  requestId: 'r1',
  draftRevision: 1,
  repliesLeft: 19,
  copyVersion: 'director-copy-v1',
  reply: 'Here’s one way to do it. Nothing changes until you add it.',
  suggestions: [
    { id: 's1', title: 'Detailed Greeting', adds: [{ label: 'Detailed Greeting', qty: 1, before: 0 }], removes: [], deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500, askFirst: [] },
  ],
  footer: null,
  notOffered: [],
  customRequest: null,
  clarifyingQuestion: null,
  ...over,
})

const ready: DirectorState = { ...INITIAL_DIRECTOR, phase: 'ready', repliesLeft: 20 }

describe('directorReducer', () => {
  it('one message at a time: a second send while thinking is ignored', () => {
    const thinking = directorReducer(ready, { type: 'send', message: 'hi' })
    expect(thinking.phase).toBe('thinking')
    expect(thinking.pending).toBe('hi')
    expect(directorReducer(thinking, { type: 'send', message: 'again' })).toBe(thinking)
  })

  it('a reply is added to the thread and updates the replies left', () => {
    const s = directorReducer(directorReducer(ready, { type: 'send', message: 'hi' }), { type: 'replied', message: 'hi', reply: reply() })
    expect(s.phase).toBe('ready')
    expect(s.pending).toBeNull()
    expect(s.repliesLeft).toBe(19)
    expect(s.turns).toHaveLength(1)
    expect(s.turns[0].fanMessage).toBe('hi')
  })

  it('the last reply moves to "out of replies" (17 E)', () => {
    const s = directorReducer(ready, { type: 'replied', message: 'x', reply: reply({ repliesLeft: 0 }) })
    expect(s.phase).toBe('exhausted')
  })

  it('a failure moves to "unavailable" and keeps the thread (17 D)', () => {
    const withTurn = directorReducer(ready, { type: 'replied', message: 'x', reply: reply() })
    const s = directorReducer(directorReducer(withTurn, { type: 'send', message: 'y' }), { type: 'unavailable', repliesLeft: 19 })
    expect(s.phase).toBe('unavailable')
    expect(s.turns).toHaveLength(1)
    expect(s.pending).toBeNull()
    expect(directorReducer(s, { type: 'ready' }).phase).toBe('ready')
  })

  it('a blocked message returns to ready with the rule lines (13 C3)', () => {
    const s = directorReducer(directorReducer(ready, { type: 'send', message: 'x' }), { type: 'blocked', lines: ['Sex between relatives'] })
    expect(s.phase).toBe('ready')
    expect(s.blockedLines).toEqual(['Sex between relatives'])
    expect(directorReducer(s, { type: 'send', message: 'ok' }).blockedLines).toBeNull()
  })

  it('records what the fan did with each suggestion', () => {
    const s0 = directorReducer(ready, { type: 'replied', message: 'x', reply: reply() })
    const s1 = directorReducer(directorReducer(s0, { type: 'busy', id: 's1' }), { type: 'outcome', suggestionId: 's1', outcome: { kind: 'accepted', totalCents: 14_500 } })
    expect(s1.busy).toBeNull()
    expect(s1.turns[0].outcomes.s1).toEqual({ kind: 'accepted', totalCents: 14_500 })
  })

  it('loading a thread restores outcomes and the phase', () => {
    const thread: DirectorThread = {
      available: true,
      reason: null,
      repliesLeft: 18,
      draftRevision: 2,
      turns: [{ requestId: 'r1', createdAt: '2026-09-18T10:00:00Z', fanMessage: 'hi', response: reply() }],
      suggestionStatus: { s1: 'accepted' },
    }
    const s = directorReducer(INITIAL_DIRECTOR, { type: 'loaded', thread })
    expect(s.phase).toBe('ready')
    expect(s.turns[0].outcomes.s1).toEqual({ kind: 'accepted', totalCents: 14_500 })
    expect(directorReducer(INITIAL_DIRECTOR, { type: 'loaded', thread: { ...thread, available: false } }).phase).toBe('unavailable')
    expect(directorReducer(INITIAL_DIRECTOR, { type: 'loaded', thread: { ...thread, repliesLeft: 0 } }).phase).toBe('exhausted')
  })
})
