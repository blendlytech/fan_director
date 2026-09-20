import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { clerkAppearance, clerkPublishableKey } from './auth/clerk'
import { ClerkBridge } from './auth/ClerkBridge'

// Dev server only, for browser checks. Production builds drop these branches
// entirely: /__preview/director is every Director and save state (designs 17,
// 13 C, 18), and /__preview/creator is the creator's Phase 4 screens (designs
// 03, 05, 06, 09) against fixtures, since a real creator session needs the
// owner's authenticator.
const previewPath = import.meta.env.DEV ? window.location.pathname : ''
const DirectorStatesPreview = import.meta.env.DEV ? lazy(() => import('./dev/DirectorStatesPreview')) : null
const CreatorRequestsPreview = import.meta.env.DEV ? lazy(() => import('./dev/CreatorRequestsPreview')) : null
const Preview =
  previewPath === '/__preview/director' ? DirectorStatesPreview : previewPath === '/__preview/creator' ? CreatorRequestsPreview : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Preview ? (
      // Inside the provider when a key is configured, so the header's auth
      // controls render as they do in the real app. No ClerkBridge: the
      // preview drives the session store itself.
      clerkPublishableKey ? (
        <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance}>
          <Suspense fallback={null}>
            <Preview />
          </Suspense>
        </ClerkProvider>
      ) : (
        <Suspense fallback={null}>
          <Preview />
        </Suspense>
      )
    ) : clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance}>
        <ClerkBridge />
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
