import { describe, expect, it } from 'vitest'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import type { CatalogContent } from '../../shared/domain/types.ts'
import { bodyOf } from './helpers'
import { directorSetup } from './ai-helpers'
import { CASES, type ConversationCase, type ConversationKind } from './fixtures/director-conversations'

/**
 * Runs every conversation of worker/test/fixtures/director-conversations.ts
 * through the real turn pipeline with the mocked provider (doc 11 §8 Phase 3:
 * "at least 30 representative test conversations"). Every price and model
 * call count in the fixture was computed by hand from Maya's pilot catalog,
 * so a mismatch here means either the fixture's arithmetic or the pipeline's
 * behaviour is wrong - not a guess.
 */

function contentFor(c: ConversationCase): CatalogContent {
  if (!c.customLimits && !c.customRequestPolicy) return PILOT_V1
  return {
    ...PILOT_V1,
    boundaries: {
      ...PILOT_V1.boundaries,
      custom: c.customLimits ?? [],
      customRequestPolicy: c.customRequestPolicy ?? PILOT_V1.boundaries.customRequestPolicy,
    },
  }
}

describe('AI Director: representative conversations (doc 11 §8 Phase 3)', () => {
  for (const c of CASES) {
    it(`${c.id} [${c.kind}] ${c.description}`, async () => {
      const content = contentFor(c)
      const s = await directorSetup({ content, draft: c.draftOverride })
      let revisionBeforeAccepts: number | null = null

      for (const t of c.turns) {
        if (t.classifier) s.classifier.push(...t.classifier)
        if (t.model) s.director.push(...t.model)

        const callsBefore = s.director.calls.length
        const before = await s.draft()
        const res = await s.turn(t.fan)
        expect(res.status).toBe(t.expect.status)
        const body = await bodyOf(res)

        // The turn itself never changes the draft; only accepting a suggestion does.
        expect(await s.draft()).toEqual(before)

        if (t.expect.directorCalls !== undefined) {
          expect(s.director.calls.length - callsBefore).toBe(t.expect.directorCalls)
        }
        if (t.expect.error !== undefined) expect(body.error).toBe(t.expect.error)
        if (t.expect.key !== undefined) expect(body.key).toBe(t.expect.key)
        if (t.expect.lines !== undefined) expect(body.lines).toEqual(t.expect.lines)
        if (t.expect.field !== undefined) expect(body.field).toBe(t.expect.field)
        if (t.expect.reply !== undefined) expect(body.reply).toBe(t.expect.reply)
        if (t.expect.clarifyingQuestion !== undefined) expect(body.clarifyingQuestion).toBe(t.expect.clarifyingQuestion)
        if (t.expect.notOfferedCount !== undefined) expect(body.notOffered).toHaveLength(t.expect.notOfferedCount)
        if (t.expect.notOfferedIncludes !== undefined) {
          expect(body.notOffered.some((n: { body: string }) => n.body.includes(t.expect.notOfferedIncludes as string))).toBe(true)
        }
        if (t.expect.customRequest !== undefined) {
          if (t.expect.customRequest) {
            expect(body.customRequest).not.toBeNull()
            if (t.expect.customRequestText !== undefined) expect(body.customRequest.text).toBe(t.expect.customRequestText)
          } else {
            expect(body.customRequest).toBeNull()
          }
        }
        if (t.expect.suggestions !== undefined) {
          expect(body.suggestions).toHaveLength(t.expect.suggestions.length)
          t.expect.suggestions.forEach((exp, i) => {
            const got = body.suggestions[i]
            expect(got.title).toBe(exp.title)
            expect(got.deltaCents).toBe(exp.deltaCents)
            expect(got.newTotalCents).toBe(exp.newTotalCents)
            expect(got.budgetDifferenceCents).toBe(exp.budgetDifferenceCents)
            expect(got.askFirst).toHaveLength(exp.askFirstCount ?? 0)
            if (exp.askFirstLimit !== undefined) {
              expect((got.askFirst as { limit: string }[]).every((a) => a.limit === exp.askFirstLimit)).toBe(true)
            }
          })
        }
        if (t.forbiddenSubstrings?.length) {
          const text = JSON.stringify(body)
          for (const marker of t.forbiddenSubstrings) expect(text).not.toContain(marker)
        }

        if (t.accept !== undefined) {
          const rev = await s.revision()
          if (t.staleAcceptIndex !== undefined) revisionBeforeAccepts = rev
          const acceptRes = await s.api(
            'POST',
            `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${body.suggestions[t.accept].id}/accept`,
            { expectedRevision: rev },
          )
          expect(acceptRes.status).toBe(200)

          if (t.staleAcceptIndex !== undefined) {
            const staleRes = await s.api(
              'POST',
              `/api/creators/${s.creatorId}/drafts/${s.draftId}/director/suggestions/${body.suggestions[t.staleAcceptIndex].id}/accept`,
              { expectedRevision: revisionBeforeAccepts },
            )
            expect(staleRes.status).toBe(409)
            expect((await bodyOf(staleRes)).error).toBe('suggestion_out_of_date')
          }
        }
      }
    })
  }

  it('the fixture set has at least 32 cases and covers every conversation kind (doc 11 §8 Phase 3)', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(32)
    const kinds: ConversationKind[] = [
      'normal',
      'budget',
      'unavailable',
      'hard_no',
      'ask_me',
      'custom_request',
      'vague',
      'richer_longer',
      'multi_turn',
      'stale',
      'boundary_violation',
    ]
    for (const k of kinds) expect(CASES.some((c) => c.kind === k)).toBe(true)
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length)
  })
})
