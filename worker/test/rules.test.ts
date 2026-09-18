import { describe, expect, it } from 'vitest'
import { effectiveLimits } from '../../shared/domain/boundaries.ts'
import { HARD_LIST_KEYS } from '../../shared/domain/hardList.ts'
import { checkText, checkTexts } from '../src/rules/check.ts'
import { normalize } from '../src/rules/normalize.ts'
import { HARD_LIST_RULES } from '../src/rules/ruleset-v1.ts'
import { PILOT_V1 } from '../../shared/catalog/pilot-v1.ts'
import { MUST_ALLOW, MUST_BLOCK, type BlockCase } from './fixtures/hardlist.ts'

const run = (c: BlockCase) => (c.messages ? checkTexts(c.messages) : checkText(c.text!))
const label = (c: BlockCase) => c.text ?? c.messages!.join(' | ')

describe('the §5.3.3 test sets', () => {
  it('has at least 100 must-block cases covering every key, and 100 must-allow cases', () => {
    expect(MUST_BLOCK.length).toBeGreaterThanOrEqual(100)
    expect(MUST_ALLOW.length).toBeGreaterThanOrEqual(100)
    expect(new Set(MUST_BLOCK.map((c) => c.key))).toEqual(new Set(HARD_LIST_KEYS))
  })

  it('blocks every must-block case under the right key', () => {
    const wrong = MUST_BLOCK.map((c) => ({ case: label(c), expected: c.key, got: run(c).hardList?.key ?? null }))
      .filter((r) => r.got !== r.expected)
    expect(wrong).toEqual([])
  })

  it('blocks nothing in the must-allow set', () => {
    const blocked = MUST_ALLOW.map((text) => ({ text, hit: checkText(text).hardList }))
      .filter((r) => r.hit)
      .map((r) => `${r.text} -> ${r.hit!.ruleId}`)
    expect(blocked).toEqual([])
  })

  it('catches a violation spread over several messages, not any one of them', () => {
    const multi = MUST_BLOCK.filter((c) => c.messages)
    expect(multi.length).toBeGreaterThanOrEqual(2)
    for (const c of multi) {
      for (const m of c.messages!) expect(checkText(m).hardList).toBeNull()
    }
  })
})

describe('normalization', () => {
  it('undoes leetspeak, spacing, repeats and look-alike letters', () => {
    expect(normalize('T33N').norm).toBe('teen')
    expect(normalize('t e e n').norm).toBe('teen')
    expect(normalize('t.e.e.n').norm).toBe('teen')
    expect(normalize('teeeeen').norm).toBe('teen')
    expect(normalize('tееn').norm).toBe('teen') // Cyrillic е
    expect(normalize('ｔｅｅｎ').norm).toBe('teen') // full width
    expect(normalize('te​en').norm).toBe('teen') // zero-width space
  })

  it('keeps ages, ordinals and formats intact', () => {
    expect(normalize("I'm 16").norm).toBe('im 16')
    expect(normalize('my 18th birthday').norm).toBe('my 18th birthday')
    expect(normalize('4K in 1080p at 3pm').norm).toBe('4k in 1080p at 3pm')
    expect(normalize("my friend's wife").norm).toBe('my friends wife')
  })
})

describe('outcomes', () => {
  it('escalates a childlike role to minors, so the safety-case path opens', () => {
    const hit = checkText('pretend you are my sister, act like a child')
    expect(hit.hardList).toMatchObject({ key: 'minors' })
    expect(checkText('roleplay as my stepsister, she is a little girl').hardList).toMatchObject({
      key: 'minors', subject: 'childlike role',
    })
  })

  it('lets minors win over every other key', () => {
    expect(checkText('a threesome where she is 15').hardList?.key).toBe('minors')
  })

  it('says which prohibited_roles line matched', () => {
    expect(checkText('pretend to be my stepsister').hardList).toMatchObject({ key: 'prohibited_roles', line: 0 })
    expect(checkText('cosplay as Harley Quinn').hardList).toMatchObject({ key: 'prohibited_roles', line: 1 })
  })

  it('keeps only a short neutral subject, never the fan text', () => {
    for (const rule of HARD_LIST_RULES) expect(rule.subject.length).toBeLessThanOrEqual(100)
    const hit = checkText('have sex with my sister in the kitchen')
    expect(JSON.stringify(hit)).not.toContain('kitchen')
  })

  it('allows a group scene only when enough performers are verified', () => {
    expect(checkText('a threesome with Leo and Kai').hardList?.key).toBe('unverified_performers')
    expect(checkText('a threesome with Leo and Kai', { verifiedPerformers: 2 }).hardList).toBeNull()
  })
})

describe('creator limits (§5.3.4)', () => {
  const pilot = effectiveLimits(PILOT_V1.boundaries, { adultAllowed: false })

  it("reports Maya's hard-no limits by mode", () => {
    expect(checkText('say something about the election', { limits: pilot }).limits).toEqual([
      { limitKey: 'no_political_content', mode: 'hard_no', ruleId: 'limit.political' },
    ])
    expect(checkText('a shout out to my shop', { limits: pilot }).limits[0]).toMatchObject({ limitKey: 'no_brand_mentions' })
    expect(checkText('a slow striptease', { limits: pilot }).limits[0]).toMatchObject({ limitKey: 'non_explicit_only', mode: 'hard_no' })
  })

  it('reports ask-me limits as ask_me, and ignores disabled ones', () => {
    const limits = { checklist: { no_brand_mentions: { enabled: true, mode: 'ask_me' as const }, no_political_content: { enabled: false, mode: 'hard_no' as const } } }
    expect(checkText('wear my Nike hoodie, and mention the election', { limits }).limits).toEqual([
      { limitKey: 'no_brand_mentions', mode: 'ask_me', ruleId: 'limit.brands' },
    ])
  })

  it('never treats a creator limit as a hard-list hit', () => {
    expect(checkText('a slow striptease', { limits: pilot }).hardList).toBeNull()
  })
})
