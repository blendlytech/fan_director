import { HARD_LIST_KEYS, type HardListKey } from '../../../shared/domain/hardList.ts'
import type { Boundaries, LimitMode } from '../../../shared/domain/types.ts'
import { normalize, type NormalizedText } from './normalize.ts'
import { CHILD_PATTERN, HARD_LIST_RULES, LIMIT_RULES, RULESET_VERSION, type HardListRule, type LimitRule } from './ruleset-v1.ts'

export interface CheckContext {
  /** The creator's effective limits (see effectiveLimits in shared/domain/boundaries.ts). */
  limits?: { checklist: Boundaries['checklist'] }
  /** How many verified adult performers the creator has, besides themselves. */
  verifiedPerformers?: number
}

export interface HardListHit {
  key: HardListKey
  ruleId: string
  /** Neutral subject, at most 100 characters. Never the fan's wording. */
  subject: string
  /** Which fan-facing line matched, for keys with more than one. */
  line: number | null
  layer: 'rules'
  version: string
}

export interface LimitHit {
  limitKey: string
  mode: LimitMode
  ruleId: string
}

export interface TextCheck {
  /** The one hard-list hit that decides the outcome, or null. `minors` wins over every other key. */
  hardList: HardListHit | null
  /** Creator-limit hits, one per limit. */
  limits: LimitHit[]
}

const PRIORITY = new Map<HardListKey, number>(HARD_LIST_KEYS.map((key, i) => [key, i]))

function matches(rule: HardListRule | LimitRule, text: NormalizedText): boolean {
  let subject = 'form' in rule && rule.form === 'raw' ? text.raw : text.norm
  for (const allowed of rule.allow ?? []) subject = subject.replace(new RegExp(allowed.source, 'g'), ' , ')
  return rule.pattern.test(subject)
}

function hit(rule: HardListRule): HardListHit {
  return { key: rule.key, ruleId: rule.id, subject: rule.subject, line: rule.line ?? null, layer: 'rules', version: RULESET_VERSION }
}

function checkNormalized(text: NormalizedText, ctx: CheckContext): TextCheck {
  let best: HardListHit | null = null
  for (const rule of HARD_LIST_RULES) {
    if (rule.whenVerifiedPerformersBelow !== undefined && (ctx.verifiedPerformers ?? 0) >= rule.whenVerifiedPerformersBelow) continue
    if (!matches(rule, text)) continue
    const found = hit(rule)
    if (!best || PRIORITY.get(found.key)! < PRIORITY.get(best.key)!) best = found
  }
  if (best?.key === 'prohibited_roles' && CHILD_PATTERN.test(text.norm)) {
    best = { ...best, key: 'minors', ruleId: `${best.ruleId}+child`, subject: 'childlike role', line: null }
  }

  const limits: LimitHit[] = []
  for (const rule of LIMIT_RULES) {
    const entry = ctx.limits?.checklist[rule.limitKey]
    if (!entry?.enabled || limits.some((l) => l.limitKey === rule.limitKey)) continue
    if (matches(rule, text)) limits.push({ limitKey: rule.limitKey, mode: entry.mode, ruleId: rule.id })
  }
  return { hardList: best, limits }
}

/** Checks one text: a fan message, a display name, a custom request, a script or a note. */
export function checkText(text: string, ctx: CheckContext = {}): TextCheck {
  return checkNormalized(normalize(text), ctx)
}

/**
 * Checks several texts that belong together, such as the messages of one
 * conversation or all the text fields of a draft. Each is checked alone, then
 * all of them joined, so a violation spread over several messages is caught.
 */
export function checkTexts(texts: readonly string[], ctx: CheckContext = {}): TextCheck {
  const results = [...texts.map((t) => checkText(t, ctx)), checkText(texts.join('\n'), ctx)]
  let hardList: HardListHit | null = null
  for (const r of results) {
    if (r.hardList && (!hardList || PRIORITY.get(r.hardList.key)! < PRIORITY.get(hardList.key)!)) hardList = r.hardList
  }
  const limits: LimitHit[] = []
  for (const r of results) {
    for (const l of r.limits) if (!limits.some((x) => x.limitKey === l.limitKey)) limits.push(l)
  }
  return { hardList, limits }
}

export { RULESET_VERSION }
