/* -------------------------------------------------------------------------- */
/*  Creator-facing wording for sent requests (Phase 4, staging only).          */
/*                                                                            */
/*  The demo's creator screens keep their own copy word for word; these        */
/*  sentences belong to the staging build, where a server really answers.      */
/*  Rules (doc 11 §3 rule 1, §5.6 item 26):                                    */
/*  - say approved, declined or sent only for what the server returned;        */
/*  - in-app only: never say the fan was emailed or notified;                  */
/*  - payment is always the creator's own report, never "paid" or "charged";   */
/*  - the fan's name is what they asked to be called, not a verified identity. */
/* -------------------------------------------------------------------------- */

import type { CommissionStatus } from '../api/types'

export const creatorCopy = {
  queueTitle: 'Request Queue',
  queueIntro: 'Requests fans have sent you. Your answer appears on the fan’s own requests page; there are no emails.',
  queueEmpty: 'No requests match this filter.',
  queueEmptyTitle: 'You’re all caught up',
  queueError: 'Your queue couldn’t be loaded. Check your connection and try again.',
  signedOut: 'Sign in as the creator to see your request queue.',
  notCreator: 'This account isn’t a creator account on this site.',
  secondFactorRequired: 'Creator pages need your authenticator app. Sign in again with your authenticator code, then reload this page.',
  secondFactorEnrol: 'Creator pages need an authenticator app on your account. Set one up in your account settings, then reload this page.',
  pendingDecisions: (n: number) => `${n} request${n === 1 ? '' : 's'} needs your decision`,

  /** Filters: only the statuses the server actually stores. There is no "awaiting payment". */
  filters: [
    { value: 'all', label: 'Status: All' },
    { value: 'in_review', label: 'Needs your decision' },
    { value: 'question_open', label: 'Waiting on the fan' },
    { value: 'proposal_open', label: 'Changes you proposed' },
    { value: 'approved', label: 'Approved' },
    { value: 'declined', label: 'Declined' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ] as const,
  sorts: [
    { value: 'updated-desc', label: 'Sort: Last activity' },
    { value: 'date-desc', label: 'Sort: Newest sent' },
    { value: 'date-asc', label: 'Sort: Oldest sent' },
    { value: 'price-desc', label: 'Sort: Total (high–low)' },
    { value: 'price-asc', label: 'Sort: Total (low–high)' },
  ] as const,

  status: (status: CommissionStatus): string => {
    switch (status) {
      case 'in_review':
        return 'Needs your decision'
      case 'question_open':
        return 'Waiting on the fan’s answer'
      case 'proposal_open':
        return 'Waiting on the fan to accept your changes'
      case 'approved':
        return 'Approved by you'
      case 'declined':
        return 'You declined this'
      case 'withdrawn':
        return 'The fan withdrew this'
      case 'closed':
        return 'Closed'
    }
  },

  /* The fan's identity is only what they typed (doc 11 §5.6 item 6, design 24 B). */
  fanNameHeading: 'The fan asked to be called',
  fanNameUnverified: 'Not verified',
  fanNameMissing: 'They didn’t give a name',

  sentOn: (date: string) => `Sent ${date}`,
  updatedOn: (date: string) => `Last activity ${date}`,
  reference: (id: string) => `Request ${id.slice(0, 8).toUpperCase()}`,
  customRequestBadge: 'Custom request',
  customRequestNeedsPrice: 'Needs a price',
  askFirstBadge: (n: number) => `${n} to OK first`,

  /* Detail: what the fan asked for. */
  termsHeading: 'What the fan asked for',
  versionsHeading: 'Versions',
  versionHeading: (seq: number) => `Version ${seq}`,
  versionCurrent: 'The version on the table',
  versionApproved: 'The version you approved',
  versionByFan: 'Sent by the fan',
  versionByYou: 'Proposed by you',
  versionAccepted: 'Accepted by the fan',
  versionOffered: 'Waiting on the fan',
  versionRejected: 'The fan kept their own version',
  versionSuperseded: 'Replaced by a later version',
  total: 'Total',
  deliveryRule: (days: number) => `About ${days} days after the fan pays you, confirmed by you.`,
  notesHeading: 'Notes from the fan',
  scriptHeading: 'The fan’s script',
  customRequestHeading: 'Custom request',
  customRequestUnpriced: 'Not priced yet. Price it through “Propose changes” before you approve.',
  customRequestPriced: (price: string) => `You priced this at ${price}.`,
  askFirstHeading: 'Past your usual limits',
  askFirstIntro: 'This request touches limits you set to “ask me”. Only you can accept, decline or price it.',
  historyHeading: 'Messages',
  youLabel: 'You',
  fanLabel: 'The fan',

  /* Decisions. */
  decisionHeading: 'Your decision',
  approve: 'Approve this version',
  approveOf: (seq: number, total: string) => `Approves version ${seq} for ${total}.`,
  approveBlockedUnpriced: 'Price the custom request first: approving a version with no price isn’t possible.',
  approveBlockedProposal: 'The fan hasn’t accepted your proposed changes yet.',
  approveBlockedQuestion: 'You asked the fan a question. You can approve once they answer.',
  approved: (seq: number, date: string) => `You approved version ${seq} on ${date}.`,
  /** Right after the server returns the approval; the dated line above comes from the record. */
  approvedJustNow: 'Approved. The fan sees this on their requests page. Nothing has been charged.',
  approvedNote: 'The fan sees this on their requests page. Nothing has been charged, here or anywhere else.',

  propose: 'Propose changes',
  proposeHeading: 'Propose changes',
  proposeIntro: 'Change what’s included, or price the custom request. The fan has to accept your version before you can approve it.',
  proposePriceLabel: 'Price for the custom request',
  proposePriceHelp: 'In US dollars. Leave it empty to leave the custom request unpriced.',
  proposeNoteLabel: 'Message to the fan (optional)',
  proposeEstimate: 'New total, worked out from your catalog',
  proposeEstimateNote: 'The server prices it again when you send, and the price it returns is the one that counts.',
  proposeUnchanged: 'Nothing has changed yet.',
  proposeInvalid: 'These choices don’t work together. Change them and try again.',
  proposeSend: 'Send to the fan',
  proposeCancel: 'Cancel',
  proposeSent: 'Sent. The fan has to accept these changes before you can approve them.',

  ask: 'Ask a question',
  askHeading: 'Ask a question',
  askIntro: 'The request waits for the fan’s answer. They see your question on their requests page.',
  askLabel: 'Your question',
  askSend: 'Send question',
  askSent: 'Sent. This request is waiting on the fan’s answer.',

  decline: 'Decline',
  declineHeading: 'Decline this request?',
  declineIntro: 'The fan sees that you declined it on their requests page. They can send a new request later.',
  declineReasonLabel: 'Reason for the fan (optional)',
  declineNoteLabel: 'Private note (optional, never shown to the fan)',
  declineConfirm: 'Decline this request',
  declineCancel: 'Cancel',
  declined: (date: string) => `You declined this on ${date}.`,
  declinedJustNow: 'Declined. The fan sees this on their requests page.',

  /* Payment: creator-reported, always. Never "paid" and never a timer. */
  paymentHeading: 'Payment',
  paymentOffPlatform: 'Fans pay you on your own platform. Nothing is charged here, and nothing is checked here.',
  paymentReport: 'Mark payment as received',
  paymentReportHelp: 'This records that you say the money arrived. It starts no clock and confirms nothing on its own.',
  paymentReported: (date: string) => `You marked payment as received on ${date}.`,
  paymentReportedJustNow: 'Recorded: you marked this payment as received.',

  backToQueue: 'Back to the queue',
  backToRequest: 'Back to the request',
  close: 'Close',
  missing: 'That request isn’t here.',
  /** A form reached by URL after the request moved on. The server would refuse it. */
  notOpenNow: 'This request has moved on since that link. There’s nothing to send here.',
  changedElsewhere: 'This request changed while you were looking at it. Here’s the latest.',
  failed: 'That didn’t work. Nothing changed. Try again.',
  blocked: 'That message can’t be sent. Please change it and try again.',
  charCount: (n: number, max: number) => `${n} / ${max} characters`,
}

/** Why the creator API said no, in the creator's own terms. */
export function creatorErrorMessage(status: number, error: string, body: Record<string, unknown>): string {
  if (status === 401 || error === 'signed_out') return creatorCopy.signedOut
  if (error === 'second_factor_required') return body.enrol === true ? creatorCopy.secondFactorEnrol : creatorCopy.secondFactorRequired
  if (error === 'not_a_creator') return creatorCopy.notCreator
  return creatorCopy.queueError
}
