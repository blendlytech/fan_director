import type { LimitLine, RenderedBoundaries } from './boundaries.ts'

/**
 * The creator's lookbook: their brand, voice, limits, and named categories of
 * images a fan can point at ("this outfit", "that prop"). It is a list of
 * visual *requests*, never priced: the priced options stay in the versioned
 * catalog (shared/domain/catalog.ts), which only the owner's publish script
 * writes. The public demo keeps a profile in memory; staging saves it to the
 * creator's account (worker/src/creatorProfile.ts).
 */

export type VisualItem = { id: string; name: string; image: string; custom?: boolean }
export type VisualCategory = {
  id: string
  name: string
  /** How many items a fan may choose here. Choosing none is always allowed: that's "model's preference". */
  maxSelections: number
  items: VisualItem[]
  custom?: boolean
  /**
   * Adult categories are modelled but off (doc 11 §5.4, "designed for it,
   * launch non-explicit"). A fan never sees one, and it can hold no items,
   * until adult content is allowed for the creator.
   */
  contentRating?: 'general' | 'adult'
}

export type ProfileLimits = { hardNo: string[]; askFirst: string[] }

export type CreatorProfile = {
  brand: {
    name: string
    background: string
    surface: string
    text: string
    accent: string
    backgroundImage: string
  }
  style: string
  tone: string
  mood: string
  /** The creator's own limits, in their words, on top of the catalog's checklist and the platform hard list. */
  boundaries: ProfileLimits
  categories: VisualCategory[]
}

export const PROFILE_LIMITS = {
  categories: 16,
  itemsPerCategory: 24,
  maxSelections: 20,
  brandName: 80,
  voice: 120,
  categoryName: 50,
  itemName: 70,
  /** Doc 11 §5.3: up to 10 custom limit entries. */
  limitLines: 10,
  limitText: 120,
} as const

/** Starter categories that are adult whatever the stored value says, so a fan can't be shown one by editing the JSON. */
export const ADULT_STARTER_CATEGORY_IDS: readonly string[] = ['toys', 'fetishes']

const DEFAULT_BRAND: CreatorProfile['brand'] = {
  name: 'Maya Atelier',
  background: '#FDF8F3',
  surface: '#FFFFFF',
  text: '#302720',
  accent: '#84485D',
  backgroundImage: '',
}

const ADULT_STARTERS: VisualCategory[] = [
  { id: 'toys', name: 'Toys', maxSelections: 1, items: [], contentRating: 'adult' },
  { id: 'fetishes', name: 'Fetishes', maxSelections: 1, items: [], contentRating: 'adult' },
]

/** The public demo's sample creator. Its images are bundled under frontend/public. */
export const DEFAULT_CREATOR_PROFILE: CreatorProfile = {
  brand: DEFAULT_BRAND,
  style: 'Cinematic and personal',
  tone: 'Warm and confident',
  mood: 'Intimate, editorial',
  // The catalog's checklist already says no explicit, political or brand
  // content, so these are only the creator's additions.
  boundaries: {
    hardNo: [],
    askFirst: ['Wardrobe changes', 'Props and accessories'],
  },
  categories: [
    {
      id: 'clothing', name: 'Clothing', maxSelections: 1,
      items: [
        { id: 'lingerie', name: 'Burgundy lace lingerie', image: '/lookbook/lingerie.webp' },
        { id: 'swimsuit', name: 'Black one-piece swimsuit', image: '/lookbook/swimsuit.webp' },
        { id: 'thong-bikini', name: 'Cherry thong bikini', image: '/lookbook/thong-bikini.webp' },
        { id: 'bra', name: 'Black satin bra', image: '/lookbook/bra.webp' },
      ],
    },
    {
      id: 'scene', name: 'Scene', maxSelections: 1,
      items: [
        { id: 'vintage', name: 'Vintage lounge', image: '/scenes/vintage-lounge.webp' },
        { id: 'floral', name: 'Floral studio', image: '/scenes/floral-studio.webp' },
        { id: 'backstage', name: 'Backstage', image: '/scenes/backstage.webp' },
      ],
    },
    { id: 'accessories', name: 'Accessories', maxSelections: 2, items: [] },
    {
      id: 'props', name: 'Props', maxSelections: 2,
      items: [
        { id: 'glasses', name: 'Cat-eye glasses', image: '/lookbook/glasses.webp' },
        { id: 'feather', name: 'Feather fan', image: '/lookbook/feather.webp' },
        { id: 'oil', name: 'Body oil', image: '/lookbook/oil.webp' },
      ],
    },
    { id: 'costumes', name: 'Costumes', maxSelections: 1, items: [] },
    ...ADULT_STARTERS,
  ],
}

