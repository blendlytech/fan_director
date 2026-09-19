import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { clerkAppearance, clerkPublishableKey } from './auth/clerk'
import { ClerkBridge } from './auth/ClerkBridge'

// Dev server only: every Director and save state (designs 17, 13 C, 18) on one
// page, for browser checks. Production builds drop this branch entirely.
const preview = import.meta.env.DEV && window.location.pathname === '/__preview/director'
const DirectorStatesPreview = import.meta.env.DEV ? lazy(() => import('./dev/DirectorStatesPreview')) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview && DirectorStatesPreview ? (
      <Suspense fallback={null}>
        <DirectorStatesPreview />
      </Suspense>
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
