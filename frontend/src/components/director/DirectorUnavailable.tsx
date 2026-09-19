import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 17, state D: the Director failed, timed out, or is turned off.     */
/*  The design's "Choose from the catalog" control is an <a href="#catalog">  */
/*  since the static mockup just scrolls; here it's a real callback so the    */
/*  caller can open CatalogSheet, so it's rendered as a button instead of an  */
/*  anchor with no real destination.                                          */
/* -------------------------------------------------------------------------- */

type Props = { onCatalog: () => void; onRetry: () => void }

export function DirectorUnavailable({ onCatalog, onRetry }: Props) {
  return (
    <div role="alert" className="rounded-card border border-divider bg-panel p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Icon icon="lucide:cloud-off" width={20} />
        </div>
        <h3 className="font-sans text-base font-semibold">The Director can&rsquo;t reply right now</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed">
        Your Scene Card is safe and nothing was changed. You can keep building it from Maya&rsquo;s catalog.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCatalog}
          className="inline-flex min-h-[44px] items-center justify-center rounded-card bg-espresso px-5 text-sm font-medium text-cream transition-colors duration-160 hover:bg-black focus-ring"
        >
          Choose from the catalog
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] items-center justify-center rounded-card border border-divider px-5 text-sm font-medium transition-colors duration-160 hover:bg-secondary focus-ring"
        >
          Try again
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">A failed reply doesn&rsquo;t use one of your replies.</p>
    </div>
  )
}
