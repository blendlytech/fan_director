import type { RenderedBoundaries } from './boundaries.ts'
import { fanCategories, withProfileLimits, type CreatorProfile } from './creatorProfile.ts'

/**
 * The fan's request as one structured, stable object: what they picked in each
 * lookbook category (or "model's preference"), the creator's limits, and the
 * Scene Card. It is the hand-off to AI playback (docs/handoff/
 * selection-inventory.md): consumers read this shape, never the React state
 * behind it.
 *
 * Versioning: `schema` changes only when a field is removed or changes
 * meaning. Adding an optional field keeps the same schema string.
 */

export const SELECTION_INVENTORY_SCHEMA = 'fds.selection-inventory/v1'

export type InventoryItem = {
  itemId: string
  name: string
  /**
   * Where the image is served. Null for an image uploaded in the public demo,
   * which exists only in that browser tab as a data URL.
   */
  image: string | null
}

export type InventoryChoice =
  | { kind: 'selected'; items: InventoryItem[] }
  /** The fan chose nothing here, which leaves the category to the creator. */
  | { kind: 'model_preference' }

export type InventoryCategory = {
  categoryId: string
  name: string
  maxSelections: number
  choice: InventoryChoice
}

export type SceneCardSnapshot = {
  /** The catalog version every amount below was priced against. */
  catalogVersionId: string
  settingKey: string
  settingLabel: string
  sceneTitle: string
  minutes: number
  lineItems: { label: string; detail: string; amountCents: number }[]
  /** Always the sum of `lineItems`. */
  totalCents: number
  budgetCents: number | null
  /** Days from payment confirmation, subject to creator approval. */
  deliveryDays: number
  /** The fan's notes, oldest first. */
  notes: string[]
  fanDisplayName: string | null
  /** Unpriced free text the creator reviews (doc 11 §5.1). */
  customRequest: string | null
}

export type SelectionInventory = {
  schema: typeof SELECTION_INVENTORY_SCHEMA
  /** `demo`: the public in-memory demo. `staging`: a signed-in build with a server. */
  source: 'demo' | 'staging'
  creator: { name: string; style: string; tone: string; mood: string }
  /** Every category the fan could see, in the creator's order. Adult categories appear only when allowed. */
  categories: InventoryCategory[]
  /** Plain-language lines, from the one boundaries renderer plus the creator's own additions. */
  boundaries: { hardNo: string[]; askFirst: string[]; platform: string[] }
  sceneCard: SceneCardSnapshot
}

export function buildSelectionInventory(input: {
  source: SelectionInventory['source']
  profile: CreatorProfile
  /** Category id → chosen item ids. Unknown ids, and picks past a category's limit, are left out. */
  choices: Record<string, readonly string[]>
  adultAllowed: boolean
  boundaries: RenderedBoundaries
  sceneCard: SceneCardSnapshot
}): SelectionInventory {
  const { profile } = input
  const limits = withProfileLimits(input.boundaries, profile.boundaries)
  return {
    schema: SELECTION_INVENTORY_SCHEMA,
    source: input.source,
    creator: { name: profile.brand.name, style: profile.style, tone: profile.tone, mood: profile.mood },
    categories: fanCategories(profile, { adultAllowed: input.adultAllowed }).map((category) => {
      const picked = new Set(input.choices[category.id] ?? [])
      const items = category.items
        .filter((item) => picked.has(item.id))
        .slice(0, category.maxSelections)
        .map((item) => ({ itemId: item.id, name: item.name, image: item.image.startsWith('data:') ? null : item.image }))
      return {
        categoryId: category.id,
        name: category.name,
        maxSelections: category.maxSelections,
        choice: items.length > 0 ? { kind: 'selected', items } : { kind: 'model_preference' },
      }
    }),
    boundaries: {
      hardNo: limits.hardNo.map((line) => line.text),
      askFirst: limits.askFirst.map((line) => line.text),
      platform: limits.platform.flatMap((rule) => rule.lines),
    },
    sceneCard: input.sceneCard,
  }
}
