import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Icon } from '../common/Icon'

// `to` is omitted for sections the prototype does not implement; those render inert.
export type HeaderLink = { label: string; to?: string }

const fanLinks: HeaderLink[] = [
  { label: 'Collection', to: '/' },
  { label: 'Your studio', to: '/ai-director' },
  { label: 'Saved ideas', to: '/saved' },
]

/** Tailwind's `md` breakpoint — the desktop nav takes over from here. */
const DESKTOP_QUERY = '(min-width: 768px)'

export function Header({ links = fanLinks }: { links?: HeaderLink[] }) {
  const { pathname } = useLocation()
  // The menu remembers the path it was opened on, so any route change closes it
  // without a state-syncing effect.
  const [openOn, setOpenOn] = useState<string | null>(null)
  // Forget a stale path during render. The creator dashboard's Header stays mounted
  // while its modal routes change, so browser Back/Forward returning to the path
  // would otherwise reopen the menu on its own.
  if (openOn !== null && openOn !== pathname) setOpenOn(null)
  const open = openOn === pathname
  const menuId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)

  const close = () => setOpenOn(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenOn(null)
      toggleRef.current?.focus()
    }

    // Never leave the disclosure stuck open once the desktop nav is showing.
    const desktop = window.matchMedia(DESKTOP_QUERY)
    function onBreakpoint() {
      if (desktop.matches) setOpenOn(null)
    }

    // Keep the dimmed page from scrolling behind the menu.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onBreakpoint)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onBreakpoint)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 border-b border-divider',
        // backdrop-filter would make the header the containing block for the fixed
        // overlay, so the open menu uses a solid background instead. z-50 lifts the
        // menu above page-level fixed bars (z-40).
        open ? 'z-50 bg-cream' : 'z-40 bg-cream/95 backdrop-blur-sm',
      )}
    >
      <div className="mx-auto flex h-[80px] max-w-container items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center font-serif text-2xl font-medium tracking-tight sm:text-3xl focus-ring"
          >
            Maya Atelier
          </Link>
          <span className="inline-flex items-center rounded border border-divider bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted sm:text-xs">
            Demo
          </span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) =>
            link.to ? (
              <NavLink
                key={link.label}
                to={link.to}
                end
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-[44px] items-center text-sm font-medium transition-colors duration-160 hover:text-muted focus-ring',
                    isActive && 'text-rose-deep',
                  )
                }
              >
                {link.label}
              </NavLink>
            ) : (
              <span
                key={link.label}
                aria-disabled
                className="inline-flex min-h-[44px] items-center text-sm font-medium text-muted/60"
              >
                {link.label}
              </span>
            ),
          )}
        </nav>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenOn(open ? null : pathname)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-card px-3 text-sm font-medium text-espresso transition-colors duration-160 hover:bg-secondary focus-ring md:hidden"
        >
          <Icon icon={open ? 'lucide:x' : 'lucide:menu'} width={18} />
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div
          aria-hidden
          data-testid="mobile-menu-overlay"
          onClick={close}
          className="fixed inset-x-0 bottom-0 top-[80px] bg-espresso/30 md:hidden"
        />
      )}
      {/* Kept mounted (hidden) so the toggle's aria-controls always resolves. */}
      <nav
        id={menuId}
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-divider bg-panel shadow-modal md:hidden"
      >
        <ul>
          {links.map((link) => (
            <li key={link.label} className="border-b border-divider">
              {link.to ? (
                <NavLink
                  to={link.to}
                  end
                  onClick={close}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-[56px] items-center justify-between px-4 text-base font-medium transition-colors duration-160 hover:bg-secondary focus-ring sm:px-6',
                      isActive ? 'border-l-2 border-l-rose-deep text-rose-deep' : 'text-espresso',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      <Icon
                        icon="lucide:chevron-right"
                        width={18}
                        className={isActive ? 'text-rose-deep' : 'text-muted'}
                      />
                    </>
                  )}
                </NavLink>
              ) : (
                <span
                  aria-disabled
                  className="flex min-h-[56px] items-center px-4 text-base font-medium text-muted/60 sm:px-6"
                >
                  {link.label}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 px-4 py-4 text-xs text-muted sm:px-6">
          <Icon icon="lucide:info" width={16} className="shrink-0" />
          Demo — nothing you make here is saved or sent.
        </p>
      </nav>
    </header>
  )
}
