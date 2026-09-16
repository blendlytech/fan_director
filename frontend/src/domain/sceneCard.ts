/* -------------------------------------------------------------------------- */
/*  Scene Card domain model — the single source of truth for the fan journey.  */
/*                                                                            */
/*  Every price on the fan-facing screens is derived from this module. The     */
/*  estimated total is ALWAYS sumOf(buildLineItems(draft)); no screen may      */
/*  print a total as fixed copy. Deterministic pricing from Maya's approved    */
/*  catalog is the product's core promise — see docs/specs/01-design-context.  */
/* -------------------------------------------------------------------------- */

/* ------------------------------- Catalog --------------------------------- */

export const BUDGET = 150
export const BASE_VIDEO_PRICE = 90
export const BASE_MINUTES = 3
export const PER_EXTRA_MINUTE = 40
export const PERSONALIZED_GREETING_PRICE = 20

/** Days from payment confirmation. Delivery is never counted from today. */
export const DELIVERY_DAYS = 7

export type SettingId = 'vintage' | 'floral' | 'backstage'
export type FocusId = 'richer' | 'longer'

export type SettingOption = {
  id: SettingId
  name: string
  blurb: string
  price: number
  /** Thumbnail used in the Director's choice cards. */
  image: string
  /** Wider crop used for the Review hero. Several of these 404 — always render
   *  them through <SceneImage>, which falls back to an on-brand placeholder. */
  imageLarge: string
  alt: string
  sceneTitle: string
  /** One-line description of the finished scene, shown on the Review page. */
  sceneDescription: string
  lineLabel: string
}

export const SETTINGS: readonly SettingOption[] = [
  {
    id: 'vintage',
    name: 'Vintage Lounge',
    blurb: 'Cozy, intimate evening',
    price: 35,
    image:
      'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    imageLarge:
      'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    alt: 'Warmly lit vintage lounge with velvet seating and soft lamps',
    sceneTitle: 'Vintage Lounge Greeting',
    sceneDescription:
      'A cinematic, atmospheric personal greeting set in a cozy vintage lounge. Perfect for anniversaries and intimate celebrations.',
    lineLabel: 'Vintage Lounge Setup',
  },
  {
    id: 'floral',
    name: 'Floral Studio',
    blurb: 'Bright & celebratory',
    price: 45,
    image:
      'https://images.unsplash.com/photo-1563241527-2004cb630db0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    imageLarge:
      'https://images.unsplash.com/photo-1563241527-2004cb630db0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    alt: 'Bright studio table arranged with fresh cut flowers',
    sceneTitle: 'Floral Studio Greeting',
    sceneDescription:
      'A bright, airy greeting surrounded by seasonal blooms. Ideal for cheerful celebrations and uplifting messages.',
    lineLabel: 'Floral Studio Setup',
  },
  {
    id: 'backstage',
    name: 'Backstage',
    blurb: 'Raw & authentic',
    price: 15,
    image:
      'https://images.unsplash.com/photo-1517457224219-c60317e3df1c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    imageLarge:
      'https://images.unsplash.com/photo-1517457224219-c60317e3df1c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    alt: 'Backstage dressing area with mirror lights and hanging garments',
    sceneTitle: 'Backstage Greeting',
    sceneDescription:
      'A raw, candid greeting filmed between takes. A glimpse behind the scenes for a more personal, unpolished connection.',
    lineLabel: 'Backstage Setup',
  },
] as const

export type FocusOption = {
  id: FocusId
  name: string
  blurb: string
  icon: string
}

export const FOCUS_OPTIONS: readonly FocusOption[] = [
  {
    id: 'richer',
    name: 'Richer Setting',
    blurb: 'Keep 3 mins, add detailed personalized greeting',
    icon: 'lucide:sparkles',
  },
  {
    id: 'longer',
    name: 'Longer Video',
    blurb: 'Extend to 4 mins, standard greeting',
    icon: 'lucide:clock',
  },
] as const

/* ----------------------------- Scene card -------------------------------- */

export type LineItemId = 'video' | 'runtime' | 'setup' | 'greeting'

export type EditTarget = 'setting' | 'focus'

export type LineItem = {
  id: LineItemId
  label: string
  /** Shorter label for the Review page's price breakdown. */
  shortLabel: string
  detail: string
  /** Amount in whole dollars. The estimated total is always the sum of these. */
  amount: number
  /** Renders the rose "Added" badge for options the fan chose. */
  added: boolean
  /** Only optional add-ons can be removed; required components cannot. */
  removable: boolean
  /** Which conversation control edits this line. */
  edits: EditTarget
}

export type FanNote = { id: number; text: string }

export type Draft = {
  setting: SettingId
  focus: FocusId
  extraMinute: boolean
  notes: FanNote[]
}

export const INITIAL_DRAFT: Draft = {
  setting: 'vintage',
  focus: 'richer',
  extraMinute: false,
  notes: [],
}

