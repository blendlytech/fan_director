import { describe, expect, it } from 'vitest'
import { HARD_LIST_KEYS } from '../../shared/domain/hardList.ts'
import type { Category, Item } from '../../shared/domain/types.ts'
import type { IndexedItem } from '../../shared/domain/catalog.ts'
import { readVerdict } from '../src/ai/classifier'
import { mentionsIntimate } from '../src/ai/intimate'
import { costFromTokens, rateOf, RESERVE_FACTOR, reservationFor } from '../src/ai/models'
import { checkOutputText } from '../src/ai/outputChecks'
import { directorSchema, parseDirectorReply } from '../src/ai/schema'

/**
 * Unit tests for the Phase 3 checking layer (doc 11 §8): no D1, no mocked
 * provider, just the pure functions the pipeline leans on to hold whatever
 * the model does. See ai-injection.test.ts for the same checks exercised
 * through a full Director turn.
 */

/* ------------------------- checkOutputText ------------------------------ */

// At least 25 texts that must be rejected: money, delivery time or approval
// wording (doc 11 §8: "no text field may state a price, total, budget,
// discount, delivery date or approval").
const MUST_REJECT: string[] = [
  // money
  "That's $5 now",
  'The total is 20 dollars',
  "It's 50% off today",
  'We can offer you a discount',
  'This comes with a refund policy',
  "That's quite affordable",
  "There's a small fee for that",
  "You'll be charged automatically",
  'This upgrade is completely free',
  'The price will surprise you',
  'That budget works out nicely',
  'We have a promo code for you',
  'Everything is on sale this week',
  'That option is a bit pricey',
  '€45 for the studio set',
  '£10 more for the greeting',
  '¥500 for the extra minute',
  // delivery time
  'It will be ready in 2 days',
  'Delivered by Friday',
  "We'll ship it tomorrow",
  'Expect it next week',
  'It arrives on March 5th',
  'Delivery is set for 3/5/2026',
  'The turnaround is quick',
  "It'll be done by Monday",
  'We can do it overnight',
  // approval
  'Maya has agreed to this',
  'Approved!',
  'This is guaranteed to happen',
  'Consider it booked',
  'For sure, that will happen',
  "It's a deal",
  'Confirmed for you',
  'Maya will happily include it',
  'She said yes to the idea',
]

// At least 25 texts typical of a planning question, which must pass.
const MUST_PASS: string[] = [
  'Would you like the Floral Studio or the Vintage Lounge?',
  'Feel free to tell me more about the mood you want.',
  'Is it for your 18th birthday?',
  'Should the greeting be short or detailed?',
  'Do you want one extra minute or two?',
  'What setting feels right: cozy or bright?',
  'Should Maya use your name in the video?',
  'Would you like a vertical or horizontal video?',
  'Do you have a theme in mind for the greeting?',
  'Should the video feel playful or romantic?',
  'Would you like her to mention any specific detail?',
  'What mood are you hoping for?',
  'Should we keep the outfit simple or dressy?',
  'Do you want the backstage or the studio setting?',
  'Would you like a longer or shorter video?',
  "What's the occasion you're celebrating?",
  'Should the tone be sweet or playful?',
  'Do you want her to say your name once or throughout?',
  'Is this a surprise for someone else?',
  'Would you like more detail in the opening?',
  'What kind of setting matches the mood you want?',
  'Should we focus on the greeting or the ending?',
  'Do you already have a script in mind?',
  'Would you like the vintage lounge for a cozy feel?',
  'What would make this feel more special to you?',
  'Should I ask about the setting first?',
  'Do you want a standard or detailed greeting?',
]

/**
 * Reasonable planning sentences that the checker is, in fact, stricter about
 * than a human would be. Kept and asserted as rejected, per instructions:
 * never weaken src to make these pass. Filled in after running the suite
 * once against MUST_PASS above.
 */
const KNOWN_STRICT: string[] = []

