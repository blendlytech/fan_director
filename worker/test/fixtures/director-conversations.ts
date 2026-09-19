import type { Selection } from '../../../shared/domain/types.ts'
import type { MockStep } from '../../src/ai/mock'
import { option, reply, verdict } from '../ai-helpers'

/**
 * Representative AI Director conversations (doc 11 §8 Phase 3 completion
 * criteria: "at least 30 representative test conversations - normal
 * requests, budget trade-offs, unavailable choices, boundary violations,
 * custom requests"). Every price below is computed by hand from Maya's
 * pilot catalog (shared/catalog/pilot-v1.ts):
 *
 *   base video 9,000 + setting (vintage 3,500 / floral 4,500 / backstage
 *   1,500) + greeting (standard 0 / detailed 2,000) + extra minute 4,000
 *   per unit (max 2). Everything else the fan starts with is $0 (wardrobe,
 *   orientation, name, delivery, rights, resolution), so
 *   total = 9,000 + setting + greeting + extra*qty.
 *
 * Starting draft (ai-helpers.startSelections): vintage + standard greeting
 * = 12,500 cents. Budget defaults to 15,000 (headroom 2,500).
 *
 * The model's own wording (option labels, notes, notOffered text, and any
 * customRequest text that's expected to be dropped) always uses a
 * `MODEL-...` marker so the test can prove it never reaches the fan.
 */

export type ConversationKind =
  | 'normal'
  | 'budget'
  | 'unavailable'
  | 'hard_no'
  | 'ask_me'
  | 'custom_request'
  | 'vague'
  | 'richer_longer'
  | 'multi_turn'
  | 'stale'
  | 'boundary_violation'

export interface ExpectedSuggestion {
  title: string
  deltaCents: number
  newTotalCents: number
  budgetDifferenceCents: number | null
  /** Defaults to 0 when omitted. */
  askFirstCount?: number
  /** When set, every askFirst entry on this suggestion must carry this limit label. */
  askFirstLimit?: string
}

export interface TurnExpect {
  status: number
  suggestions?: ExpectedSuggestion[]
  notOfferedCount?: number
  /** A substring that must appear in one of the notOffered bodies. */
  notOfferedIncludes?: string
  /** Whether body.customRequest is non-null. */
  customRequest?: boolean
  /** Checked only when customRequest is true: the exact text shown. */
  customRequestText?: string
  clarifyingQuestion?: string | null
  reply?: string | null
  error?: string
  key?: string
  lines?: string[]
  field?: string
  /** Model (director) calls made in this turn, not cumulative across turns. */
  directorCalls?: number
}

export interface ConversationTurn {
  fan: string
  /** Queued classifier steps for this turn (classify_input, then classify_output if reached). */
  classifier?: MockStep[]
  /** Queued director (model) steps for this turn. */
  model?: MockStep[]
  /** Index of a suggestion in this turn's response to accept afterwards. */
  accept?: number
  /**
   * Only for the 'stale' case: after accepting `accept`, try accepting this
   * index too, using the revision from *before* either accept - expect 409
   * suggestion_out_of_date.
   */
  staleAcceptIndex?: number
  /** Strings that must never appear anywhere in this turn's response body. */
  forbiddenSubstrings?: string[]
  expect: TurnExpect
}

export interface ConversationCase {
  id: string
  kind: ConversationKind
  description: string
  /** PILOT_V1 with boundaries.custom set to this (Gate 2 deviation 2 custom limits). */
  customLimits?: { id: string; text: string; mode: 'ask_me' | 'hard_no' }[]
  customRequestPolicy?: 'review' | 'decline'
  /** Merged into the draft the setup creates (e.g. a different budget or starting selections). */
  draftOverride?: Record<string, unknown>
  turns: ConversationTurn[]
}

