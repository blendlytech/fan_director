import { useSyncExternalStore } from 'react'

/**
 * A small bridge between Clerk and code that runs outside React components
 * (the API client). ClerkBridge, rendered inside ClerkProvider, keeps it up
 * to date. In the demo build there is no Clerk, so the fan is never signed in
 * and no token is ever sent.
 *
 * Tokens are fetched fresh for every request and never stored.
 */

type TokenGetter = () => Promise<string | null>

let getToken: TokenGetter | null = null
let signedIn: boolean | null = null // null: Clerk hasn't loaded yet
const listeners = new Set<() => void>()

export function updateSession(next: { signedIn: boolean | null; getToken: TokenGetter | null }): void {
  getToken = next.getToken
  if (signedIn !== next.signedIn) {
    signedIn = next.signedIn
    listeners.forEach((l) => l())
  }
}

export async function sessionToken(): Promise<string | null> {
  return getToken ? getToken() : null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** true / false once known; null while Clerk is still loading. */
export function useSignedIn(): boolean | null {
  return useSyncExternalStore(subscribe, () => signedIn, () => null)
}
