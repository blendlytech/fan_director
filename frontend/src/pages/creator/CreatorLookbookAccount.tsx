import { useCallback, useEffect, useState } from 'react'
import { creatorApi, type CreatorProfileResponse } from '../../api/client'
import { useSignedIn } from '../../auth/session'
import { Icon } from '../../components/common/Icon'
import { Header } from '../../components/layout/Header'
import { lookbookCopy as copy, lookbookErrorMessage } from '../../copy/creatorLookbook'
import { resizeImage } from '../../lib/resizeImage'
import { useLookbook } from '../../state/lookbook'
import { LookbookProvider } from '../../state/LookbookContext'
import { creatorLinks } from '../../components/layout/creatorLinks'
import { LookbookEditor } from '../CreatorLookbook'

/* -------------------------------------------------------------------------- */
/*  The lookbook on the creator's account (staging only).                      */
/*                                                                            */
/*  Loads `GET /api/creator/profile`, edits it in memory with the same editor  */
/*  as the demo, and saves it with `PUT /api/creator/profile` when the creator */
/*  presses Save. The server takes the creator from the session and refuses a */
/*  fan's: there is no way to name someone else's profile from here. Nothing  */
/*  is kept in browser storage.                                                */
/* -------------------------------------------------------------------------- */

type PageState =
  | { kind: 'loading' }
  | { kind: 'ready'; saved: CreatorProfileResponse; mount: number }
  | { kind: 'error'; message: string }

async function uploadImage(file: File): Promise<string> {
  const res = await creatorApi.uploadImage(await resizeImage(file))
  if (!res.ok) throw new Error(lookbookErrorMessage(res.status, res.error, res.body))
  return res.body.url
}

export function CreatorLookbookAccount() {
  const signedIn = useSignedIn()
  const [state, setState] = useState<PageState>({ kind: 'loading' })

  const load = useCallback(async () => {
    const res = await creatorApi.profile()
    if (res.ok) setState({ kind: 'ready', saved: res.body, mount: 0 })
    else setState({ kind: 'error', message: lookbookErrorMessage(res.status, res.error, res.body) })
  }, [])

  useEffect(() => {
    if (signedIn !== true) return
    void (async () => {
      await load()
    })()
  }, [signedIn, load])

  return (
    <div className="min-h-screen bg-cream">
      <Header links={creatorLinks} />
      {signedIn === false && <Notice icon="lucide:log-in">{copy.signedOut}</Notice>}
      {signedIn === true && state.kind === 'loading' && (
        <p role="status" className="mx-auto max-w-container px-4 py-10 text-sm text-muted sm:px-6 lg:px-8">{copy.loading}</p>
      )}
      {signedIn === true && state.kind === 'error' && <Notice icon="lucide:circle-alert">{state.message}</Notice>}
      {signedIn === true && state.kind === 'ready' && (
        // A fresh provider per saved revision (and per discard), so the editor
        // always starts from exactly what the server holds.
        <LookbookProvider
          key={`${state.saved.revision}:${state.mount}`}
          initialProfile={state.saved.profile}
          adultAllowed={state.saved.adultAllowed}
          storeImage={state.saved.mediaUploads ? uploadImage : undefined}
        >
          <LookbookEditor
            mode="account"
            saveBar={
              <SaveBar
                saved={state.saved}
                onSaved={(saved) => setState({ kind: 'ready', saved, mount: 0 })}
                onDiscard={() => setState({ kind: 'ready', saved: state.saved, mount: state.mount + 1 })}
              />
            }
          />
        </LookbookProvider>
      )}
    </div>
  )
}

function SaveBar({ saved, onSaved, onDiscard }: {
  saved: CreatorProfileResponse
  onSaved: (saved: CreatorProfileResponse) => void
  onDiscard: () => void
}) {
  const { profile } = useLookbook()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved.profile)

  // Leaving with unsaved edits asks first; the browser keeps no copy of them.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function save() {
    setSaving(true)
    setError('')
    const res = await creatorApi.saveProfile(saved.revision, profile)
    setSaving(false)
    if (res.ok) onSaved({ ...saved, profile: res.body.profile, revision: res.body.revision })
    else setError(lookbookErrorMessage(res.status, res.error, res.body))
  }

  const status = saving ? copy.saving : dirty ? copy.unsaved : saved.revision === 0 ? copy.neverSaved : copy.allSaved
  return (
    <div className="sticky top-20 z-30 mb-7 rounded-xl border border-divider bg-panel/95 p-4 shadow-subtle backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-espresso">{status}</p>
        <div className="flex gap-2">
          <button type="button" disabled={!dirty || saving} onClick={onDiscard} className="min-h-11 rounded-lg border border-divider px-4 text-sm text-espresso disabled:opacity-50 focus-ring">{copy.discard}</button>
          <button type="button" disabled={!dirty || saving} onClick={() => void save()} className="min-h-11 rounded-lg bg-espresso px-5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50 focus-ring">{copy.save}</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-rose-deep">{error}</p>}
    </div>
  )
}

function Notice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-container px-4 py-10 sm:px-6 lg:px-8">
      <p className="flex items-start gap-2 rounded-card border border-divider bg-panel px-4 py-3 text-sm text-muted">
        <Icon icon={icon} width={16} className="mt-0.5 shrink-0" />
        {children}
      </p>
    </div>
  )
}
