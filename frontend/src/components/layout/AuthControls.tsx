import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { authEnabled } from '../../auth/clerk'
import { cn } from '../../lib/cn'

/** Sign-in, sign-up and signed-in controls for the header (design 16).
 *  Renders nothing when Clerk isn't configured, so the demo is unchanged. */
export function AuthControls({ variant }: { variant: 'desktop' | 'menu' }) {
  if (!authEnabled) return null

  const menu = variant === 'menu'

  return (
    <div className={cn('flex items-center', menu ? 'gap-3 px-4 py-4 sm:px-6' : 'gap-4')}>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center text-sm font-medium underline decoration-espresso underline-offset-4 transition-colors duration-160 hover:text-muted focus-ring"
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center rounded-card bg-rose px-4 text-sm font-medium text-espresso shadow-sm transition-colors duration-160 hover:bg-rose-hover focus-ring"
          >
            Create account
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
          <UserButton />
        </div>
      </Show>
    </div>
  )
}