describe('checkOutputText: must-reject (money, delivery time, approval)', () => {
  it('has at least 25 cases, every one flagged', () => {
    expect(MUST_REJECT.length).toBeGreaterThanOrEqual(25)
    const missed = MUST_REJECT.filter((text) => checkOutputText('field', text).length === 0)
    expect(missed).toEqual([])
  })

  it('never reports the "refusal" issue for these (they are not model refusals)', () => {
    const refusals = MUST_REJECT.flatMap((text) => checkOutputText('field', text)).filter((f) => f.issue === 'refusal')
    expect(refusals).toEqual([])
  })
})

describe('checkOutputText: must-pass (typical planning questions)', () => {
  it('has at least 25 cases', () => {
    expect(MUST_PASS.length).toBeGreaterThanOrEqual(25)
  })

  it('flags none of the must-pass cases, except the recorded KNOWN_STRICT ones', () => {
    const strict = new Set(KNOWN_STRICT)
    const wronglyFlagged = MUST_PASS.filter((text) => !strict.has(text) && checkOutputText('field', text).length > 0)
    expect(wronglyFlagged).toEqual([])
  })

  it('every KNOWN_STRICT case really is rejected (so it is not sitting there by mistake)', () => {
    const notActuallyRejected = KNOWN_STRICT.filter((text) => checkOutputText('field', text).length === 0)
    expect(notActuallyRejected).toEqual([])
  })
})

/* ------------------------- directorSchema -------------------------------- */

describe('directorSchema', () => {
  it('sorts the enum, and locks removes to the same list as wants', () => {
    const schema = directorSchema(['c_item', 'a_item', 'b_item'], 2) as any
    expect(schema.properties.options.items.properties.wants.items.properties.itemId.enum).toEqual(['a_item', 'b_item', 'c_item'])
    expect(schema.properties.options.items.properties.removes.items.enum).toEqual(['a_item', 'b_item', 'c_item'])
  })

  it('closes the options array (maxItems 0) and uses a placeholder enum when there are no allowed ids', () => {
    const schema = directorSchema([], 3) as any
    expect(schema.properties.options.maxItems).toBe(0)
    expect(schema.properties.options.items.properties.wants.items.properties.itemId.enum).toEqual(['__none__'])
  })

  it('caps qty at the given maximum, and at least 1 even when maxQty is 0', () => {
    const withTwo = directorSchema(['a'], 2) as any
    expect(withTwo.properties.options.items.properties.wants.items.properties.qty.maximum).toBe(2)
    const withZero = directorSchema(['a'], 0) as any
    expect(withZero.properties.options.items.properties.wants.items.properties.qty.maximum).toBe(1)
  })
})

/* ------------------------- parseDirectorReply ----------------------------- */

const ALLOWED = new Set(['item_a', 'item_b'])
const validRaw = JSON.stringify({
  options: [{ label: 'A plan', wants: [{ itemId: 'item_a', qty: 1 }], removes: [] }],
  notOffered: ['thing'],
  customRequest: 'do a thing',
  clarifyingQuestion: 'Which one?',
  note: 'a note',
})
/** Something a naive implementation might accidentally echo back. It never should. */
const SECRET = 'zxqv_do_not_quote_me_12345'

describe('parseDirectorReply: happy path', () => {
  it('parses a fully valid reply', () => {
    const r = parseDirectorReply(validRaw, ALLOWED, 2)
    expect(r).toEqual({
      ok: true,
      value: {
        options: [{ label: 'A plan', wants: [{ itemId: 'item_a', qty: 1 }], removes: [] }],
        notOffered: ['thing'],
        customRequest: 'do a thing',
        clarifyingQuestion: 'Which one?',
        note: 'a note',
      },
    })
  })

  it('strips a ```json code fence before parsing', () => {
    const fenced = '```json\n' + validRaw + '\n```'
    expect(parseDirectorReply(fenced, ALLOWED, 2)).toEqual(parseDirectorReply(validRaw, ALLOWED, 2))
  })

  it('strips a bare code fence (no "json" tag) too', () => {
    const fenced = '```\n' + validRaw + '\n```'
    expect(parseDirectorReply(fenced, ALLOWED, 2).ok).toBe(true)
  })

  it('turns empty or blank strings in nullable fields into null', () => {
    const raw = JSON.stringify({ options: [], notOffered: [], customRequest: '', clarifyingQuestion: '   ', note: '' })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.customRequest).toBeNull()
      expect(r.value.clarifyingQuestion).toBeNull()
      expect(r.value.note).toBeNull()
    }
  })
})