/**
 * Where a real creator's lookbook starts before their first save: their own
 * name, empty categories, no limits of their own. Never the demo's sample
 * images, which aren't theirs. The setting is priced in the catalog, so there
 * is no "Scene" category here.
 */
export function starterProfile(displayName: string): CreatorProfile {
  return {
    brand: { ...DEFAULT_BRAND, name: displayName.slice(0, PROFILE_LIMITS.brandName) },
    style: '',
    tone: '',
    mood: '',
    boundaries: { hardNo: [], askFirst: [] },
    categories: [
      { id: 'clothing', name: 'Clothing', maxSelections: 1, items: [] },
      { id: 'accessories', name: 'Accessories', maxSelections: 2, items: [] },
      { id: 'props', name: 'Props', maxSelections: 2, items: [] },
      { id: 'costumes', name: 'Costumes', maxSelections: 1, items: [] },
      ...ADULT_STARTERS,
    ],
  }
}

export function isAdultCategory(category: VisualCategory): boolean {
  return category.contentRating === 'adult' || ADULT_STARTER_CATEGORY_IDS.includes(category.id)
}

/** The categories a fan may see and choose from, in the creator's order. */
export function fanCategories(profile: CreatorProfile, opts: { adultAllowed: boolean }): VisualCategory[] {
  return profile.categories.filter((category) => opts.adultAllowed || !isAdultCategory(category))
}

/**
 * Adds the creator's own limits to what the one boundaries renderer produced
 * (shared/domain/boundaries.ts), so every screen lists the same lines. A
 * line that repeats one already shown, ignoring case, is left out.
 */
export function withProfileLimits(rendered: RenderedBoundaries, limits: ProfileLimits): RenderedBoundaries {
  const seen = new Set([...rendered.hardNo, ...rendered.askFirst].map((line) => line.text.trim().toLowerCase()))
  const extra = (texts: string[], prefix: string): LimitLine[] => {
    const lines: LimitLine[] = []
    texts.forEach((raw, index) => {
      const text = raw.trim()
      const key = text.toLowerCase()
      if (!text || seen.has(key)) return
      seen.add(key)
      lines.push({ source: 'custom', id: `${prefix}_${index}`, text })
    })
    return lines
  }
  return {
    ...rendered,
    hardNo: [...rendered.hardNo, ...extra(limits.hardNo, 'profile_hard_no')],
    askFirst: [...rendered.askFirst, ...extra(limits.askFirst, 'profile_ask_first')],
  }
}

/* ------------------------------ Parsing ---------------------------------- */

export type ProfileParse = { ok: true; profile: CreatorProfile } | { ok: false; field: string }

const ID = /^[A-Za-z0-9_-]{1,64}$/
const COLOR = /^#[0-9A-Fa-f]{6}$/

class Invalid extends Error {
  readonly field: string
  constructor(field: string) {
    super(field)
    this.field = field
  }
}

/**
 * Reads a profile the browser sent, strictly: unknown keys, wrong types and
 * over-long text are refused, never trimmed to fit. `imageAllowed` decides
 * which image URLs this caller may store (the Worker: only the creator's own
 * uploads). Text is trimmed; empty limit lines are dropped.
 */
export function parseCreatorProfile(raw: unknown, opts: { imageAllowed: (url: string) => boolean }): ProfileParse {
  try {
    return { ok: true, profile: readProfile(raw, opts.imageAllowed) }
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, field: err.field }
    throw err
  }
}

