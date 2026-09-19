import { useEffect } from 'react'
import { useAuth } from '@clerk/react'
import { updateSession } from './session'

/** Rendered inside ClerkProvider only: shares the session with the API client. */
export function ClerkBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  useEffect(() => {
    updateSession({ signedIn: isLoaded ? Boolean(isSignedIn) : null, getToken: isSignedIn ? () => getToken() : null })
  }, [isLoaded, isSignedIn, getToken])
  return null
}
