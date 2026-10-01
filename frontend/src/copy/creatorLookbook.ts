/* -------------------------------------------------------------------------- */
/*  The creator's lookbook editor, in both builds.                             */
/*                                                                            */
/*  The demo holds everything in memory, so it must never say saved. Staging   */
/*  saves to the creator's account, and says exactly that much: fans don't     */
/*  see a lookbook yet (the fan journey there still uses the priced catalog    */
/*  only), and images save only where the site has storage for them.           */
/* -------------------------------------------------------------------------- */

import { creatorErrorMessage } from './creatorRequests'

export const lookbookCopy = {
  eyebrowDemo: 'Creator demo controls',
  eyebrowAccount: 'Your lookbook',
  title: 'Build your studio profile',
  introDemo: 'Customize your brand, voice, limits, categories and images. This demo makes no account changes; everything resets when you refresh.',
  introAccount: 'Your brand, voice, limits, categories and images. Changes save to your creator account when you press Save changes.',
  fansDontSeeYet: 'Fans don’t see your lookbook yet. Their requests still use your priced catalog; showing these choices to fans is the next step.',
  joinByInvitation: 'Creators join Fan Director Studio by invitation.',
  applyLinkLabel: 'Apply as a founding creator',
  previewFanChoices: 'Preview fan choices',
  previewHeading: 'How fans will see your choices',
  previewNote: 'A preview only. Picks here aren’t kept and nobody else sees them.',

  brandNoteDemo: 'Changes preview across the demo as you make them.',
  brandNoteAccount: 'Changes preview on this page as you make them, and save with the rest.',
  limitsNote: 'Write one item per line, up to 10 each. These are your additions to the limits below.',
  fixedLimitsHeading: 'Already applied to every request',
  fixedLimitsAccount: 'Your catalog’s limits and the platform’s rules still apply. These lines add to them.',
  categoriesNote: 'Set how many items a fan may choose in each category. They can always leave it to your preference.',
  emptyCategory: 'This category is empty. Add its first image below.',
  adultLocked: 'Adult · off on this site. Fans don’t see this category, and it can’t hold images until adult content is enabled for your account.',
  uploadsUnavailable: 'Image uploads aren’t available on this site yet. Names, categories, limits and colours still save.',
  itemAddedDemo: 'Item added for this demo visit.',
  itemAddedAccount: 'Image uploaded. Press Save changes to keep it in your lookbook.',
  uniqueName: 'Use a unique category name.',
  nameAndImage: 'Name the item and choose an image.',

  unsaved: 'You have unsaved changes.',
  allSaved: 'All changes saved to your account.',
  neverSaved: 'Not saved yet. This is your starting point.',
  saving: 'Saving…',
  save: 'Save changes',
  discard: 'Discard changes',
  loading: 'Loading your lookbook…',
  signedOut: 'Sign in with your creator account to edit your lookbook. A fan account can’t open this page.',
} as const

/** What the creator reads when the API refuses something. Never a raw code. */
export function lookbookErrorMessage(status: number, error: string, body: Record<string, unknown>): string {
  switch (error) {
    case 'revision_conflict':
      return 'Your lookbook was saved somewhere else (another tab?) after you opened it. Reload to see the latest, then make your changes again.'
    case 'unknown_media':
      return 'One of the images isn’t one of your uploads. Remove it and upload it again.'
    case 'adult_content_disabled':
      return 'Adult categories can’t hold images on this site. Remove those images and save again.'
    case 'media_storage_unavailable':
      return lookbookCopy.uploadsUnavailable
    case 'media_limit_reached':
      return `You’ve reached the limit of ${typeof body.limit === 'number' ? body.limit : 300} uploaded images.`
    case 'invalid_image':
    case 'unsupported_media_type':
      return 'That file isn’t a JPG, PNG or WebP image this site can use.'
    case 'body_too_large':
      return 'That is too large to save. Try a smaller image, or fewer, shorter lines.'
    case 'invalid_profile':
      return 'Something in the lookbook couldn’t be saved: check for empty names or very long text, then try again.'
    case 'network':
      return 'Couldn’t reach the server. Check your connection and try again.'
    default:
      if (status === 401 || error === 'signed_out' || error === 'not_a_creator' || error === 'second_factor_required') {
        return creatorErrorMessage(status, error, body)
      }
      return 'Your lookbook couldn’t be saved. Try again in a moment.'
  }
}