/** Maya's default starting draft, but with the detailed greeting already picked (used by C08). */
const START_WITH_DETAILED_GREETING: Selection[] = [
  { itemId: 'maya_base_video', qty: 1 },
  { itemId: 'maya_orientation_vertical', qty: 1 },
  { itemId: 'maya_setting_vintage', qty: 1 },
  { itemId: 'maya_wardrobe_creators_choice', qty: 1 },
  { itemId: 'maya_delivery_standard', qty: 1 },
  { itemId: 'maya_greeting_detailed', qty: 1 },
  { itemId: 'maya_name_none', qty: 1 },
  { itemId: 'maya_rights_resell', qty: 1 },
  { itemId: 'maya_resolution_hd', qty: 1 },
]

export const CASES: ConversationCase[] = [
  // -------------------------------------------------------------- normal (8)
  {
    id: 'C01',
    kind: 'normal',
    description: 'setting swap: vintage to floral',
    turns: [
      {
        fan: 'Could we shoot it in the floral studio instead?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C01', [['maya_setting_floral', 1]])], note: 'MODEL-NOTE-C01' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C01', 'MODEL-NOTE-C01'],
        expect: {
          status: 200,
          reply: 'Here’s one way to do it. Nothing changes until you add it.',
          suggestions: [{ title: 'Floral Studio', deltaCents: 1_000, newTotalCents: 13_500, budgetDifferenceCents: 1_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C02',
    kind: 'normal',
    description: 'setting swap: vintage to backstage',
    turns: [
      {
        fan: 'What about the backstage set?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C02', [['maya_setting_backstage', 1]])], note: 'MODEL-NOTE-C02' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C02', 'MODEL-NOTE-C02'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C03',
    kind: 'normal',
    description: 'greeting upgrade: standard to detailed',
    turns: [
      {
        fan: 'Could the greeting be a bit more special?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C03', [['maya_greeting_detailed', 1]])], note: 'MODEL-NOTE-C03' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C03', 'MODEL-NOTE-C03'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Detailed Greeting', deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C04',
    kind: 'normal',
    description: 'add one extra minute',
    turns: [
      {
        fan: 'Can we add one extra minute?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C04', [['maya_extra_minute', 1]])], note: 'MODEL-NOTE-C04' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C04', 'MODEL-NOTE-C04'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Extra minute', deltaCents: 4_000, newTotalCents: 16_500, budgetDifferenceCents: -1_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C05',
    kind: 'normal',
    description: 'extra minutes: qty over the max of 2 is rejected, then the model corrects to 2',
    turns: [
      {
        fan: 'Could we add three extra minutes?',
        model: [
          { reply: reply({ options: [option('MODEL-LABEL-C05A', [['maya_extra_minute', 3]])], note: 'MODEL-NOTE-C05A' }) },
          { reply: reply({ options: [option('MODEL-LABEL-C05B', [['maya_extra_minute', 2]])], note: 'MODEL-NOTE-C05B' }) },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C05A', 'MODEL-NOTE-C05A', 'MODEL-LABEL-C05B', 'MODEL-NOTE-C05B'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Extra minute × 2', deltaCents: 8_000, newTotalCents: 20_500, budgetDifferenceCents: -5_500 }],
          directorCalls: 2,
        },
      },
    ],
  },
  {
    id: 'C06',
    kind: 'normal',
    description: 'two options in one turn: floral or backstage',
    turns: [
      {
        fan: 'Should we go floral or backstage?',
        model: [
          {
            reply: reply({
              options: [option('MODEL-LABEL-C06A', [['maya_setting_floral', 1]]), option('MODEL-LABEL-C06B', [['maya_setting_backstage', 1]])],
              note: 'MODEL-NOTE-C06',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C06A', 'MODEL-LABEL-C06B', 'MODEL-NOTE-C06'],
        expect: {
          status: 200,
          reply: 'Two ways to do it. Pick one, both, or neither.',
          suggestions: [
            { title: 'Floral Studio', deltaCents: 1_000, newTotalCents: 13_500, budgetDifferenceCents: 1_500 },
            { title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 },
          ],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C07',
    kind: 'normal',
    description: 'one option combining a setting swap and a greeting upgrade',
    turns: [
      {
        fan: 'Floral studio, and make the greeting detailed too',
        model: [
          {
            reply: reply({
              options: [option('MODEL-LABEL-C07', [['maya_setting_floral', 1], ['maya_greeting_detailed', 1]])],
              note: 'MODEL-NOTE-C07',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C07', 'MODEL-NOTE-C07'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Floral Studio and Detailed Greeting', deltaCents: 3_000, newTotalCents: 15_500, budgetDifferenceCents: -500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C08',
    kind: 'normal',
    description: 'swap back from detailed to standard greeting (choose-one slot via wants)',
    draftOverride: { selections: START_WITH_DETAILED_GREETING },
    turns: [
      {
        fan: 'Actually the standard greeting is fine',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C08', [['maya_greeting_standard', 1]])], note: 'MODEL-NOTE-C08' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C08', 'MODEL-NOTE-C08'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Standard Greeting', deltaCents: -2_000, newTotalCents: 12_500, budgetDifferenceCents: 2_500 }],
          directorCalls: 1,
        },
      },
    ],
  },

  // ------------------------------------------------------------- budget (5)
  {
    id: 'C09',
    kind: 'budget',
    description: 'what fits my budget -> a cheaper setting',
    turns: [
      {
        fan: 'What fits my budget if I want something different?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C09', [['maya_setting_backstage', 1]])], note: 'MODEL-NOTE-C09' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C09', 'MODEL-NOTE-C09'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C10',
    kind: 'budget',
    description: 'stay under budget while adding an extra minute: cheaper setting frees room',
    turns: [
      {
        fan: 'I want an extra minute but need to stay under my budget',
        model: [
          {
            reply: reply({ options: [option('MODEL-LABEL-C10', [['maya_setting_backstage', 1], ['maya_extra_minute', 1]])], note: 'MODEL-NOTE-C10' }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C10', 'MODEL-NOTE-C10'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Extra minute and Backstage', deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C11',
    kind: 'budget',
    description: 'two extra minutes: one option over budget, one option that fits',
    turns: [
      {
        fan: 'I really want two extra minutes, what fits my budget?',
        model: [
          {
            reply: reply({
              options: [
                option('MODEL-LABEL-C11A', [['maya_extra_minute', 2]]),
                option('MODEL-LABEL-C11B', [['maya_setting_backstage', 1], ['maya_extra_minute', 1]]),
              ],
              note: 'MODEL-NOTE-C11',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C11A', 'MODEL-LABEL-C11B', 'MODEL-NOTE-C11'],
        expect: {
          status: 200,
          suggestions: [
            { title: 'Extra minute × 2', deltaCents: 8_000, newTotalCents: 20_500, budgetDifferenceCents: -5_500 },
            { title: 'Extra minute and Backstage', deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500 },
          ],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C12',
    kind: 'budget',
    description: 'a tighter personal budget makes the same swap come out over budget',
    draftOverride: { budget: 10_000 },
    turns: [
      {
        fan: 'Keep it under my budget please',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C12', [['maya_setting_backstage', 1]])], note: 'MODEL-NOTE-C12' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C12', 'MODEL-NOTE-C12'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: -500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C13',
    kind: 'budget',
    description: 'no budget set: budgetDifferenceCents is null',
    draftOverride: { budget: null },
    turns: [
      {
        fan: 'What is the cheaper option here?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C13', [['maya_setting_backstage', 1]])], note: 'MODEL-NOTE-C13' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C13', 'MODEL-NOTE-C13'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: null }],
          directorCalls: 1,
        },
      },
    ],
  },

  // -------------------------------------------------------- unavailable (4)
  {
    id: 'C14',
    kind: 'unavailable',
    description: 'model names an item outside the enum; retried, then a valid option succeeds',
    turns: [
      {
        fan: 'Could we add rush delivery, or if not, the floral studio?',
        model: [
          { reply: reply({ options: [option('MODEL-LABEL-C14A', [['maya_delivery_rush', 1]])], note: 'MODEL-NOTE-C14A' }) },
          { reply: reply({ options: [option('MODEL-LABEL-C14B', [['maya_setting_floral', 1]])], note: 'MODEL-NOTE-C14B' }) },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C14A', 'MODEL-NOTE-C14A', 'MODEL-LABEL-C14B', 'MODEL-NOTE-C14B'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Floral Studio', deltaCents: 1_000, newTotalCents: 13_500, budgetDifferenceCents: 1_500 }],
          directorCalls: 2,
        },
      },
    ],
  },
  {
    id: 'C15',
    kind: 'unavailable',
    description: 'model names a made-up item id twice; retried, then unavailable',
    turns: [
      {
        fan: 'Could we add the mystery upgrade?',
        model: [
          { reply: reply({ options: [option('MODEL-LABEL-C15A', [['made_up_item', 1]])], note: 'MODEL-NOTE-C15A' }) },
          { reply: reply({ options: [option('MODEL-LABEL-C15B', [['another_bad_id', 1]])], note: 'MODEL-NOTE-C15B' }) },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C15A', 'MODEL-NOTE-C15A', 'MODEL-LABEL-C15B', 'MODEL-NOTE-C15B'],
        expect: { status: 503, error: 'ai_unavailable', directorCalls: 2 },
      },
    ],
  },
  {
    id: 'C16',
    kind: 'unavailable',
    description: 'an option that changes nothing (no_change) is silently dropped; the other option still shows',
    turns: [
      {
        fan: 'Keep the vintage lounge, or actually make it floral',
        model: [
          {
            reply: reply({
              options: [option('MODEL-LABEL-C16A', [['maya_setting_vintage', 1]]), option('MODEL-LABEL-C16B', [['maya_setting_floral', 1]])],
              note: 'MODEL-NOTE-C16',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C16A', 'MODEL-LABEL-C16B', 'MODEL-NOTE-C16'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Floral Studio', deltaCents: 1_000, newTotalCents: 13_500, budgetDifferenceCents: 1_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C17',
    kind: 'unavailable',
    description: 'two options that end at the same selections; the duplicate is dropped',
    turns: [
      {
        fan: 'Backstage please, however you want to get there',
        model: [
          {
            reply: reply({
              options: [
                option('MODEL-LABEL-C17A', [['maya_setting_backstage', 1]]),
                option('MODEL-LABEL-C17B', [['maya_setting_backstage', 1]], ['maya_setting_vintage']),
              ],
              note: 'MODEL-NOTE-C17',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C17A', 'MODEL-LABEL-C17B', 'MODEL-NOTE-C17'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 }],
          directorCalls: 1,
        },
      },
    ],
  },

  // ---------------------------------------------------------------- hard_no (4)
  {
    id: 'C18',
    kind: 'hard_no',
    description: 'checklist hard no in the fan message ("naked") -> generic limit notice, option still offered',
    turns: [
      {
        fan: 'Backstage set please, and totally naked for me',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C18', [['maya_setting_backstage', 1]])], note: 'MODEL-NOTE-C18' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C18', 'MODEL-NOTE-C18'],
        expect: {
          status: 200,
          notOfferedCount: 1,
          notOfferedIncludes: 'Anything explicit',
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C19',
    kind: 'hard_no',
    description: 'a custom free-text hard no is detected by the classifier (Gate 2 deviation 2)',
    customLimits: [{ id: 'lim_outdoors', text: 'Filming outdoors', mode: 'hard_no' }],
    turns: [
      {
        fan: 'Could we shoot the video outdoors, and swap to the floral studio?',
        classifier: [verdict(null, { limitIds: ['lim_outdoors'] })],
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C19', [['maya_setting_floral', 1]])], note: 'MODEL-NOTE-C19' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C19', 'MODEL-NOTE-C19'],
        expect: {
          status: 200,
          notOfferedCount: 1,
          notOfferedIncludes: 'Filming outdoors',
          suggestions: [{ title: 'Floral Studio', deltaCents: 1_000, newTotalCents: 13_500, budgetDifferenceCents: 1_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C20',
    kind: 'hard_no',
    description: 'the model\'s own notOffered entry matches no limit: the fixed generic sentence is used, never the model\'s words',
    turns: [
      {
        fan: 'Backstage please, and something else unusual too',
        model: [
          {
            reply: reply({ options: [option('MODEL-LABEL-C20', [['maya_setting_backstage', 1]])], notOffered: ['MODEL-NOTOFFERED-GENERIC-C20'], note: 'MODEL-NOTE-C20' }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C20', 'MODEL-NOTE-C20', 'MODEL-NOTOFFERED-GENERIC-C20'],
        expect: {
          status: 200,
          notOfferedCount: 1,
          notOfferedIncludes: 'isn’t something Maya offers',
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C21',
    kind: 'hard_no',
    description: 'checklist hard no via a different explicit word ("explicit")',
    turns: [
      {
        fan: 'Two extra minutes, and let’s make this explicit',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C21', [['maya_extra_minute', 2]])], note: 'MODEL-NOTE-C21' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C21', 'MODEL-NOTE-C21'],
        expect: {
          status: 200,
          notOfferedCount: 1,
          notOfferedIncludes: 'Anything explicit',
          suggestions: [{ title: 'Extra minute × 2', deltaCents: 8_000, newTotalCents: 20_500, budgetDifferenceCents: -5_500 }],
          directorCalls: 1,
        },
      },
    ],
  },

  // ----------------------------------------------------------------- ask_me (2)
  {
    id: 'C22',
    kind: 'ask_me',
    description: 'a custom ask-me limit adds the "ask first" notice to the one suggestion',
    customLimits: [{ id: 'lim_leo', text: 'Scenes with my partner, Leo', mode: 'ask_me' }],
    turns: [
      {
        fan: 'Floral studio, and could Leo join in?',
        classifier: [verdict(null, { limitIds: ['lim_leo'] })],
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C22', [['maya_setting_floral', 1]])], note: 'MODEL-NOTE-C22' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C22', 'MODEL-NOTE-C22'],
        expect: {
          status: 200,
          suggestions: [
            {
              title: 'Floral Studio',
              deltaCents: 1_000,
              newTotalCents: 13_500,
              budgetDifferenceCents: 1_500,
              askFirstCount: 1,
              askFirstLimit: 'Scenes with my partner, Leo',
            },
          ],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C23',
    kind: 'ask_me',
    description: 'a custom ask-me limit is attached to every suggestion in the turn, not just one',
    customLimits: [{ id: 'lim_pet', text: 'My cat appearing on camera', mode: 'ask_me' }],
    turns: [
      {
        fan: 'Could my cat be in the backstage shot, or maybe just add a minute?',
        classifier: [verdict(null, { limitIds: ['lim_pet'] })],
        model: [
          {
            reply: reply({
              options: [option('MODEL-LABEL-C23A', [['maya_setting_backstage', 1]]), option('MODEL-LABEL-C23B', [['maya_extra_minute', 1]])],
              note: 'MODEL-NOTE-C23',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C23A', 'MODEL-LABEL-C23B', 'MODEL-NOTE-C23'],
        expect: {
          status: 200,
          suggestions: [
            {
              title: 'Backstage',
              deltaCents: -2_000,
              newTotalCents: 10_500,
              budgetDifferenceCents: 4_500,
              askFirstCount: 1,
              askFirstLimit: 'My cat appearing on camera',
            },
            {
              title: 'Extra minute',
              deltaCents: 4_000,
              newTotalCents: 16_500,
              budgetDifferenceCents: -1_500,
              askFirstCount: 1,
              askFirstLimit: 'My cat appearing on camera',
            },
          ],
          directorCalls: 1,
        },
      },
    ],
  },

  // ------------------------------------------------------------ custom_request (3)
  {
    id: 'C24',
    kind: 'custom_request',
    description: 'a custom request is offered verbatim for the fan to confirm, never priced, under the default review policy',
    turns: [
      {
        fan: 'Could she hold up a sign for me?',
        model: [{ reply: reply({ customRequest: 'MODEL-CUSTOMREQUEST-C24' }) }],
        expect: { status: 200, reply: null, customRequest: true, customRequestText: 'MODEL-CUSTOMREQUEST-C24', suggestions: [], directorCalls: 1 },
      },
    ],
  },
  {
    id: 'C25',
    kind: 'custom_request',
    description: 'a custom request is dropped outright under a "decline" policy',
    customRequestPolicy: 'decline',
    turns: [
      {
        fan: 'Could she wear something special just for me?',
        model: [{ reply: reply({ customRequest: 'MODEL-CUSTOMREQUEST-C25' }) }],
        forbiddenSubstrings: ['MODEL-CUSTOMREQUEST-C25'],
        expect: { status: 200, customRequest: false, notOfferedCount: 1, suggestions: [], directorCalls: 1 },
      },
    ],
  },
  {
    id: 'C26',
    kind: 'custom_request',
    description: 'a custom request that touches a custom hard-no limit (via the output classifier) is dropped, with the limit named',
    customLimits: [{ id: 'lim_wig', text: 'Wearing a costume wig', mode: 'hard_no' }],
    turns: [
      {
        fan: 'Could she wear a wig for this one?',
        classifier: [verdict(null), verdict(null, { limitIds: ['lim_wig'] })],
        model: [{ reply: reply({ customRequest: 'MODEL-CUSTOMREQUEST-C26' }) }],
        forbiddenSubstrings: ['MODEL-CUSTOMREQUEST-C26'],
        expect: {
          status: 200,
          customRequest: false,
          notOfferedCount: 1,
          notOfferedIncludes: 'Wearing a costume wig',
          suggestions: [],
          directorCalls: 1,
        },
      },
    ],
  },

  // ----------------------------------------------------------------- vague (2)
  {
    id: 'C27',
    kind: 'vague',
    description: 'a vague message: the model\'s clarifying question is shown to the fan verbatim',
    turns: [
      {
        fan: 'Surprise me, I don’t know what I want',
        model: [{ reply: reply({ clarifyingQuestion: 'Would you like something cozy or something bright?' }) }],
        expect: {
          status: 200,
          reply: null,
          clarifyingQuestion: 'Would you like something cozy or something bright?',
          suggestions: [],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C28',
    kind: 'vague',
    description: 'a message the model can\'t turn into anything: the fixed "nothing to suggest" sentence',
    turns: [
      {
        fan: 'Hmm, just do something, whatever',
        model: [{ reply: reply() }],
        expect: {
          status: 200,
          reply: 'I couldn’t turn that into a change from Maya’s catalog. Try naming a setting, a greeting or the length.',
          clarifyingQuestion: null,
          customRequest: false,
          notOfferedCount: 0,
          suggestions: [],
          directorCalls: 1,
        },
      },
    ],
  },

  // --------------------------------------------------------- richer_longer (2)
  {
    id: 'C29',
    kind: 'richer_longer',
    description: 'demo mapping: "richer" is the detailed greeting',
    turns: [
      {
        fan: 'Can you make it feel richer?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C29', [['maya_greeting_detailed', 1]])], note: 'MODEL-NOTE-C29' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C29', 'MODEL-NOTE-C29'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Detailed Greeting', deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C30',
    kind: 'richer_longer',
    description: 'demo mapping: "longer" is one extra minute with the standard greeting',
    turns: [
      {
        fan: 'Can we make it longer instead?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C30', [['maya_extra_minute', 1]])], note: 'MODEL-NOTE-C30' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C30', 'MODEL-NOTE-C30'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Extra minute', deltaCents: 4_000, newTotalCents: 16_500, budgetDifferenceCents: -1_500 }],
          directorCalls: 1,
        },
      },
    ],
  },

  // ---------------------------------------------------------------- multi_turn (2)
  {
    id: 'C31',
    kind: 'multi_turn',
    description: 'turn 1 accepts a detailed greeting; turn 2 prices from the new draft',
    turns: [
      {
        fan: 'Make the greeting richer',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C31A', [['maya_greeting_detailed', 1]])], note: 'MODEL-NOTE-C31A' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C31A', 'MODEL-NOTE-C31A'],
        accept: 0,
        expect: {
          status: 200,
          suggestions: [{ title: 'Detailed Greeting', deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500 }],
          directorCalls: 1,
        },
      },
      {
        fan: 'Now can we make it longer too?',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C31B', [['maya_extra_minute', 1]])], note: 'MODEL-NOTE-C31B' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C31B', 'MODEL-NOTE-C31B'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Extra minute', deltaCents: 4_000, newTotalCents: 18_500, budgetDifferenceCents: -3_500 }],
          directorCalls: 1,
        },
      },
    ],
  },
  {
    id: 'C32',
    kind: 'multi_turn',
    description: 'turn 1 accepts a backstage swap; turn 2 builds on the accepted revision',
    turns: [
      {
        fan: 'Let’s do the backstage look',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C32A', [['maya_setting_backstage', 1]])], note: 'MODEL-NOTE-C32A' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C32A', 'MODEL-NOTE-C32A'],
        accept: 0,
        expect: {
          status: 200,
          suggestions: [{ title: 'Backstage', deltaCents: -2_000, newTotalCents: 10_500, budgetDifferenceCents: 4_500 }],
          directorCalls: 1,
        },
      },
      {
        fan: 'Add two extra minutes now',
        model: [{ reply: reply({ options: [option('MODEL-LABEL-C32B', [['maya_extra_minute', 2]])], note: 'MODEL-NOTE-C32B' }) }],
        forbiddenSubstrings: ['MODEL-LABEL-C32B', 'MODEL-NOTE-C32B'],
        expect: {
          status: 200,
          suggestions: [{ title: 'Extra minute × 2', deltaCents: 8_000, newTotalCents: 18_500, budgetDifferenceCents: -3_500 }],
          directorCalls: 1,
        },
      },
    ],
  },

  // -------------------------------------------------------------------- stale (1)
  {
    id: 'C33',
    kind: 'stale',
    description: 'accepting a second suggestion after the draft already moved is refused as out of date',
    turns: [
      {
        fan: 'Richer, or longer - what do you think?',
        model: [
          {
            reply: reply({
              options: [option('MODEL-LABEL-C33A', [['maya_greeting_detailed', 1]]), option('MODEL-LABEL-C33B', [['maya_extra_minute', 1]])],
              note: 'MODEL-NOTE-C33',
            }),
          },
        ],
        forbiddenSubstrings: ['MODEL-LABEL-C33A', 'MODEL-LABEL-C33B', 'MODEL-NOTE-C33'],
        accept: 0,
        staleAcceptIndex: 1,
        expect: {
          status: 200,
          reply: 'Two ways to do it. Pick one, both, or neither.',
          suggestions: [
            { title: 'Detailed Greeting', deltaCents: 2_000, newTotalCents: 14_500, budgetDifferenceCents: 500 },
            { title: 'Extra minute', deltaCents: 4_000, newTotalCents: 16_500, budgetDifferenceCents: -1_500 },
          ],
          directorCalls: 1,
        },
      },
    ],
  },

  // -------------------------------------------------------- boundary_violation (2)
  {
    id: 'C34',
    kind: 'boundary_violation',
    description: 'the rules layer blocks a hard-list string before any provider call: incest',
    turns: [
      {
        fan: 'an incest theme',
        expect: { status: 422, error: 'hard_list_blocked', key: 'incest', lines: ['Sex between relatives'], field: 'fan_message', directorCalls: 0 },
      },
    ],
  },
  {
    id: 'C35',
    kind: 'boundary_violation',
    description: 'the rules layer blocks a hard-list string before any provider call: solicitation',
    turns: [
      {
        fan: 'meet me in person after the shoot',
        expect: {
          status: 422,
          error: 'hard_list_blocked',
          key: 'solicitation',
          lines: ['Meeting in person, or paying for sex off camera'],
          field: 'fan_message',
          directorCalls: 0,
        },
      },
    ],
  },
]
