import { Link, useLocation } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'

/* -------------------------------------------------------------------------- */
/*  Page not found — catch-all for any path outside the demo's fixed set of    */
/*  screens.                                                                   */
/*                                                                            */
/*  Built from design draft 12-page-not-found.html. Deployed as a static SPA   */
/*  (every unknown path serves index.html), so this is the client-side fix    */
/*  for what would otherwise render a blank page. Shows the exact address the  */
/*  fan asked for and offers real routes instead of guessing an address.       */
/* -------------------------------------------------------------------------- */

export function NotFound() {
  const { pathname, search, hash } = useLocation()
  const requestedPath = `${pathname}${search}${hash}`

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-16 text-center sm:px-6 lg:py-24">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Icon icon="lucide:map-pin-off" width={28} className="text-rose-deep" />
        </div>

        <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-muted">
          Page not found
        </p>
        <h1 className="mb-5 text-4xl font-semibold leading-tight tracking-tight text-espresso sm:text-5xl">
          This page isn&rsquo;t part of the demo
        </h1>
        <p className="mx-auto mb-6 max-w-[520px] text-base leading-relaxed text-muted">
          There&rsquo;s nothing at this address. Maya Atelier is a design demo with a fixed set of
          screens, so a mistyped or outdated link ends up here.
        </p>

        {/* The address that was requested, so the fan can see what went wrong */}
        <div className="mx-auto mb-10 inline-flex max-w-full flex-wrap items-baseline justify-center gap-x-2 gap-y-1 rounded-card border border-divider bg-panel px-4 py-2.5">
          <span className="shrink-0 text-xs text-muted">You asked for</span>
          <code className="break-all font-mono text-sm text-espresso">{requestedPath}</code>
        </div>

        <div className="mb-12 flex flex-col justify-center gap-3 sm:flex-row">
          <Button to="/" variant="primary" size="md" icon="lucide:arrow-right">
            Back to collection
          </Button>
          <Button to="/ai-director" variant="secondary" size="md">
            Open the Director
          </Button>
        </div>

        {/* Other real places, so nobody has to guess an address */}
        <div className="border-t border-divider pt-8 text-left sm:text-center">
          <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-wider text-muted">
            Other places in the demo
          </h2>
          <ul className="flex flex-col gap-1 sm:flex-row sm:justify-center sm:gap-8">
            <li>
              <Link
                to="/saved"
                className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium underline decoration-divider underline-offset-4 hover:decoration-espresso focus-ring"
              >
                <Icon icon="lucide:bookmark" width={16} className="text-rose-deep" />
                Saved ideas
              </Link>
            </li>
            <li>
              <Link
                to="/creator/requests"
                className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium underline decoration-divider underline-offset-4 hover:decoration-espresso focus-ring"
              >
                <Icon icon="lucide:inbox" width={16} className="text-rose-deep" />
                Creator request queue
              </Link>
            </li>
          </ul>
          <p className="mt-6 flex items-start gap-2 text-xs text-muted sm:items-center sm:justify-center">
            <Icon icon="lucide:info" width={14} className="mt-0.5 shrink-0 sm:mt-0" />
            Opening an address directly starts a fresh draft. Nothing from before was saved.
          </p>
        </div>
      </main>
    </div>
  )
}