describe('parseDirectorReply: every violation is a fixed phrase that never quotes the input', () => {
  it('malformed JSON', () => {
    const r = parseDirectorReply(`{not json, "${SECRET}"`, ALLOWED, 2)
    expect(r).toEqual({ ok: false, errors: ['the reply was not valid JSON'] })
  })

  it('a JSON array instead of an object', () => {
    const r = parseDirectorReply('[]', ALLOWED, 2)
    expect(r).toEqual({ ok: false, errors: ['the reply must be a JSON object'] })
  })

  it('a bare JSON string instead of an object', () => {
    const r = parseDirectorReply(JSON.stringify(SECRET), ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toEqual(['the reply must be a JSON object'])
      expect(r.errors.join(' ')).not.toContain(SECRET)
    }
  })

  it('an unknown top-level field is rejected without naming it', () => {
    const raw = JSON.stringify({ options: [], notOffered: [], customRequest: null, clarifyingQuestion: null, note: null, [SECRET]: true })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContain('the reply has an unknown field')
      expect(r.errors.join(' ')).not.toContain(SECRET)
    }
  })

  it('a missing top-level field is named by its key, not its value', () => {
    const raw = JSON.stringify({ options: [], notOffered: [], customRequest: null, clarifyingQuestion: null })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toContain('the reply is missing note')
  })

  it('options over the limit of 2 is rejected', () => {
    const raw = JSON.stringify({
      options: [1, 2, 3].map((n) => ({ label: `o${n}`, wants: [], removes: [] })),
      notOffered: [],
      customRequest: null,
      clarifyingQuestion: null,
      note: null,
    })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('options must be an array of at most 2')
  })

  it('options as a non-array is rejected, without quoting the value', () => {
    const raw = JSON.stringify({ options: SECRET, notOffered: [], customRequest: null, clarifyingQuestion: null, note: null })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.join(' ')).toContain('options must be an array of at most 2')
      expect(r.errors.join(' ')).not.toContain(SECRET)
    }
  })

  it('an option that is not an object is rejected', () => {
    const raw = JSON.stringify({ options: ['nope'], notOffered: [], customRequest: null, clarifyingQuestion: null, note: null })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('options[0] must be an object')
  })

  it('an itemId outside the allowed set is rejected without naming it', () => {
    const raw = JSON.stringify({
      options: [{ label: 'x', wants: [{ itemId: SECRET, qty: 1 }], removes: [] }],
      notOffered: [],
      customRequest: null,
      clarifyingQuestion: null,
      note: null,
    })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.join(' ')).toContain('options[0].wants[0].itemId is not an allowed item id')
      expect(r.errors.join(' ')).not.toContain(SECRET)
    }
  })

  it('a removes id outside the allowed set is rejected without naming it', () => {
    const raw = JSON.stringify({
      options: [{ label: 'x', wants: [], removes: [SECRET] }],
      notOffered: [],
      customRequest: null,
      clarifyingQuestion: null,
      note: null,
    })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.join(' ')).toContain('options[0].removes[0] is not an allowed item id')
      expect(r.errors.join(' ')).not.toContain(SECRET)
    }
  })

  it('a qty above the maximum is rejected', () => {
    const raw = JSON.stringify({
      options: [{ label: 'x', wants: [{ itemId: 'item_a', qty: 9 }], removes: [] }],
      notOffered: [],
      customRequest: null,
      clarifyingQuestion: null,
      note: null,
    })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.errors.join(' ')).toContain('options[0].wants[0].qty must be an integer from 1 to 2')
  })

  it('a non-integer qty is rejected', () => {
    const raw = JSON.stringify({
      options: [{ label: 'x', wants: [{ itemId: 'item_a', qty: 1.5 }], removes: [] }],
      notOffered: [],
      customRequest: null,
      clarifyingQuestion: null,
      note: null,
    })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('options[0].wants[0].qty must be an integer from 1 to 2')
  })

  it('a qty of 0 is rejected (below the minimum of 1)', () => {
    const raw = JSON.stringify({
      options: [{ label: 'x', wants: [{ itemId: 'item_a', qty: 0 }], removes: [] }],
      notOffered: [],
      customRequest: null,
      clarifyingQuestion: null,
      note: null,
    })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('options[0].wants[0].qty must be an integer from 1 to 2')
  })

  it('a label over the length limit is rejected', () => {
    const raw = JSON.stringify({ options: [{ label: 'x'.repeat(61), wants: [], removes: [] }], notOffered: [], customRequest: null, clarifyingQuestion: null, note: null })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('options[0].label must be a string of at most 60 characters')
  })

  it('notOffered over the limit, or an oversized entry, is rejected', () => {
    const tooMany = JSON.stringify({ options: [], notOffered: ['a', 'b', 'c', 'd'], customRequest: null, clarifyingQuestion: null, note: null })
    const r1 = parseDirectorReply(tooMany, ALLOWED, 2)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.errors.join(' ')).toContain('notOffered must be an array of at most 3')

    const tooLong = JSON.stringify({ options: [], notOffered: ['x'.repeat(81)], customRequest: null, clarifyingQuestion: null, note: null })
    const r2 = parseDirectorReply(tooLong, ALLOWED, 2)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.errors.join(' ')).toContain('notOffered entries must be strings of at most 80 characters')
  })

  it('a nullable field of the wrong type is rejected, never quoting it', () => {
    const raw = JSON.stringify({ options: [], notOffered: [], customRequest: 5, clarifyingQuestion: null, note: null })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('customRequest must be null or a string of at most 200 characters')
  })

  it('a nullable field over its length limit is rejected', () => {
    const raw = JSON.stringify({ options: [], notOffered: [], customRequest: null, clarifyingQuestion: 'x'.repeat(161), note: null })
    const r = parseDirectorReply(raw, ALLOWED, 2)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain('clarifyingQuestion must be null or a string of at most 160 characters')
  })
})

