import { HARD_LIST_KEYS, hardListLines, type HardListKey } from './hardList.ts'
import type { Boundaries, LimitMode } from './types.ts'

/**
 * Fan-facing labels for the creator-limit checklist (doc 11 §5.3.4), kept in
 * one place. Plain words, one short line each; never a key or a code.
 * Pending owner approval of the rendered wording (Phase 2 step 5).
 */
export const CHECKLIST_LABELS: Record<string, string> = {
  non_explicit_only: 'Anything explicit',
  no_political_content: 'Anything political',
  no_brand_mentions: 'Brand mentions or ads',
}

export interface LimitLine {
  source: 'checklist' | 'custom'
  /** The checklist key or the custom limit's id. */
  id: string
  text: string
}

export interface RenderedBoundaries {
  /** "{creator} doesn't do these": listed first. */
  hardNo: LimitLine[]
  /** "Ask {creator} first". */
  askFirst: LimitLine[]
  /** The platform hard list, always in full, in the fixed order. */
  platform: { key: HardListKey; lines: string[] }[]
  wardrobeCreatorCurated: boolean
  customRequestPolicy: Boundaries['customRequestPolicy']
}

/**
 * The limits that actually apply. While adult content isn't allowed for the
 * creator, `non_explicit_only` is forced on as a hard no (§5.3.4), whatever
 * the stored value says.
 */
export function effectiveLimits(
  boundaries: Boundaries,
  opts: { adultAllowed: boolean },
): { checklist: Boundaries['checklist']; custom: Boundaries['custom'] } {
  const checklist = { ...boundaries.checklist }
  if (!opts.adultAllowed) checklist.non_explicit_only = { enabled: true, mode: 'hard_no' }
  return { checklist, custom: boundaries.custom }
}

/**
 * The one renderer for fan-facing boundaries text (§5.3.4). The entrance, the
 * AI Director and the review screen all use it, so they always say the same
 * thing. Order: hard-no limits, then ask-me limits, then the hard list.
 */
export function renderBoundaries(
  boundaries: Boundaries,
  creatorName: string,
  opts: { adultAllowed: boolean },
): RenderedBoundaries {
  const limits = effectiveLimits(boundaries, opts)
  const lines: Record<LimitMode, LimitLine[]> = { hard_no: [], ask_me: [] }

  for (const [key, entry] of Object.entries(limits.checklist)) {
    const text = CHECKLIST_LABELS[key]
    // An entry without an approved label is never shown as a raw key.
    if (entry.enabled && text) lines[entry.mode].push({ source: 'checklist', id: key, text })
  }
  for (const custom of limits.custom) {
    const text = custom.text.trim()
    if (text) lines[custom.mode].push({ source: 'custom', id: custom.id, text })
  }

  return {
    hardNo: lines.hard_no,
    askFirst: lines.ask_me,
    platform: HARD_LIST_KEYS.map((key) => ({ key, lines: hardListLines(key, creatorName) })),
    wardrobeCreatorCurated: boundaries.wardrobeCreatorCurated,
    customRequestPolicy: boundaries.customRequestPolicy,
  }
}
