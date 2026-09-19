import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { api } from '../api/client'
import type { ServerDraftResponse, ServerQuote } from '../api/types'
import { useSignedIn } from '../auth/session'
import { capabilities } from '../config'
import { BUDGET, draftFromSelections, selectionsOf, type CatalogView, type Draft } from '../domain/sceneCard'
import type { CommissionAction } from './commissionReducer'

/* -------------------------------------------------------------------------- */
/*  Design 18: the draft saves to the fan's account on every change (staging  */
/*  only, signed in). The server is the record; this keeps the screen and the  */
/*  server in step:                                                            */
/*                                                                            */
/*  - one save in flight at a time, each with the revision the last save       */
/*    returned, so saves can't overtake each other;                            */
/*  - a newer copy from another window replaces this one (18 B) instead of     */
/*    being overwritten;                                                       */
/*  - "Saved" is shown only after the server said so (doc 11 §3 rule 1).       */
/* -------------------------------------------------------------------------- */

export type SaveStatus = 'idle' | 'signed_out' | 'loading' | 'saving' | 'saved' | 'failed'

export interface ServerRef {
  draftId: string
  revision: number
  catalogVersionId: string
}

/** Design 18 C: the catalog changed after this draft was priced. */
export interface PriceChange {
  catalogVersionId: string
  before: ServerQuote
  now: ServerQuote
}

export interface DraftSyncValue {
  status: SaveStatus
  savedAt: Date | null
  server: ServerRef | null
  changedElsewhere: boolean
  dismissChangedElsewhere: () => void
  priceChange: PriceChange | null
  /** The quote the draft keeps until the fan accepts new prices (never silently re-priced). */
  pinnedQuote: ServerQuote | null
  acceptPriceChange: () => Promise<boolean>
  retry: () => void
  /** Waits until the screen's draft is saved; returns the server reference, or null if it can't be. */
  flush: () => Promise<ServerRef | null>
  /** Takes a draft the server already saved (an accepted suggestion) without saving it again. */
  adopt: (response: ServerDraftResponse, opts?: { asUndoableChange?: boolean }) => void
}

export const DraftSyncContext = createContext<DraftSyncValue | null>(null)

export function useDraftSync(): DraftSyncValue | null {
  return useContext(DraftSyncContext)
}

const DEBOUNCE_MS = 400

export function contentOf(view: CatalogView, draft: Draft) {
  return {
    selections: selectionsOf(view, draft),
    fanDisplayName: null,
    customRequest: draft.customRequest ?? null,
    fanScript: null,
    notes: draft.notes.slice(-20).map((n) => ({ id: n.id, text: n.text.slice(0, 500) })),
    budget: BUDGET,
  }
}

function keyOf(content: ReturnType<typeof contentOf>): string {
  const selections = [...content.selections].sort((a, b) => a.itemId.localeCompare(b.itemId))
  return JSON.stringify({ ...content, selections })
}

