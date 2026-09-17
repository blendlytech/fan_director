/** Clerk is on only when a publishable key is configured (frontend/.env.local).
 *  Without one the app is the unchanged demo: no provider, no auth controls. */
export const clerkPublishableKey: string | undefined =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined

export const authEnabled = Boolean(clerkPublishableKey)

/** Brand tokens from docs/specs/02-design-system.md, so Clerk's sign-in and
 *  account screens sit inside the boutique's look. */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#302720',
    colorText: '#302720',
    colorTextSecondary: '#70625C',
    colorBackground: '#FFFFFF',
    colorInputBackground: '#FFFFFF',
    colorDanger: '#9E3B2C',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '12px',
  },
}
