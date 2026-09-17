// Mock data for the creator's request queue.
// Transcribed from docs/designs/html/03-creator-dashboard-linked-navigation.html (the 6 queue
// cards) and docs/designs/html/05-creator-detail-modal-connected-navigation.html (the full
// scene-card detail shown for the "Vintage Lounge Greeting" request from @sarah_smiles).
//
// This is a demo: there is no backend, so every request lives in this one array. Fields that
// the design drafts never specify (e.g. an exact submission timestamp) are left as light,
// clearly-synthetic metadata rather than invented copy — see `submittedAt` below.

import type { RequestStatus } from '../components/common/StatusBadge'

export type SceneComponent = {
  /** Icon name for the <Icon /> component, e.g. "lucide:video" */
  icon: string
  label: string
  value: string
}

export type LineItem = {
  label: string
  amount: number
}

/** Full scene-card detail, only known for requests the drafts actually show a modal for. */
export type RequestDetail = {
  fanFullName: string
  referenceImageUrl: string
  referenceImageAlt: string
  sceneComponents: SceneComponent[]
  lineItems: LineItem[]
  estimatedTotal: number
  budgetRemaining: string
  deliveryTimeline: string
  /** The fan's note/message, shown verbatim (including their own quotation marks) in the draft. */
  fanNotes: string
}

export type Request = {
  /** URL-safe slug used in the route /creator/requests/:id */
  id: string
  fanHandle: string
  /** Two-letter initials avatar (used when the draft shows an initials circle, not an image). */
  avatarInitials?: string
  avatarImageUrl?: string
  avatarAlt?: string
  status: RequestStatus
  title: string
  description: string
  /** Label for the price figure in the card footer: "Estimated Total" | "Proposed Total" | "Final Total" */
  totalLabel: string
  total: number
  /** Present only for the "Proposed Changes" card, to render the struck-through original price. */
  previousTotal?: number
  /** Right-hand footer label, e.g. "Requested Delivery" or "Status". Omitted when `unresolvedCount` is set instead. */
  deliveryLabel?: string
  deliveryValue?: string
  /** Present only for the "Awaiting Reply" card, which shows an unresolved-question count instead of a delivery date. */
  unresolvedCount?: number
  /**
   * Synthetic submission date used only to drive the dashboard's "Sort: Date" control — the
   * drafts never state exact submission timestamps, only relative delivery dates, so these are
   * ordered to match the cards' order in the draft (most recent first).
   */
  submittedAt: string
  /** Full scene-card detail; only populated for the request the detail-modal draft depicts. */
  detail?: RequestDetail
}

export const requests: Request[] = [
  {
    id: 'sarah-smiles-vintage-lounge',
    fanHandle: '@sarah_smiles',
    avatarInitials: 'SS',
    status: 'new',
    title: 'Vintage Lounge Greeting',
    description:
      'Birthday message for my sister. 3-minute video duration with the standard vintage armchair setup. No special wardrobe requests.',
    totalLabel: 'Estimated Total',
    total: 145,
    deliveryLabel: 'Requested Delivery',
    deliveryValue: 'Dec 12 (in 5 days)',
    submittedAt: '2025-12-06',
    detail: {
      fanFullName: 'Sarah Smiles',
      referenceImageUrl:
        'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      referenceImageAlt: 'Vintage lounge reference',
      sceneComponents: [
        { icon: 'lucide:video', label: 'Duration', value: '3-Minute Video' },
        { icon: 'lucide:armchair', label: 'Setting', value: 'Standard Vintage Armchair' },
        { icon: 'lucide:message-square-heart', label: 'Personalization', value: 'Birthday Message' },
        { icon: 'lucide:shirt', label: 'Wardrobe', value: "Creator's Choice (Standard)" },
      ],
      lineItems: [
        { label: 'Base Video (3-min)', amount: 90 },
        { label: 'Vintage Lounge Setup', amount: 35 },
        { label: 'Personalized Greeting', amount: 20 },
      ],
      estimatedTotal: 145,
      budgetRemaining: '$5 remaining of $150',
      deliveryTimeline: '7 days after payment',
      fanNotes:
        '"Hi Maya! It\'s my sister\'s 30th birthday. She absolutely loves your vintage aesthetic. Could you just wish her a happy birthday and tell her I love her? No specific script needed, just your natural vibe!"',
    },
  },
  {
    id: 'alex-lumens-floral-studio',
    fanHandle: '@alex_lumens',
    avatarInitials: 'AL',
    status: 'alert',
    title: 'Floral Studio Scene',
    description:
      'Anniversary shoutout. Requested extra runtime (5 mins) which increases the base estimate. Awaiting fan approval on new price.',
    totalLabel: 'Proposed Total',
    total: 185,
    previousTotal: 120,
    deliveryLabel: 'Requested Delivery',
    deliveryValue: 'Dec 15',
    submittedAt: '2025-12-05',
  },
  {
    id: 'jamie-writes-backstage-moment',
    fanHandle: '@jamie_writes',
    avatarImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jamie',
    avatarAlt: 'Jamie',
    status: 'pending',
    title: 'Intimate Backstage Moment',
    description:
      'Need clarification on the specific script pronunciation before approving. Sent message 2 hours ago.',
    totalLabel: 'Estimated Total',
    total: 95,
    unresolvedCount: 1,
    submittedAt: '2025-12-05',
  },
  {
    id: 'maya-fan-floral-studio',
    fanHandle: '@maya_fan_88',
    avatarInitials: 'MK',
    status: 'new',
    title: 'Floral Studio Scene',
    description:
      'Standard 2-minute greeting. Selected the dusty rose backdrop from the approved catalog. Simple, straightforward request.',
    totalLabel: 'Estimated Total',
    total: 120,
    deliveryLabel: 'Requested Delivery',
    deliveryValue: 'Dec 18',
    submittedAt: '2025-12-04',
  },
  {
    id: 'chris-collector-vintage-lounge',
    fanHandle: '@chris_collector',
    avatarImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chris',
    avatarAlt: 'Chris',
    status: 'approved',
    title: 'Vintage Lounge Greeting',
    description:
      'Request approved. Awaiting fan payment confirmation before production begins. 7-day timeline starts post-payment.',
    totalLabel: 'Final Total',
    total: 165,
    deliveryLabel: 'Status',
    deliveryValue: 'Awaiting Payment',
    submittedAt: '2025-12-03',
  },
  {
    id: 'ryan-designs-backstage',
    fanHandle: '@ryan_t_designs',
    avatarInitials: 'RT',
    status: 'new',
    title: 'Intimate Backstage',
    description:
      'Just a quick 1-minute casual greeting. No script provided, just asked for "words of encouragement for an artist."',
    totalLabel: 'Estimated Total',
    total: 80,
    deliveryLabel: 'Requested Delivery',
    deliveryValue: 'Flexible',
    submittedAt: '2025-12-02',
  },
]

export function getRequestById(id: string | undefined): Request | undefined {
  if (!id) return undefined
  return requests.find((request) => request.id === id)
}
