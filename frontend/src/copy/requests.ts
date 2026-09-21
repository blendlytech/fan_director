/* -------------------------------------------------------------------------- */
/*  Fan-facing wording for sent requests (Phase 4, staging only).             */
/*                                                                            */
/*  These screens have no design (owner decision, doc 11 §5.6 item 26), so    */
/*  every sentence lives here for the owner's wording review. Rules:          */
/*  - say "sent", "approved" or "declined" only for what the server returned; */
/*  - in-app only: never say an email or notification was sent;               */
/*  - payment happens on the creator's own platform; a payment is only ever   */
/*    "marked as received by <creator>", never "paid" or "confirmed".         */
/* -------------------------------------------------------------------------- */

import type { CommissionStatus } from '../api/types'

export const requestsCopy = {
  listTitle: 'Your requests',
  listIntro: (creator: string) => `Requests you've sent to ${creator}. Check back here for answers; there are no emails.`,
  listEmpty: 'You haven’t sent any requests yet.',
  listError: 'Your requests couldn’t be loaded. Check your connection and try again.',
  signedOut: 'Sign in to see the requests you’ve sent.',
  needsYou: 'Needs your answer',
  sentOn: (date: string) => `Sent ${date}`,
  updatedOn: (date: string) => `Updated ${date}`,

  status: (status: CommissionStatus, creator: string): string => {
    switch (status) {
      case 'in_review':
        return `With ${creator} for review`
      case 'question_open':
        return `${creator} asked you a question`
      case 'proposal_open':
        return `${creator} suggested changes`
      case 'approved':
        return `Approved by ${creator}`
      case 'declined':
        return `Declined by ${creator}`
      case 'withdrawn':
        return 'You withdrew this request'
      case 'closed':
        return 'Closed'
    }
  },

  detailTitle: (creator: string) => `Your request to ${creator}`,
  reference: (id: string) => `Request ${id.slice(0, 8).toUpperCase()}`,
  justSent: (creator: string) =>
    `Sent to ${creator}. ${creator} will review it and answer here. There are no emails, so check back on this page.`,
  inReview: (creator: string) => `${creator} is reviewing your request. Their answer will appear here.`,

  questionHeading: (creator: string) => `${creator} asked`,
  replyLabel: 'Your answer',
  replySend: 'Send answer',
  replySent: (creator: string) => `Answer sent to ${creator}.`,

  proposalHeading: (creator: string) => `${creator} suggested changes`,
  proposalIntro: (creator: string) =>
    `${creator} can only approve a version you’ve accepted. Accept these changes, or keep your request as it was.`,
  proposalAccept: 'Accept these changes',
  proposalReject: 'Keep my request as it was',
  proposalAccepted: (creator: string) => `You accepted the changes. ${creator} can now approve them.`,
  proposalRejected: (creator: string) => `You kept your request as it was. ${creator} will review it again.`,
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  totalWas: 'Before',
  totalNow: 'With these changes',

  approved: (creator: string, date: string) =>
    `Approved by ${creator} on ${date}. You pay ${creator} on their own platform; nothing is charged here.`,
  paymentReported: (creator: string, date: string) => `${creator} marked your payment as received on ${date}.`,
  declined: (creator: string) => `${creator} declined this request.`,
  declinedReason: (creator: string) => `${creator}’s reason`,
  withdrawn: 'You withdrew this request. Nothing more will happen with it.',
  closed: 'This request is closed.',

  termsHeading: 'What you asked for',
  approvedTermsHeading: 'The approved version',
  customRequest: 'Your custom request',
  customRequestPriced: (creator: string, price: string) => `Priced by ${creator}: ${price}`,
  customRequestUnpriced: (creator: string) => `Not priced yet. ${creator} sets the price before approving.`,
  estimatedTotal: 'Estimated total',
  approvedTotal: 'Approved total',
  deliveryRule: (days: number) => `About ${days} days after you pay, confirmed by the creator.`,

  historyHeading: 'Messages',
  youLabel: 'You',

  withdraw: 'Withdraw request',
  withdrawTitle: 'Withdraw this request?',
  withdrawBody: (creator: string) => `${creator} won’t be able to approve it, and you can’t undo this.`,
  withdrawConfirm: 'Withdraw',
  withdrawKeep: 'Keep it',

  changedElsewhere: 'This request changed while you were looking at it. Here’s the latest.',
  failed: 'That didn’t work. Nothing changed. Try again.',
  blocked: 'Your answer can’t be sent. Please change it and try again.',

  /** The menu line. The demo's "nothing is saved or sent" is untrue on staging, which saves and sends. */
  menuStaging: 'Staging — your draft is saved to your account, and you can send it for review.',
  navRequests: 'Your requests',

  /* Saved ideas, staging only. The demo's page is written for a build with no
     backend ("This demo saves nothing"); staging has saved signed-in fans'
     drafts since design 18 (owner-approved 2026-09-18), so it can't say that. */
  savedStagingSignedIn: 'Your draft is saved to your account as you work, so it’s here when you come back. Sending it to the creator is a separate step.',
  savedStagingSignedOut: 'Sign in to keep your draft on your account. Until then it lives in this tab only, and refreshing clears it.',
  savedDraftHeadingStaging: 'Your draft',
  savedDraftHeadingSignedOut: 'In this tab right now — not saved',
  savedDraftBadgeStaging: 'Draft · saved to your account',
  savedDraftBadgeSignedOut: 'Draft · this tab only',

  // Review page, staging only (the demo copy stays word for word).
  /** Staging, signed out: sending needs an account, and nothing has been sent. */
  reviewIntroSignedOut: (creator: string) =>
    `Sign in to send this to ${creator}. Nothing has been sent, and nothing is charged here.`,
  reviewIntroStaging: (creator: string) =>
    `Sending asks ${creator} to review your Scene Card. They can approve it, suggest changes, or ask you a question, and you’ll see their answer under Your requests. Nothing is charged here.`,
  send: 'Send to Creator',
  sending: 'Sending…',
  sendFailed: 'Your request wasn’t sent. Nothing changed. Try again.',
  sendStale: 'Prices changed since you last looked. Review the new prices, then send.',
  sendAlready: 'This draft was already sent.',
}
