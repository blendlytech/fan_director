import type { CatalogContent, Category, Item } from '../domain/types.ts'

/**
 * Maya Atelier's catalog, version 1: the Phase 2 pilot seed (doc 11 §5.2,
 * §5.7, the §6 demo mapping, and §5.6 item 22). Maya is fictional. Prices are
 * the owner-approved starter defaults, in integer cents.
 *
 * This file is the one source: the publish script turns it into the staging
 * seed, and the public demo bundles it. Item ids stay stable across versions,
 * so a draft can move to a later version without renaming its choices.
 *
 * Demo mapping: "richer" = the detailed greeting; "longer" = one extra minute
 * with the standard greeting; the demo's extra-minute add-on = one more minute.
 */

export const PILOT_CREATOR_ID = 'cr_maya'
export const PILOT_CREATOR_NAME = 'Maya'
export const PILOT_BOUTIQUE_NAME = 'Maya Atelier'
export const PILOT_CATALOG_ID = 'cat_maya'
export const PILOT_VERSION_ID = 'cv_maya_1'

type ItemSeed = Omit<Item, 'origin' | 'contentRating' | 'hidden' | 'sortOrder'>

function items(list: ItemSeed[]): Item[] {
  return list.map((item, sortOrder) => ({ origin: 'starter', contentRating: 'general', hidden: false, sortOrder, ...item }))
}

const general: Category[] = [
  {
    id: 'maya_length_format',
    key: 'length_format',
    label: 'Length & format',
    origin: 'starter',
    contentRating: 'general',
    selection: { min: 0, max: 4 },
    groups: [
      { key: 'base', label: 'Base video', min: 1, max: 1 },
      { key: 'extra_minutes', label: 'Extra minutes', min: 0, max: 1 },
      { key: 'orientation', label: 'Orientation', min: 1, max: 1 },
    ],
    sortOrder: 0,
    hidden: false,
    items: items([
      {
        id: 'maya_base_video',
        key: 'base_video',
        label: '3-Minute Video',
        description: 'Standard base rate',
        pricing: { kind: 'fixed', amount: 9_000 },
        effects: { minutes: 3 },
        groupKey: 'base',
        isDefault: true,
      },
      {
        id: 'maya_extra_minute',
        key: 'extra_minute',
        label: 'Extra minute',
        pricing: { kind: 'per_unit', unitLabel: 'minute', amountPerUnit: 4_000, minQty: 1, maxQty: 2 },
        effects: { minutes: 1 },
        groupKey: 'extra_minutes',
      },
      {
        id: 'maya_orientation_vertical',
        key: 'orientation_vertical',
        label: 'Vertical',
        pricing: { kind: 'included' },
        groupKey: 'orientation',
        isDefault: true,
      },
      {
        id: 'maya_orientation_horizontal',
        key: 'orientation_horizontal',
        label: 'Horizontal',
        pricing: { kind: 'included' },
        groupKey: 'orientation',
      },
    ]),
  },
  {
    id: 'maya_setting',
    key: 'setting',
    label: 'Setting / set',
    origin: 'starter',
    contentRating: 'general',
    selection: { min: 1, max: 1 },
    sortOrder: 1,
    hidden: false,
    items: items([
      { id: 'maya_setting_vintage', key: 'vintage', label: 'Vintage Lounge', description: 'Cozy, intimate evening', pricing: { kind: 'fixed', amount: 3_500 } },
      { id: 'maya_setting_floral', key: 'floral', label: 'Floral Studio', description: 'Bright & celebratory', pricing: { kind: 'fixed', amount: 4_500 } },
      { id: 'maya_setting_backstage', key: 'backstage', label: 'Backstage', description: 'Raw & authentic', pricing: { kind: 'fixed', amount: 1_500 } },
    ]),
  },
  {
    id: 'maya_wardrobe',
    key: 'wardrobe',
    label: 'Wardrobe & look',
    origin: 'starter',
    contentRating: 'general',
    selection: { min: 0, max: 1 },
    sortOrder: 2,
    hidden: false,
    items: items([
      { id: 'maya_wardrobe_creators_choice', key: 'creators_choice', label: 'Creator’s choice', pricing: { kind: 'included' }, isDefault: true },
    ]),
  },
  {
    id: 'maya_personalization_delivery',
    key: 'personalization_delivery',
    label: 'Personalization & delivery',
    origin: 'starter',
    contentRating: 'general',
    selection: { min: 0, max: 4 },
    groups: [
      { key: 'greeting', label: 'Greeting', min: 1, max: 1 },
      { key: 'name_use', label: 'Your name', min: 1, max: 1 },
      { key: 'fan_script', label: 'Your own script', min: 0, max: 1 },
      { key: 'delivery', label: 'Delivery', min: 1, max: 1 },
    ],
    sortOrder: 3,
    hidden: false,
    items: items([
      { id: 'maya_greeting_standard', key: 'greeting_standard', label: 'Standard Greeting', description: 'Included with every commission', pricing: { kind: 'included' }, groupKey: 'greeting', isDefault: true },
      { id: 'maya_greeting_detailed', key: 'greeting_detailed', label: 'Detailed Greeting', description: 'Detailed opening & closing', pricing: { kind: 'fixed', amount: 2_000 }, groupKey: 'greeting' },
      { id: 'maya_name_none', key: 'name_none', label: 'No name', pricing: { kind: 'included' }, groupKey: 'name_use', isDefault: true },
      { id: 'maya_name_once', key: 'name_once', label: 'Says your name once', pricing: { kind: 'included' }, groupKey: 'name_use', traits: ['uses_name'] },
      { id: 'maya_name_throughout', key: 'name_throughout', label: 'Says your name throughout', pricing: { kind: 'fixed', amount: 1_500 }, groupKey: 'name_use', traits: ['uses_name'] },
      { id: 'maya_fan_script', key: 'fan_script', label: 'Your own script', pricing: { kind: 'fixed', amount: 3_000 }, groupKey: 'fan_script', traits: ['uses_script'] },
      { id: 'maya_delivery_standard', key: 'delivery_standard', label: 'Standard delivery', pricing: { kind: 'included' }, groupKey: 'delivery', isDefault: true },
      { id: 'maya_delivery_rush', key: 'delivery_rush', label: 'Rush delivery', pricing: { kind: 'percent', basisPoints: 5_000 }, effects: { deliveryDaysDelta: -5 }, groupKey: 'delivery' },
    ]),
  },
  {
    id: 'maya_rights_quality',
    key: 'rights_quality',
    label: 'Rights & quality',
    origin: 'starter',
    contentRating: 'general',
    selection: { min: 0, max: 2 },
    groups: [
      { key: 'rights', label: 'Rights', min: 1, max: 1 },
      { key: 'resolution', label: 'Resolution', min: 1, max: 1 },
    ],
    sortOrder: 4,
    hidden: false,
    items: items([
      { id: 'maya_rights_resell', key: 'rights_resell', label: 'Maya may resell it later', pricing: { kind: 'included' }, groupKey: 'rights', traits: ['resale'], isDefault: true },
      { id: 'maya_rights_exclusive', key: 'rights_exclusive', label: 'Just for you (exclusive)', pricing: { kind: 'percent', basisPoints: 5_000 }, groupKey: 'rights' },
      { id: 'maya_resolution_hd', key: 'resolution_hd', label: 'HD 1080p', pricing: { kind: 'included' }, groupKey: 'resolution', isDefault: true },
      { id: 'maya_resolution_4k', key: 'resolution_4k', label: '4K', pricing: { kind: 'fixed', amount: 2_500 }, groupKey: 'resolution' },
    ]),
  },
]

