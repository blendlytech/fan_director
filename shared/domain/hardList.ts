/**
 * The platform hard list (doc 11 §5.3.2). Fixed by the platform: injected into
 * every catalog read, never stored in a catalog and never editable. Fan-facing
 * labels come from design 13, with `prohibited_roles` as design 24 state E
 * Option 1 (owner, 2026-09-18, §5.6 item 22): two lines under one key.
 *
 * `{creator}` is replaced with the creator's display name.
 */
export const HARD_LIST_KEYS = [
  'minors',
  'prohibited_roles',
  'incest',
  'non_consent',
  'bestiality',
  'real_third_parties',
  'unverified_performers',
  'solicitation',
  'illegal_acts',
  'hate_harassment',
] as const

export type HardListKey = (typeof HARD_LIST_KEYS)[number]

export const HARD_LIST_LINES: Record<HardListKey, readonly string[]> = {
  minors: ['Anyone under 18, or anything that suggests it'],
  prohibited_roles: [
    'School, babysitter or family roles, including step-family',
    'Playing someone else’s partner, or a named character from a film, show, game or anime',
  ],
  incest: ['Sex between relatives'],
  non_consent: ['Anything without clear consent, including pretend, drunk or asleep'],
  bestiality: ['Anything involving animals'],
  real_third_parties: ['Real people other than {creator}, {creator}’s verified partners and you'],
  unverified_performers: ['Anyone on camera who isn’t verified as an adult'],
  solicitation: ['Meeting in person, or paying for sex off camera'],
  illegal_acts: ['Anything else that would be illegal in real life'],
  hate_harassment: ['Hate or harassment'],
}

export function hardListLines(key: HardListKey, creatorName: string): string[] {
  return HARD_LIST_LINES[key].map((line) => line.replaceAll('{creator}', creatorName))
}
