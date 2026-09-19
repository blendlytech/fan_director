/**
 * The catalog, draft and quote contract (doc 11 §6), shared by the Worker and
 * the frontend. Money is always integer cents. Nothing in shared/ may import a
 * package: both sides compile these files directly.
 */

export type Cents = number
export type ContentRating = 'general' | 'adult'
export type LimitMode = 'ask_me' | 'hard_no'

export type Pricing =
  | { kind: 'fixed'; amount: Cents }
  | { kind: 'per_unit'; unitLabel: string; amountPerUnit: Cents; minQty: number; maxQty: number }
  | { kind: 'included' }
  | { kind: 'percent'; basisPoints: number }

/**
 * What an item means for the rules, independent of its creator-editable label
 * (doc 11 §5.7): `uses_name` needs `fanDisplayName`, `uses_script` needs
 * `fanScript`, and either one makes the video personal, which can't be
 * combined with a `resale` item.
 */
export type ItemTrait = 'uses_name' | 'uses_script' | 'resale'

export interface Item {
  id: string
  key: string
  label: string
  description?: string
  origin: 'starter' | 'creator'
  contentRating: ContentRating
  pricing: Pricing
  effects?: { minutes?: number; deliveryDaysDelta?: number }
  groupKey?: string
  requires?: string[]
  excludes?: string[]
  traits?: ItemTrait[]
  /** Where a new draft starts. Never used to repair a draft. */
  isDefault?: boolean
  hidden: boolean
  sortOrder: number
}

export interface SelectionGroup {
  key: string
  label: string
  min: number
  max: number
}

export interface Category {
  id: string
  key: string
  label: string
  description?: string
  origin: 'starter' | 'creator'
  contentRating: ContentRating
  selection: { min: number; max: number }
  groups?: SelectionGroup[]
  sortOrder: number
  hidden: boolean
  items: Item[]
}

export interface Template {
  id: string
  key: string
  label: string
  description?: string
  contentRating: ContentRating
  selections: Selection[]
  hidden: boolean
  sortOrder: number
}

export interface Boundaries {
  checklist: Record<string, { enabled: boolean; mode: LimitMode }>
  custom: { id: string; text: string; mode: LimitMode }[]
  wardrobeCreatorCurated: boolean
  customRequestPolicy: 'review' | 'decline'
}

/** Everything a catalog version stores in `catalog_version.content_json`. */
export interface CatalogContent {
  currency: 'USD'
  categories: Category[]
  boundaries: Boundaries
  delivery: { standardDaysFromPayment: number }
  pricingNote: string | null
  templates: Template[]
}

export interface Selection {
  itemId: string
  qty: number
}

/** The priced part of a draft. Notes, names and scripts never change a price. */
export interface PricedDraft {
  selections: Selection[]
  customRequest: string | null
  budget: Cents | null
}

export interface QuoteLine {
  itemId: string
  key: string
  categoryKey: string
  groupKey: string | null
  label: string
  qty: number
  amount: Cents
  pricingKind: Pricing['kind']
}

export interface Quote {
  catalogVersionId: string
  lines: QuoteLine[]
  total: Cents
  budgetDifference: Cents | null
  minutes: number
  deliveryDaysFromPayment: number
  customRequestPending: boolean
}

/**
 * Set by the server's check, never by the browser or the AI (doc 11 §6).
 * `display_name` and `fan_script` extend §6's sources, because Phase 2 checks
 * those draft fields too. A hard no is never a flag: it blocks.
 */
export interface BoundaryFlag {
  source: 'fan_message' | 'custom_request' | 'fan_script' | 'display_name' | 'notes' | 'suggestion'
  limit: { kind: 'checklist'; key: string } | { kind: 'custom'; id: string }
  mode: 'ask_me'
}

/** Typed rejections. A draft is never repaired to make it valid. */
export type SelectionError =
  | { code: 'unknown_item'; itemId: string }
  | { code: 'item_unavailable'; itemId: string }
  | { code: 'adult_disabled'; itemId: string }
  | { code: 'qty_out_of_range'; itemId: string; min: number; max: number }
  | { code: 'group_count'; categoryKey: string; groupKey: string | null; min: number; max: number; count: number }
  | { code: 'requires_missing'; itemId: string; requires: string }
  | { code: 'excluded_pair'; itemId: string; excludes: string }
  | { code: 'personalised_video_resale_forbidden'; itemIds: string[] }

export type Result<T, E = SelectionError> = { ok: true; value: T } | { ok: false; error: E }

export interface GateOptions {
  /** True only when the platform switch, the creator's switch and the compliance record all allow it (§5.4). */
  adultAllowed: boolean
}