/** The standing brief the fan opened with, shown when they have added no notes. */
export const FAN_BRIEF =
  'For my partner’s anniversary. They love 80s aesthetics. Something atmospheric and warm.'

export function settingOf(draft: Draft): SettingOption {
  // SETTINGS is exhaustive over SettingId, so this is always defined.
  return SETTINGS.find((option) => option.id === draft.setting) ?? SETTINGS[0]
}

export function focusOf(draft: Draft): FocusOption {
  return FOCUS_OPTIONS.find((option) => option.id === draft.focus) ?? FOCUS_OPTIONS[0]
}

/** Extra minutes beyond the 3-minute base, from the focus choice and the add-on. */
export function extraMinutesOf(draft: Draft): number {
  return (draft.focus === 'longer' ? 1 : 0) + (draft.extraMinute ? 1 : 0)
}

export function minutesOf(draft: Draft): number {
  return BASE_MINUTES + extraMinutesOf(draft)
}

/** The fan's most recent note, falling back to the brief they opened with. */
export function briefOf(draft: Draft): string {
  return draft.notes.length > 0 ? draft.notes[draft.notes.length - 1].text : FAN_BRIEF
}

export function buildLineItems(draft: Draft): LineItem[] {
  const setting = settingOf(draft)
  const extraMinutes = extraMinutesOf(draft)
  const items: LineItem[] = [
    {
      id: 'video',
      label: `${BASE_MINUTES}-Minute Video`,
      shortLabel: `Base Video (${BASE_MINUTES}-min)`,
      detail: 'Standard base rate',
      amount: BASE_VIDEO_PRICE,
      added: false,
      removable: false,
      edits: 'focus',
    },
  ]

  if (extraMinutes > 0) {
    items.push({
      id: 'runtime',
      label: `Extra Runtime (+${extraMinutes} min)`,
      shortLabel: `Extra Runtime (+${extraMinutes} min)`,
      detail: `$${PER_EXTRA_MINUTE} per additional minute · ${BASE_MINUTES + extraMinutes} minutes total`,
      amount: extraMinutes * PER_EXTRA_MINUTE,
      added: true,
      removable: true,
      edits: 'focus',
    })
  }

  items.push({
    id: 'setup',
    label: setting.lineLabel,
    shortLabel: setting.lineLabel,
    detail: 'Set dressing & lighting',
    amount: setting.price,
    added: true,
    removable: false,
    edits: 'setting',
  })

  items.push(
    draft.focus === 'richer'
      ? {
          id: 'greeting',
          label: 'Personalized Greeting',
          shortLabel: 'Detailed Greeting',
          detail: 'Detailed opening & closing',
          amount: PERSONALIZED_GREETING_PRICE,
          added: true,
          removable: false,
          edits: 'focus',
        }
      : {
          id: 'greeting',
          label: 'Standard Greeting',
          shortLabel: 'Standard Greeting',
          detail: 'Included with every commission',
          amount: 0,
          added: false,
          removable: false,
          edits: 'focus',
        },
  )

  return items
}

export function sumOf(items: readonly LineItem[]): number {
  return items.reduce((running, item) => running + item.amount, 0)
}

/** Total for a hypothetical draft — used to price the choice cards honestly. */
export function previewTotal(draft: Draft, changes: Partial<Draft>): number {
  return sumOf(buildLineItems({ ...draft, ...changes }))
}

/** Every draft a fan can actually build on one setting: each focus, with and
 *  without the extra minute. Notes never change the price. */
export function draftsFor(setting: SettingId): Draft[] {
  return FOCUS_OPTIONS.flatMap((focus) =>
    [false, true].map((extraMinute) => ({
      ...INITIAL_DRAFT,
      setting,
      focus: focus.id,
      extraMinute,
    })),
  )
}

/** Cheapest and dearest buildable total for a setting — the entrance cards'
 *  price range, derived rather than written as copy. */
export function priceRangeOf(setting: SettingId): { min: number; max: number } {
  const totals = draftsFor(setting).map((draft) => sumOf(buildLineItems(draft)))
  return { min: Math.min(...totals), max: Math.max(...totals) }
}

/* ---------------------------- Presentation -------------------------------- */

/** Whole dollars: the Director's live chips and budget pills read "$145". */
export const money = (amount: number) => `$${amount}`

/** Two decimals: the Review, Confirmation and creator screens read "$145.00". */
export const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** The three "Included Components" tiles on the Review page. */
export function includedComponents(draft: Draft) {
  const setting = settingOf(draft)
  return [
    { icon: 'lucide:video', label: 'Duration', value: `${minutesOf(draft)}-Minute Video` },
    { icon: 'lucide:armchair', label: 'Setting', value: setting.lineLabel },
    {
      icon: 'lucide:message-square-heart',
      label: 'Personalization',
      value: draft.focus === 'richer' ? 'Detailed Greeting' : 'Standard Greeting',
    },
  ]
}
