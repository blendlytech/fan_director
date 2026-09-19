/**
 * Checks on the model's own text (doc 11 §8 Phase 3): no text field may
 * state a price, total, budget, discount, delivery date or approval. Every
 * number the fan sees comes from the server's quote, rendered by templates.
 *
 * These run on every text field (label, notOffered, customRequest,
 * clarifyingQuestion, note), including the ones the fan never sees, so a
 * reply that tries is rejected as a whole. The hard list is checked
 * separately (rules layer + classifier).
 */

export const OUTPUT_CHECKS_VERSION = 'output-checks-v1'

export type OutputIssue = 'money' | 'delivery_time' | 'approval' | 'refusal'

interface Check {
  issue: OutputIssue
  pattern: RegExp
  /** Phrases removed before matching, so common harmless wording passes. */
  allow?: RegExp[]
}

const DIGITS =
  '(?:\\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|a couple of|a few|a dozen|several)'
const WEEKDAYS = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)'
const MONTHS = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'

const CHECKS: Check[] = [
  // Money: amounts, currencies, and the words for prices, totals, budgets and discounts.
  { issue: 'money', pattern: /[$€£¥]|\b\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp|dollars?|bucks|cents?|euros?|pounds?)\b/i },
  { issue: 'money', pattern: /\b(?:dollars?|bucks|usd|cents|euros?)\b/i },
  {
    issue: 'money',
    pattern:
      /\b(?:price[sd]?|pricing|pricey|costs?|costing|total(?:s|led|ing)?|budget\w*|discount\w*|coupon\w*|promo codes?|deals?|on sale|refund\w*|cheap\w*|expensive|affordable|fees?|surcharge\w*|charged?|charges|charging|paid|payment\w*|pay|paying|invoice\w*|tip|tips)\b|\d+\s?%|\bpercent\b|\bper cent\b/i,
  },
  {
    issue: 'money',
    pattern: /\bfree\b/i,
    allow: [/\bfeel free\b/gi, /\bfree to\b/gi, /\bhands[- ]free\b/gi, /\bcarefree\b/gi, /\bfree[- ]spirited\b/gi],
  },
  // Delivery timing: durations in days, hours or weeks, dates and deadlines.
  {
    issue: 'delivery_time',
    pattern: new RegExp(
      `\\b${DIGITS}\\s*(?:-\\s*)?(?:business\\s+)?(?:days?|hours?|hrs?|weeks?|months?)\\b|\\b(?:tomorrow|tonight|next week|this week|end of the week|same[- ]day|overnight|asap|in no time|fortnight|by the weekend|this weekend|next weekend|next month|this month|later this (?:week|month)|in a day or two|within days)\\b|\\b(?:by|on|before|until)\\s+${WEEKDAYS}\\b|\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS}\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b|\\b(?:deliver\\w*|arriv\\w*|shipp?\\w*|turnaround)\\b`,
      'i',
    ),
    allow: [/\b(?:your|my|his|her|their)\s+\d{1,3}(?:st|nd|rd|th)\s+birthday\b/gi, /\b\d{1,3}(?:st|nd|rd|th)\s+birthday\b/gi],
  },
  // Approval: only the creator decides (doc 11 §3 rule 4).
  {
    issue: 'approval',
    pattern:
      /\b(?:approv\w*|guarantee\w*|confirm\w*|accepted|accepts|agreed|agrees|booked|booking|promise\w*|reserved|will definitely|for sure|it'?s a deal|signed off|green[- ]?light\w*|will (?:do|make|film|shoot|record|include|add) (?:it|this|that)|(?:she|he|they)(?:'ll| will) (?:do|agree|say yes|love to|happily))\b|\bsaid yes\b/i,
  },
  // Refusal or moralising: never shown; recorded so refusals can be counted.
  {
    issue: 'refusal',
    pattern:
      /\b(?:i can(?:no|')?t (?:help|assist|create|provide|do that|write)|i(?: am|'m) (?:not able|unable) to|not appropriate|inappropriate|against (?:my|our) (?:guidelines|polic(?:y|ies))|i won'?t be able|as an ai|i must decline|i'?m sorry, but)\b/i,
  },
]

export interface OutputFinding {
  field: string
  issue: OutputIssue
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Every finding in one text. `field` is where it came from, for the record.
 * `creatorName` catches "Luna will agree/happily do it" for any creator.
 */
export function checkOutputText(field: string, text: string, creatorName?: string): OutputFinding[] {
  const found: OutputFinding[] = []
  const lower = text.normalize('NFKC').replace(/[’‘]/g, "'")
  const checks = [...CHECKS]
  if (creatorName && creatorName.trim()) {
    checks.push({
      issue: 'approval',
      pattern: new RegExp(`\\b${escapeRe(creatorName.trim())}(?:'ll| will| would| is happy to| agrees| has agreed)\\s+(?:\\w+\\s+)?(?:do|agree|say yes|love to|happily|accept|approve)\\b`, 'i'),
    })
  }
  for (const check of checks) {
    let subject = lower
    for (const a of check.allow ?? []) subject = subject.replace(a, ' ')
    if (check.pattern.test(subject) && !found.some((f) => f.issue === check.issue)) found.push({ field, issue: check.issue })
  }
  return found
}