/* ------------------------------ readVerdict ------------------------------- */

describe('readVerdict', () => {
  const known = new Set(['lim_a', 'lim_b'])

  it('reads an allowed verdict', () => {
    const v = readVerdict(JSON.stringify({ violation: false, key: null, childlike: false, limitIds: [] }), 'a normal request', known)
    expect(v).toEqual({ key: null, limitIds: [], escalated: false })
  })

  it.each(HARD_LIST_KEYS)('reads a %s violation as itself, with no escalation', (key) => {
    const v = readVerdict(JSON.stringify({ violation: true, key, childlike: false, limitIds: [] }), 'a request about something else entirely', known)
    expect(v).toEqual({ key, limitIds: [], escalated: false })
  })

  it('escalates prohibited_roles to minors when the classifier says childlike', () => {
    const v = readVerdict(JSON.stringify({ violation: true, key: 'prohibited_roles', childlike: true, limitIds: [] }), 'a role request', known)
    expect(v).toEqual({ key: 'minors', limitIds: [], escalated: true })
  })

  it('escalates prohibited_roles to minors when the text itself mentions a child, even if childlike is false', () => {
    const v = readVerdict(JSON.stringify({ violation: true, key: 'prohibited_roles', childlike: false, limitIds: [] }), 'act like a child', known)
    expect(v).toEqual({ key: 'minors', limitIds: [], escalated: true })
  })

  it('an unknown key fails closed (null), even though violation is true', () => {
    const v = readVerdict(JSON.stringify({ violation: true, key: 'made_up_key', childlike: false, limitIds: [] }), 'text', known)
    expect(v).toBeNull()
  })

  it('non-JSON fails closed', () => {
    expect(readVerdict('sure, that looks fine to me', 'text', known)).toBeNull()
  })

  it('a missing violation field fails closed', () => {
    expect(readVerdict(JSON.stringify({ key: 'incest', childlike: false, limitIds: [] }), 'text', known)).toBeNull()
  })

  it('a non-object reply fails closed', () => {
    expect(readVerdict('[]', 'text', known)).toBeNull()
    expect(readVerdict('null', 'text', known)).toBeNull()
  })

  it('filters limitIds to known ids and dedupes them', () => {
    const v = readVerdict(JSON.stringify({ violation: false, key: null, childlike: false, limitIds: ['lim_a', 'lim_a', 'lim_unknown'] }), 'text', known)
    expect(v).toEqual({ key: null, limitIds: ['lim_a'], escalated: false })
  })
})