/** Defined for the future, with no items, rated adult and hidden (§5.4). Never enabled here. */
const adult: Category[] = [
  ['props', 'Props & toys'],
  ['participants', 'Solo or couple'],
  ['posing', 'Posing'],
  ['encounter_type', 'Type of intimate encounter'],
  ['specialty_acts', 'Specialties'],
].map(([key, label], i) => ({
  id: `maya_${key}`,
  key,
  label,
  origin: 'starter' as const,
  contentRating: 'adult' as const,
  selection: { min: 0, max: 0 },
  sortOrder: 10 + i,
  hidden: true,
  items: [],
}))

const base = (setting: string, rest: [string, number][]) => [
  { itemId: 'maya_base_video', qty: 1 },
  { itemId: 'maya_orientation_vertical', qty: 1 },
  { itemId: setting, qty: 1 },
  { itemId: 'maya_wardrobe_creators_choice', qty: 1 },
  { itemId: 'maya_delivery_standard', qty: 1 },
  ...rest.map(([itemId, qty]) => ({ itemId, qty })),
]

export const PILOT_V1: CatalogContent = {
  currency: 'USD',
  categories: [...general, ...adult],
  boundaries: {
    checklist: {
      non_explicit_only: { enabled: true, mode: 'hard_no' },
      no_political_content: { enabled: true, mode: 'hard_no' },
      no_brand_mentions: { enabled: true, mode: 'hard_no' },
    },
    custom: [],
    wardrobeCreatorCurated: true,
    customRequestPolicy: 'review',
  },
  delivery: { standardDaysFromPayment: 7 },
  pricingNote: null,
  // The four general starter templates (§5.7). The adult "specialties"
  // template isn't seeded: its category has no items.
  templates: [
    {
      id: 'maya_tpl_just_us',
      key: 'just_us',
      label: 'Just us',
      description: 'A warm, personal video that talks to you by name.',
      contentRating: 'general',
      selections: base('maya_setting_vintage', [
        ['maya_greeting_detailed', 1],
        ['maya_name_throughout', 1],
        ['maya_rights_exclusive', 1],
        ['maya_resolution_hd', 1],
      ]),
      hidden: false,
      sortOrder: 0,
    },
    {
      id: 'maya_tpl_follow_my_lead',
      key: 'follow_my_lead',
      label: 'Follow my lead',
      description: 'Maya guides you, step by step.',
      contentRating: 'general',
      selections: base('maya_setting_floral', [
        ['maya_extra_minute', 1],
        ['maya_greeting_standard', 1],
        ['maya_name_once', 1],
        ['maya_rights_exclusive', 1],
        ['maya_resolution_hd', 1],
      ]),
      hidden: false,
      sortOrder: 1,
    },
    {
      id: 'maya_tpl_in_uniform',
      key: 'in_uniform',
      label: 'In uniform',
      description: 'An adult role, like a nurse or a police officer, if Maya agrees.',
      contentRating: 'general',
      selections: base('maya_setting_backstage', [
        ['maya_greeting_standard', 1],
        ['maya_name_none', 1],
        ['maya_rights_resell', 1],
        ['maya_resolution_hd', 1],
      ]),
      hidden: false,
      sortOrder: 2,
    },
    {
      id: 'maya_tpl_up_close',
      key: 'up_close',
      label: 'Up close',
      description: 'Close framing, in 4K.',
      contentRating: 'general',
      selections: base('maya_setting_vintage', [
        ['maya_greeting_standard', 1],
        ['maya_name_none', 1],
        ['maya_rights_resell', 1],
        ['maya_resolution_4k', 1],
      ]),
      hidden: false,
      sortOrder: 3,
    },
  ],
}
