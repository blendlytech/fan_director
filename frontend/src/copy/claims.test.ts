import { describe, expect, it } from 'vitest'
import type { CommissionStatus } from '../api/types'
import { creatorCopy, creatorErrorMessage } from './creatorRequests'
import { requestsCopy } from './requests'

/* -------------------------------------------------------------------------- */
/*  The no-false-claims rule, on the wording itself (doc 11 §3 rule 1).        */
/*                                                                            */
/*  Phase 4 is where the platform first says "sent", "approved" and           */
/*  "declined", and where payment first appears on screen. Payment never       */
/*  happens here: the creator reports it, so every sentence about it names     */
/*  the creator as the one who said so. These are bans on claims, not on       */
/*  words — "nothing is charged here" is exactly what the fan needs to read.   */
/* -------------------------------------------------------------------------- */

const STATUSES: CommissionStatus[] = ['in_review', 'question_open', 'proposal_open', 'approved', 'declined', 'withdrawn', 'closed']

/** Every sentence either module can put on screen, with sample values filled in. */
function rendered(module: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const value of Object.values(module)) {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) {
      for (const entry of value) if (entry && typeof entry === 'object' && 'label' in entry) out.push(String((entry as { label: unknown }).label))
    } else if (typeof value === 'function') {
      const fn = value as (...args: unknown[]) => unknown
      const args = ['Maya', 'September 18, 2026', 2, '$145.00'].slice(0, Math.max(fn.length, 0))
      try {
        const result = fn(...(fn.length === 1 && /status/.test(fn.toString().slice(0, 40)) ? ['in_review'] : args))
        if (typeof result === 'string') out.push(result)
      } catch {
        // A function that needs a shape we don't have is covered by its own test below.
      }
    }
  }
  return out
}

const fanLines = rendered(requestsCopy as unknown as Record<string, unknown>)
const creatorLines = rendered(creatorCopy as unknown as Record<string, unknown>)
const statusLines = [
  ...STATUSES.map((s) => requestsCopy.status(s, 'Maya')),
  ...STATUSES.map((s) => creatorCopy.status(s)),
]
const everyLine = [...fanLines, ...creatorLines, ...statusLines]

/** Claims that would only be true if this platform took the money. It never does. */
const FALSE_PAYMENT_CLAIMS = [
  /\byou (?:have |’ve |'ve )?paid\b/i,
  /\bpayment (?:confirmed|complete|successful|processed|received)\b(?! on)/i,
  /\bwe (?:charged|received|took)\b/i,
  /\bcharged (?:your|you|to your)\b/i,
  /\bpaid in full\b/i,
]

/** Phase 4 sends no email and no push: nothing may say it did (§5.6 item 26). */
const FALSE_NOTICE_CLAIMS = [/\bemail(?:ed)? (?:has been |was )?sent\b/i, /\bwe(?:'ve| have)? notified\b/i, /\bnotification sent\b/i]

describe('nothing claims a payment this platform never took', () => {
  it('actually sweeps the wording, rather than an empty list', () => {
    // Guards the sweeps below: a helper that quietly rendered nothing would
    // pass every "no such claim" test without reading a single sentence.
    expect(fanLines.length).toBeGreaterThan(40)
    expect(creatorLines.length).toBeGreaterThan(50)
    expect(everyLine.every((line) => line.length > 0)).toBe(true)
  })

  it('has no sentence that says the fan paid, or that anything was charged to them', () => {
    for (const line of everyLine) {
      for (const claim of FALSE_PAYMENT_CLAIMS) expect(line, line).not.toMatch(claim)
    }
  })

  it('names the creator as the one who reported the payment, in both modules', () => {
    expect(requestsCopy.paymentReported('Maya', 'September 18, 2026')).toBe('Maya marked your payment as received on September 18, 2026.')
    expect(creatorCopy.paymentReported('September 18, 2026')).toBe('You marked payment as received on September 18, 2026.')
    expect(creatorCopy.paymentReportedJustNow).toContain('you marked')
  })

  it('tells both sides plainly that the money moves somewhere else', () => {
    expect(requestsCopy.approved('Maya', 'September 18, 2026')).toContain('nothing is charged here')
    expect(creatorCopy.paymentOffPlatform).toContain('Nothing is charged here')
    expect(creatorCopy.paymentReportHelp).toContain('starts no clock')
  })

  it('never lets marking a payment stand in for a decision', () => {
    expect(creatorCopy.approvedNote).toContain('Nothing has been charged')
    expect(creatorCopy.approvedJustNow).toContain('Nothing has been charged')
  })
})

describe('nothing claims a message this build never sends', () => {
  it('has no sentence that says an email or a notification went out', () => {
    for (const line of everyLine) {
      for (const claim of FALSE_NOTICE_CLAIMS) expect(line, line).not.toMatch(claim)
    }
  })

  it('says instead where an answer actually appears', () => {
    expect(requestsCopy.listIntro('Maya')).toContain('there are no emails')
    expect(requestsCopy.justSent('Maya')).toContain('There are no emails')
    expect(creatorCopy.queueIntro).toContain('there are no emails')
  })
})

describe('what each status says', () => {
  it('has a plain sentence for every status the server can return, on both sides', () => {
    for (const status of STATUSES) {
      expect(requestsCopy.status(status, 'Maya')).toBeTruthy()
      expect(creatorCopy.status(status)).toBeTruthy()
    }
  })

  it('never turns a withheld request into a reason the fan can read', () => {
    // The server reports `withheld` to the fan as `closed`; the copy says no more.
    expect(requestsCopy.status('closed', 'Maya')).toBe('Closed')
    expect(requestsCopy.closed).toBe('This request is closed.')
  })

  it('attributes an approval and a decline to the creator, not to the platform', () => {
    expect(requestsCopy.status('approved', 'Maya')).toBe('Approved by Maya')
    expect(requestsCopy.status('declined', 'Maya')).toBe('Declined by Maya')
  })
})

describe('the fan’s name is never presented as verified', () => {
  it('labels it as unverified wherever the creator sees it', () => {
    expect(creatorCopy.fanNameUnverified).toBe('Not verified')
    expect(creatorCopy.fanNameHeading).toContain('asked to be called')
  })
})

describe('why the creator API said no', () => {
  it('asks for the authenticator, or for enrolment, from the server’s own answer', () => {
    expect(creatorErrorMessage(403, 'second_factor_required', { enrol: true })).toBe(creatorCopy.secondFactorEnrol)
    expect(creatorErrorMessage(403, 'second_factor_required', {})).toBe(creatorCopy.secondFactorRequired)
  })

  it('does not tell a non-creator that requests exist', () => {
    expect(creatorErrorMessage(403, 'not_a_creator', {})).toBe(creatorCopy.notCreator)
    expect(creatorErrorMessage(401, 'signed_out', {})).toBe(creatorCopy.signedOut)
    expect(creatorErrorMessage(500, 'http_500', {})).toBe(creatorCopy.queueError)
  })
})

describe('the queue offers only statuses the server stores', () => {
  it('has no "awaiting payment" filter, because no such status exists', () => {
    const values = creatorCopy.filters.map((f) => f.value)
    expect(values).toEqual(['all', 'in_review', 'question_open', 'proposal_open', 'approved', 'declined', 'withdrawn'])
    expect(creatorCopy.filters.some((f) => /payment/i.test(f.label))).toBe(false)
  })
})
