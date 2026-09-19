/**
 * director-copy-v1: every sentence the Director shows a fan (doc 11 §8 Phase 3:
 * "all fan-facing sentences come from fixed, versioned templates"). Only
 * `clarifyingQuestion` (and a prefilled custom request the fan can edit) is
 * model text, and only after every check passed.
 *
 * Sources: design 17 B and design 13 C1–C2, verbatim where they apply. Lines
 * marked NEW have no design text yet and need the owner's wording approval
 * at the UI checkpoint. Prices are never in these strings: the screen renders
 * them from the server's quote.
 */

export const COPY_VERSION = 'director-copy-v1'

export const copy = {
  /** NEW (design 17 B shows the two-option form for one example). */
  introOne: () => 'Here’s one way to do it. Nothing changes until you add it.',
  /** Design 17 B: "Two ways to make it feel more special. Pick one, both, or neither." */
  introTwo: () => 'Two ways to do it. Pick one, both, or neither.',
  /** NEW: the model returned nothing the server could build or show. */
  nothingToSuggest: (creator: string) =>
    `I couldn’t turn that into a change from ${creator}’s catalog. Try naming a setting, a greeting or the length.`,
  /** Design 17 B footer. */
  pricesFooter: (creator: string) => `Prices come from ${creator}’s catalog, not from the Director. Nothing changes until you add it.`,

  /** Design 13 C2. */
  notOfferedHeading: (creator: string) => `${creator} doesn’t do this`,
  notOfferedLimit: (creator: string, limit: string) =>
    `“${limit}” is one of ${creator}’s limits, so it’s been left out of your plan. Everything else you asked for is still here.`,
  /** NEW: a not-offered entry that matches none of the creator's limits; never repeats the model's words. */
  notOfferedGeneric: (creator: string) =>
    `That isn’t something ${creator} offers, so it’s been left out of your plan. Everything else you asked for is still here.`,

  /** Design 13 C1. */
  askFirstHeading: (creator: string) => `Ask ${creator} first`,
  askFirstBody: (creator: string, limit: string) =>
    `This touches one of ${creator}’s limits: “${limit}.” You can add it. ${creator} may say no, or set a price for it after reading your request.`,
  askFirstAccept: (creator: string) => `Add and ask ${creator}`,
  askFirstDecline: () => 'Not this one',
  askFirstFootnote: (creator: string) => `No price is shown for this part yet. ${creator} sets it.`,

  /** NEW: offering the model's customRequest as a prefilled, editable custom request (design 19 prices it). */
  customRequestOffer: (creator: string) =>
    `This isn’t in ${creator}’s catalog. You can add it as a custom request: ${creator} reads it and sets the price.`,
  customRequestAccept: () => 'Add as custom request',
  customRequestDecline: () => 'Not this one',
} as const