/* ---------------------------- mentionsIntimate ---------------------------- */

describe('mentionsIntimate', () => {
  const category: Category = {
    id: 'c_props',
    key: 'props',
    label: 'Props',
    origin: 'starter',
    contentRating: 'adult',
    selection: { min: 0, max: 1 },
    sortOrder: 0,
    hidden: false,
    items: [],
  }
  const item: Item = {
    id: 'fx_test_prop',
    key: 'fx_test_prop',
    label: 'Fuzzy Cuffs',
    origin: 'starter',
    contentRating: 'adult',
    pricing: { kind: 'fixed', amount: 500 },
    hidden: false,
    sortOrder: 0,
  }
  const allowed: IndexedItem[] = [{ item, category }]

  it('is true when the message uses explicit words', () => {
    expect(mentionsIntimate('Can it be very sexual and explicit?', [])).toBe(true)
  })

  it('is false for an ordinary planning message with no adult items on offer', () => {
    expect(mentionsIntimate('Let’s plan a birthday greeting', [])).toBe(false)
  })

  it('is true when the message names an allowed adult item by its label', () => {
    expect(mentionsIntimate('Could we use the fuzzy cuffs?', allowed)).toBe(true)
  })

  it('is false when an adult item is on offer but the message never names it or uses explicit words', () => {
    expect(mentionsIntimate('Let’s plan a birthday greeting', allowed)).toBe(false)
  })
})

/* ------------------------ reservationFor / costFromTokens ------------------------ */

describe('reservationFor / costFromTokens (worker/src/ai/models.ts)', () => {
  const KNOWN = 'qwen/qwen3-235b-a22b-2507'
  const UNKNOWN = 'totally-unknown-model-xyz'

  it('always returns an integer', () => {
    expect(Number.isInteger(reservationFor(KNOWN, 300, 900))).toBe(true)
    expect(Number.isInteger(reservationFor(UNKNOWN, 17, 3))).toBe(true)
    expect(Number.isInteger(costFromTokens(KNOWN, 123, 45))).toBe(true)
    expect(Number.isInteger(costFromTokens(UNKNOWN, 1, 1))).toBe(true)
  })

  it('an unknown model uses the expensive fallback rate, never a rate of 0', () => {
    expect(rateOf(UNKNOWN)).toEqual({ inputPerMillion: 5_000_000, outputPerMillion: 15_000_000 })
    expect(reservationFor(UNKNOWN, 300, 900)).toBeGreaterThan(reservationFor(KNOWN, 300, 900))
    expect(costFromTokens(UNKNOWN, 100, 50)).toBeGreaterThan(costFromTokens(KNOWN, 100, 50))
  })

  it('applies RESERVE_FACTOR on top of the raw input+output rate', () => {
    expect(RESERVE_FACTOR).toBe(2)
    const rate = rateOf(KNOWN)
    const chars = 300
    const maxTokens = 900
    const sum = Math.ceil(chars / 3) * rate.inputPerMillion + maxTokens * rate.outputPerMillion
    const expected = Math.ceil((sum / 1_000_000) * 2)
    expect(reservationFor(KNOWN, chars, maxTokens)).toBe(expected)
  })

  it('costFromTokens has no reserve factor: it is the plain token cost', () => {
    const rate = rateOf(KNOWN)
    const cost = costFromTokens(KNOWN, 1000, 500)
    expect(cost).toBe(Math.ceil((1000 * rate.inputPerMillion + 500 * rate.outputPerMillion) / 1_000_000))
  })
})