function readProfile(raw: unknown, imageAllowed: (url: string) => boolean): CreatorProfile {
  const p = record(raw, 'profile', ['brand', 'style', 'tone', 'mood', 'boundaries', 'categories'])
  const b = record(p.brand, 'brand', ['name', 'background', 'surface', 'text', 'accent', 'backgroundImage'])
  const brand: CreatorProfile['brand'] = {
    name: text(b.name, PROFILE_LIMITS.brandName, 'brand.name', true),
    background: color(b.background, 'brand.background'),
    surface: color(b.surface, 'brand.surface'),
    text: color(b.text, 'brand.text'),
    accent: color(b.accent, 'brand.accent'),
    backgroundImage: b.backgroundImage === '' ? '' : image(b.backgroundImage, imageAllowed, 'brand.backgroundImage'),
  }

  const limits = record(p.boundaries, 'boundaries', ['hardNo', 'askFirst'])
  const boundaries: ProfileLimits = {
    hardNo: limitLines(limits.hardNo, 'boundaries.hardNo'),
    askFirst: limitLines(limits.askFirst, 'boundaries.askFirst'),
  }

  if (!Array.isArray(p.categories) || p.categories.length > PROFILE_LIMITS.categories) throw new Invalid('categories')
  const categoryIds = new Set<string>()
  const categoryNames = new Set<string>()
  const categories = p.categories.map((entry, index): VisualCategory => {
    const field = `categories.${index}`
    const c = record(entry, field, ['id', 'name', 'maxSelections', 'items', 'custom', 'contentRating'])
    const id = identifier(c.id, `${field}.id`)
    const name = text(c.name, PROFILE_LIMITS.categoryName, `${field}.name`, true)
    if (categoryIds.has(id)) throw new Invalid(`${field}.id`)
    if (categoryNames.has(name.toLowerCase())) throw new Invalid(`${field}.name`)
    categoryIds.add(id)
    categoryNames.add(name.toLowerCase())
    if (!Number.isInteger(c.maxSelections) || (c.maxSelections as number) < 1 || (c.maxSelections as number) > PROFILE_LIMITS.maxSelections) {
      throw new Invalid(`${field}.maxSelections`)
    }
    if (c.contentRating !== undefined && c.contentRating !== 'general' && c.contentRating !== 'adult') throw new Invalid(`${field}.contentRating`)
    if (c.custom !== undefined && typeof c.custom !== 'boolean') throw new Invalid(`${field}.custom`)
    if (!Array.isArray(c.items) || c.items.length > PROFILE_LIMITS.itemsPerCategory) throw new Invalid(`${field}.items`)
    const itemIds = new Set<string>()
    const items = c.items.map((itemEntry, itemIndex): VisualItem => {
      const itemField = `${field}.items.${itemIndex}`
      const i = record(itemEntry, itemField, ['id', 'name', 'image', 'custom'])
      const itemId = identifier(i.id, `${itemField}.id`)
      if (itemIds.has(itemId)) throw new Invalid(`${itemField}.id`)
      itemIds.add(itemId)
      if (i.custom !== undefined && typeof i.custom !== 'boolean') throw new Invalid(`${itemField}.custom`)
      return {
        id: itemId,
        name: text(i.name, PROFILE_LIMITS.itemName, `${itemField}.name`, true),
        image: image(i.image, imageAllowed, `${itemField}.image`),
        ...(i.custom === true ? { custom: true } : {}),
      }
    })
    const category: VisualCategory = { id, name, maxSelections: c.maxSelections as number, items }
    if (c.custom === true) category.custom = true
    if (c.contentRating === 'adult' || ADULT_STARTER_CATEGORY_IDS.includes(id)) category.contentRating = 'adult'
    return category
  })

  return {
    brand,
    style: text(p.style, PROFILE_LIMITS.voice, 'style', false),
    tone: text(p.tone, PROFILE_LIMITS.voice, 'tone', false),
    mood: text(p.mood, PROFILE_LIMITS.voice, 'mood', false),
    boundaries,
    categories,
  }
}

function record(value: unknown, field: string, allowed: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Invalid(field)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Invalid(`${field}.${key}`)
  return value as Record<string, unknown>
}

function text(value: unknown, max: number, field: string, required: boolean): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Invalid(field)
  const trimmed = value.trim()
  if (required && trimmed === '') throw new Invalid(field)
  return trimmed
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new Invalid(field)
  return value
}

function color(value: unknown, field: string): string {
  if (typeof value !== 'string' || !COLOR.test(value)) throw new Invalid(field)
  return value.toUpperCase()
}

function image(value: unknown, allowed: (url: string) => boolean, field: string): string {
  if (typeof value !== 'string' || value.length > 2048 || !allowed(value)) throw new Invalid(field)
  return value
}

function limitLines(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Invalid(field)
  const lines = value.map((line, index) => text(line, PROFILE_LIMITS.limitText, `${field}.${index}`, false)).filter(Boolean)
  if (lines.length > PROFILE_LIMITS.limitLines) throw new Invalid(field)
  return lines
}