export function useDraftSyncState(
  view: CatalogView,
  catalogFromServer: boolean,
  draft: Draft,
  dispatch: Dispatch<CommissionAction>,
): DraftSyncValue | null {
  const enabled = capabilities.persistence
  const signedIn = useSignedIn()
  const [status, setStatus] = useState<SaveStatus>(enabled ? 'loading' : 'idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [server, setServer] = useState<ServerRef | null>(null)
  const [changedElsewhere, setChangedElsewhere] = useState(false)
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null)
  const [pinnedQuote, setPinnedQuote] = useState<ServerQuote | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  // Mutable state the async save loop reads; React state mirrors it for rendering.
  const serverRef = useRef<ServerRef | null>(null)
  const savedKey = useRef<string | null>(null)
  const latest = useRef({ view, draft })
  useEffect(() => {
    latest.current = { view, draft }
  })
  const inFlight = useRef<Promise<void> | null>(null)
  const loadedFor = useRef<string | null>(null)

  const setRef = (ref: ServerRef | null) => {
    serverRef.current = ref
    setServer(ref)
  }

  const takeServerDraft = useCallback(
    (res: ServerDraftResponse, mode: 'load' | 'commit' | 'silent') => {
      const d = res.draft
      const v = latest.current.view
      const next = draftFromSelections(v, d.selections, { notes: d.notes, customRequest: d.customRequest })
      setRef({ draftId: d.id, revision: d.revision, catalogVersionId: d.catalogVersionId })
      savedKey.current = keyOf(contentOf(v, next))
      if (mode === 'load') dispatch({ type: 'load', draft: next })
      if (mode === 'commit') dispatch({ type: 'commit', changes: next })
      if (res.stale && res.current?.ok && res.current.quote && res.quote) {
        setPriceChange({ catalogVersionId: res.current.catalogVersionId, before: res.quote, now: res.current.quote })
        setPinnedQuote(res.quote)
      } else {
        setPriceChange(null)
        setPinnedQuote(null)
      }
      setSavedAt(new Date(res.updatedAt))
      setStatus('saved')
    },
    [dispatch],
  )

  // First load: resume the fan's latest draft, or create one from what's on screen.
  useEffect(() => {
    if (!enabled) return
    if (signedIn === false) {
      // Signed out: nothing is saved. The status is derived at render time below.
      serverRef.current = null
      loadedFor.current = null
      return
    }
    if (signedIn !== true || !catalogFromServer) return
    if (loadedFor.current === view.versionId) return
    loadedFor.current = view.versionId
    let cancelled = false
    let done = false
    setStatus('loading')
    ;(async () => {
      const found = await api.latestDraft()
      if (cancelled) return
      if (found.ok && found.body.draft) {
        done = true
        takeServerDraft(found.body as ServerDraftResponse, 'load')
        return
      }
      if (!found.ok) {
        done = true
        setStatus('failed')
        loadedFor.current = null
        return
      }
      const draftId = crypto.randomUUID()
      const content = contentOf(latest.current.view, latest.current.draft)
      const created = await api.saveDraft(draftId, 0, latest.current.view.versionId, content)
      if (cancelled) return
      done = true
      if (created.ok) takeServerDraft(created.body, 'silent')
      else {
        setStatus('failed')
        loadedFor.current = null
      }
    })()
    return () => {
      cancelled = true
      // Unmounted (or StrictMode's rehearsal) before finishing: let the next run load.
      if (!done) loadedFor.current = null
    }
  }, [enabled, signedIn, catalogFromServer, view.versionId, takeServerDraft, reloadNonce])

  const saveNow = useCallback(async (): Promise<void> => {
    // One save at a time, always with the revision the last one returned.
    while (inFlight.current) await inFlight.current
    const ref = serverRef.current
    if (!ref) return
    const content = contentOf(latest.current.view, latest.current.draft)
    const key = keyOf(content)
    if (key === savedKey.current) return
    setStatus('saving')
    const run = (async () => {
      const res = await api.saveDraft(ref.draftId, ref.revision, ref.catalogVersionId, content)
      if (res.ok) {
        setRef({ draftId: res.body.draft.id, revision: res.body.draft.revision, catalogVersionId: res.body.draft.catalogVersionId })
        savedKey.current = key
        setSavedAt(new Date(res.body.updatedAt))
        // A later change may be waiting; the effect below saves it next.
        setStatus(keyOf(contentOf(latest.current.view, latest.current.draft)) === key ? 'saved' : 'saving')
        return
      }
      if (res.status === 409 && res.error === 'revision_conflict' && res.body.current) {
        // Changed in another window (design 18 B): load theirs, never overwrite it.
        const current = res.body.current as ServerDraftResponse['draft']
        takeServerDraft({ draft: current, quote: (res.body.quote as ServerQuote) ?? null, stale: false, updatedAt: new Date().toISOString() }, 'load')
        setChangedElsewhere(true)
        return
      }
      if (res.status === 409 && res.error === 'catalog_version_stale') {
        // Reload to get the before/after prices (design 18 C).
        const found = await api.latestDraft()
        if (found.ok && found.body.draft) takeServerDraft(found.body as ServerDraftResponse, 'load')
        else setStatus('failed')
        return
      }
      setStatus('failed')
    })()
    inFlight.current = run
    try {
      await run
    } finally {
      inFlight.current = null
    }
  }, [takeServerDraft])

  // Save on every change, debounced.
  const contentKey = enabled ? keyOf(contentOf(view, draft)) : ''
  useEffect(() => {
    if (!enabled || !serverRef.current || signedIn !== true) return
    if (contentKey === savedKey.current) return
    setStatus('saving')
    const timer = window.setTimeout(() => void saveNow(), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [enabled, contentKey, signedIn, saveNow, server])

  const flush = useCallback(async (): Promise<ServerRef | null> => {
    await saveNow()
    const dirty = keyOf(contentOf(latest.current.view, latest.current.draft)) !== savedKey.current
    return dirty ? null : serverRef.current
  }, [saveNow])

  const adopt = useCallback(
    (res: ServerDraftResponse, opts: { asUndoableChange?: boolean } = {}) => takeServerDraft(res, opts.asUndoableChange ? 'commit' : 'load'),
    [takeServerDraft],
  )

  const acceptPriceChange = useCallback(async (): Promise<boolean> => {
    const ref = serverRef.current
    if (!ref || !priceChange) return false
    const res = await api.acceptCatalogVersion(ref.draftId, ref.revision, priceChange.catalogVersionId)
    if (!res.ok) return false
    takeServerDraft(res.body, 'load')
    return true
  }, [priceChange, takeServerDraft])

  const retry = useCallback(() => {
    if (!serverRef.current) {
      loadedFor.current = null
      setReloadNonce((n) => n + 1)
      return
    }
    void saveNow()
  }, [saveNow])

  return useMemo<DraftSyncValue | null>(
    () =>
      enabled
        ? {
            status: signedIn === false ? 'signed_out' : status,
            savedAt: signedIn === false ? null : savedAt,
            server: signedIn === false ? null : server,
            changedElsewhere,
            dismissChangedElsewhere: () => setChangedElsewhere(false),
            priceChange,
            pinnedQuote,
            acceptPriceChange,
            retry,
            flush,
            adopt,
          }
        : null,
    [enabled, signedIn, status, savedAt, server, changedElsewhere, priceChange, pinnedQuote, acceptPriceChange, retry, flush, adopt],
  )
}
