import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PROFILE_LIMITS, isAdultCategory } from '../../../shared/domain/creatorProfile.ts'
import { Header } from '../components/layout/Header'
import { creatorLinks } from '../components/layout/creatorLinks'
import { SceneImage } from '../components/common/SceneImage'
import { LookbookPicker } from '../components/lookbook/LookbookPicker'
import { lookbookCopy as copy } from '../copy/creatorLookbook'
import { IMAGE_INPUT, ImageInputError } from '../lib/resizeImage'
import { DEMO_VIEW } from '../state/catalog'
import { useLookbook, type LookbookCategory } from '../state/lookbook'

export type LookbookMode = 'demo' | 'account'

const LANDING_URL = 'https://studiolens.me'

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ImageInputError || cause instanceof Error ? cause.message : fallback
}

function CategoryEditor({ category, mode }: { category: LookbookCategory; mode: LookbookMode }) {
  const { addItem, removeItem, renameCategory, removeCategory, setCategoryLimit, storeImage, adultAllowed } = useLookbook()
  const [itemName, setItemName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [categoryName, setCategoryName] = useState(category.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const locked = isAdultCategory(category) && !adultAllowed
  const full = category.items.length >= PROFILE_LIMITS.itemsPerCategory

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setMessage('')
    if (!file || !itemName.trim() || !storeImage) {
      setError(copy.nameAndImage)
      return
    }
    setBusy(true)
    try {
      const image = await storeImage(file)
      if (!addItem(category.id, itemName, image)) throw new Error(copy.nameAndImage)
      setItemName('')
      setFile(null)
      form.reset()
      setMessage(mode === 'demo' ? copy.itemAddedDemo : copy.itemAddedAccount)
    } catch (cause) {
      setError(errorText(cause, 'Could not add the image.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-divider bg-panel p-5 sm:p-7" aria-labelledby={`category-${category.id}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`category-${category.id}`} className="font-serif text-2xl text-espresso">{category.name}</h2>
          <p className="mt-1 text-sm text-muted">{category.items.length} item{category.items.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" onClick={() => removeCategory(category.id)} className="min-h-11 rounded-lg border border-divider px-3 text-sm text-muted hover:text-espresso focus-ring">Remove category</button>
      </div>

      {locked ? (
        <p className="rounded-lg border border-divider bg-secondary p-4 text-sm text-muted">{copy.adultLocked}</p>
      ) : (
        <>
          <form className="mb-6 flex flex-wrap items-end gap-2" onSubmit={(event) => {
            event.preventDefault()
            setError('')
            if (!renameCategory(category.id, categoryName)) setError(copy.uniqueName)
          }}>
            <label className="min-w-[180px] flex-1 text-xs text-muted" htmlFor={`rename-${category.id}`}>Category name
              <input id={`rename-${category.id}`} value={categoryName} maxLength={PROFILE_LIMITS.categoryName} onChange={(event) => setCategoryName(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-divider bg-cream px-3 text-sm text-espresso focus-ring" />
            </label>
            <button type="submit" className="min-h-11 rounded-lg border border-divider px-4 text-sm focus-ring">Update name</button>
            <label className="text-xs text-muted" htmlFor={`limit-${category.id}`}>Fan choices allowed
              <input id={`limit-${category.id}`} type="number" min={1} max={PROFILE_LIMITS.maxSelections} value={category.maxSelections} onChange={(event) => setCategoryLimit(category.id, Number(event.target.value))} className="mt-1 block min-h-11 w-24 rounded-lg border border-divider bg-cream px-3 text-sm text-espresso focus-ring" />
            </label>
          </form>

          {category.items.length > 0 ? (
            <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {category.items.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-lg border border-divider bg-cream">
                  <div className="aspect-square"><SceneImage src={item.image} alt={item.name} /></div>
                  <div className="flex items-start justify-between gap-2 p-3">
                    <span className="text-sm font-medium text-espresso">{item.name}</span>
                    <button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(category.id, item.id)} className="text-xs text-muted underline hover:text-espresso focus-ring">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mb-6 text-sm text-muted">{copy.emptyCategory}</p>}

          {!storeImage ? (
            <p className="rounded-lg border border-divider bg-secondary p-4 text-sm text-muted">{copy.uploadsUnavailable}</p>
          ) : full ? (
            <p className="rounded-lg border border-divider bg-secondary p-4 text-sm text-muted">This category holds the most images it can ({PROFILE_LIMITS.itemsPerCategory}). Remove one to add another.</p>
          ) : (
            <form onSubmit={upload} className="rounded-lg border border-divider bg-secondary p-4">
              <h3 className="mb-3 text-sm font-semibold text-espresso">Add your own item</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="text-xs text-muted">Item name
                  <input value={itemName} maxLength={PROFILE_LIMITS.itemName} onChange={(event) => setItemName(event.target.value)} placeholder="e.g. Red satin robe" className="mt-1 block min-h-11 w-full rounded-lg border border-divider bg-panel px-3 text-sm text-espresso focus-ring" />
                </label>
                <label className="text-xs text-muted">Your image
                  <input type="file" accept={IMAGE_INPUT.accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full min-w-0 text-xs text-espresso file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-divider file:bg-panel file:px-3 file:text-xs file:font-medium" />
                </label>
                <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-espresso px-5 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-60 focus-ring">{busy ? 'Adding…' : 'Add image'}</button>
              </div>
            </form>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-rose-deep">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-espresso">{message}</p>}
    </section>
  )
}

/**
 * The lookbook editor, the same in both builds. Everything it changes is the
 * mounted LookbookProvider's in-memory profile; the demo stops there, and the
 * account page saves that profile through the API (CreatorLookbookAccount).
 */
export function LookbookEditor({ mode, fixedLimits, saveBar }: { mode: LookbookMode; fixedLimits?: string[]; saveBar?: ReactNode }) {
  const { profile, allCategories, addCategory, updateBrand, updateVoice, updateBoundaries, storeImage } = useLookbook()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [backgroundError, setBackgroundError] = useState('')

  return <main className="mx-auto max-w-container px-4 py-10 sm:px-6 lg:px-8">
    <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-rose-deep">{mode === 'demo' ? copy.eyebrowDemo : copy.eyebrowAccount}</p>
        <h1 className="font-serif text-4xl text-espresso">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{mode === 'demo' ? copy.introDemo : copy.introAccount}</p>
        {mode === 'account' && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.fansDontSeeYet}</p>}
        {mode === 'demo' && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {copy.joinByInvitation}{' '}
            <a href={LANDING_URL} className="font-medium text-espresso underline underline-offset-4 focus-ring">{copy.applyLinkLabel}</a>
          </p>
        )}
      </div>
      {mode === 'demo'
        ? <Link to="/ai-director" className="inline-flex min-h-11 items-center rounded-lg border border-divider px-4 text-sm font-medium text-espresso hover:bg-panel focus-ring">{copy.previewFanChoices}</Link>
        : <a href="#fan-preview" className="inline-flex min-h-11 items-center rounded-lg border border-divider px-4 text-sm font-medium text-espresso hover:bg-panel focus-ring">{copy.previewFanChoices}</a>}
    </div>

    {saveBar}

    <section className="mb-7 rounded-xl border border-divider bg-panel p-5 sm:p-7" aria-labelledby="brand-title">
      <h2 id="brand-title" className="font-serif text-2xl text-espresso">Brand & atmosphere</h2>
      <p className="mb-5 mt-1 text-sm text-muted">{mode === 'demo' ? copy.brandNoteDemo : copy.brandNoteAccount}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-muted">Studio name
          <input value={profile.brand.name} maxLength={PROFILE_LIMITS.brandName} onChange={(event) => updateBrand({ name: event.target.value })} className="mt-1 block min-h-11 w-full rounded-lg border border-divider bg-cream px-3 text-sm text-espresso focus-ring" />
        </label>
        {(['style', 'tone', 'mood'] as const).map((field) => <label key={field} className="text-xs capitalize text-muted">{field}
          <input value={profile[field]} maxLength={PROFILE_LIMITS.voice} onChange={(event) => updateVoice(field, event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-divider bg-cream px-3 text-sm text-espresso focus-ring" />
        </label>)}
        {([
          ['background', 'Page background'], ['surface', 'Card background'], ['text', 'Text color'], ['accent', 'Accent color'],
        ] as const).map(([field, label]) => <label key={field} className="text-xs text-muted">{label}
          <span className="mt-1 flex items-center gap-2"><input type="color" value={profile.brand[field]} onChange={(event) => updateBrand({ [field]: event.target.value.toUpperCase() })} className="h-11 w-16 cursor-pointer rounded border border-divider bg-panel" /><span className="text-sm text-espresso">{profile.brand[field]}</span></span>
        </label>)}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        {storeImage ? (
          <label className="text-xs text-muted">Background image
            <input type="file" accept={IMAGE_INPUT.accept} onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setBackgroundError('')
              void storeImage(file).then((image) => updateBrand({ backgroundImage: image })).catch((cause) => setBackgroundError(errorText(cause, 'Could not load image.')))
            }} className="mt-1 block text-xs file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-divider file:bg-cream file:px-3 file:text-xs" />
          </label>
        ) : <p className="text-xs text-muted">{copy.uploadsUnavailable}</p>}
        {profile.brand.backgroundImage && <button type="button" onClick={() => updateBrand({ backgroundImage: '' })} className="min-h-11 rounded-lg border border-divider px-3 text-sm focus-ring">Remove background</button>}
      </div>
      {backgroundError && <p role="alert" className="mt-2 text-sm text-rose-deep">{backgroundError}</p>}
    </section>

    <section className="mb-7 rounded-xl border border-divider bg-panel p-5 sm:p-7" aria-labelledby="limits-title">
      <h2 id="limits-title" className="font-serif text-2xl text-espresso">Boundaries & limits</h2>
      <p className="mb-5 mt-1 text-sm text-muted">{copy.limitsNote}</p>
      <div className="mb-5 rounded-lg bg-secondary p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-espresso">{copy.fixedLimitsHeading}</h3>
        {fixedLimits?.length
          ? <ul className="mt-2 list-inside list-disc text-sm leading-relaxed text-muted">{fixedLimits.map((line) => <li key={line}>{line}</li>)}</ul>
          : <p className="mt-2 text-sm text-muted">{copy.fixedLimitsAccount}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ['hardNo', 'Things I will not do'], ['askFirst', 'Ask me first'],
        ] as const).map(([field, label]) => {
          const count = profile.boundaries[field].filter((line) => line.trim()).length
          return <label key={field} className="text-sm font-medium text-espresso">{label}
            <textarea value={profile.boundaries[field].join('\n')} onChange={(event) => updateBoundaries(field, event.target.value.split('\n'))} rows={5} className="mt-2 block w-full resize-y rounded-lg border border-divider bg-cream p-3 text-sm text-espresso focus-ring" />
            <span className={count > PROFILE_LIMITS.limitLines ? 'mt-1 block text-xs text-rose-deep' : 'mt-1 block text-xs font-normal text-muted'}>
              {count} of {PROFILE_LIMITS.limitLines} lines{count > PROFILE_LIMITS.limitLines ? ' — remove some before saving' : ''}
            </span>
          </label>
        })}
      </div>
    </section>

    <div className="mb-5"><h2 className="font-serif text-3xl text-espresso">Choice categories</h2><p className="mt-1 text-sm text-muted">{copy.categoriesNote}</p></div>
    <div className="space-y-7">{allCategories.map((category) => <CategoryEditor key={category.id} category={category} mode={mode} />)}</div>

    <form onSubmit={(event) => {
      event.preventDefault()
      setError('')
      if (addCategory(name)) setName('')
      else setError(allCategories.length >= PROFILE_LIMITS.categories ? `You can have up to ${PROFILE_LIMITS.categories} categories.` : copy.uniqueName)
    }} className="mt-8 rounded-xl border border-dashed border-divider bg-panel p-6">
      <h2 className="font-serif text-2xl text-espresso">Create a category</h2>
      <p className="mt-1 text-sm text-muted">Add any category you want, then give it named images.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="new-category">New category name</label>
        <input id="new-category" value={name} maxLength={PROFILE_LIMITS.categoryName} onChange={(event) => setName(event.target.value)} placeholder="e.g. Accessories" className="min-h-11 min-w-[220px] flex-1 rounded-lg border border-divider bg-cream px-3 text-sm focus-ring" />
        <button type="submit" className="min-h-11 rounded-lg bg-espresso px-5 text-sm font-medium text-cream hover:opacity-90 focus-ring">Create category</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-deep">{error}</p>}
    </form>

    {mode === 'account' && (
      <section id="fan-preview" className="mt-12 scroll-mt-24" aria-labelledby="fan-preview-title">
        <h2 id="fan-preview-title" className="font-serif text-3xl text-espresso">{copy.previewHeading}</h2>
        <p className="mb-5 mt-1 text-sm text-muted">{copy.previewNote} {copy.fansDontSeeYet}</p>
        <LookbookPicker />
      </section>
    )}
  </main>
}

/** The public demo's creator page: the editor over the demo's in-memory lookbook. */
export function CreatorLookbook() {
  const fixed = [
    ...DEMO_VIEW.boundaries.hardNo.map((line) => `Won’t do: ${line.text}`),
    ...DEMO_VIEW.boundaries.askFirst.map((line) => `Ask first: ${line.text}`),
  ]
  return <div className="min-h-screen bg-cream">
    <Header links={creatorLinks} />
    <LookbookEditor mode="demo" fixedLimits={fixed} />
  </div>
}
