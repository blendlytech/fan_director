import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 17, state E: the fan used all 20 Director replies for this Scene   */
/*  Card. Like DirectorUnavailable, the contract gives no creatorName prop,   */
/*  so "Maya's catalog" is kept literal as the design has it.                 */
/* -------------------------------------------------------------------------- */

export function RepliesExhausted({ onCatalog }: { onCatalog: () => void }) {
  return (
    <div role="status" className="rounded-card border border-divider bg-panel p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Icon icon="lucide:message-square-off" width={20} />
        </div>
        <h3 className="font-sans text-base font-semibold">You&rsquo;ve used all 20 Director replies</h3>
      </div>
      <p className="mb-4 text-sm leading-relaxed">
        That&rsquo;s the limit for one Scene Card. You can still change anything from Maya&rsquo;s catalog, and
        review and send when you&rsquo;re ready.
      </p>
      <button
        type="button"
        onClick={onCatalog}
        className="inline-flex min-h-[44px] items-center justify-center rounded-card bg-espresso px-5 text-sm font-medium text-cream transition-colors duration-160 hover:bg-black focus-ring"
      >
        Choose from the catalog
      </button>
    </div>
  )
}
