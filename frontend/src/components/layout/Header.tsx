import { Link, NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'

// `to` is omitted for sections the prototype does not implement; those render inert.
export type HeaderLink = { label: string; to?: string }

const fanLinks: HeaderLink[] = [
  { label: 'Collection', to: '/' },
  { label: 'Your studio', to: '/ai-director' },
  { label: 'Saved ideas', to: '/saved' },
]

export function Header({ links = fanLinks }: { links?: HeaderLink[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-divider bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[80px] max-w-container items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="font-serif text-2xl font-medium tracking-tight sm:text-3xl focus-ring">
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
                    'text-sm font-medium transition-colors duration-160 hover:text-muted focus-ring',
                    isActive && 'text-rose-deep',
                  )
                }
              >
                {link.label}
              </NavLink>
            ) : (
              <span key={link.label} aria-disabled className="text-sm font-medium text-muted/60">
                {link.label}
              </span>
            ),
          )}
        </nav>
      </div>
    </header>
  )
}
