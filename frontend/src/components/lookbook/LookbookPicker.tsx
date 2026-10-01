import { SceneImage } from '../common/SceneImage'
import { useLookbook, useOptionalLookbook } from '../../state/lookbook'
import { cn } from '../../lib/cn'

/**
 * The fan's lookbook: one section per category, with a jump bar, an explicit
 * "model's preference" choice, and each category's own limit. `onChoose`
 * lets a page react to a pick (the demo Director keeps its setting in step
 * with the Scene category); the creator's preview passes nothing.
 */
export function LookbookPicker({ onChoose }: { onChoose?: (categoryId: string, itemId: string | null, nowSelected: boolean) => void }) {
  const { profile, categories, choices, choose } = useLookbook()
  const creator = profile.brand.name || 'the model'

  function select(categoryId: string, itemId: string | null) {
    const wasSelected = itemId !== null && (choices[categoryId] ?? []).includes(itemId)
    choose(categoryId, itemId)
    onChoose?.(categoryId, itemId, itemId !== null && !wasSelected)
  }

  if (categories.length === 0) {
    return <p className="rounded-card border border-divider bg-panel p-4 text-sm text-muted">{creator} hasn&rsquo;t added any choice categories yet.</p>
  }

  return <div className="space-y-6">
    <nav aria-label="Choice categories" className="sticky top-20 z-20 -mx-2 flex gap-2 overflow-x-auto border-y border-divider bg-cream/95 px-2 py-2 backdrop-blur-sm">
      {categories.map((category, index) => <a key={category.id} href={`#lookbook-${category.id}`} className="shrink-0 rounded-full border border-divider bg-panel px-3 py-2 text-xs font-medium text-espresso hover:border-rose-deep focus-ring">
        {index + 1}. {category.name}
      </a>)}
    </nav>

    {categories.map((category, index) => {
      const selected = choices[category.id] ?? []
      const full = category.maxSelections > 1 && selected.length >= category.maxSelections
      return <section key={category.id} id={`lookbook-${category.id}`} className="scroll-mt-36 rounded-card border border-divider bg-panel p-4" aria-labelledby={`fan-${category.id}`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{String(index + 1).padStart(2, '0')} / {String(categories.length).padStart(2, '0')}</p>
            <h3 id={`fan-${category.id}`} className="font-serif text-2xl text-espresso">{category.name}</h3>
          </div>
          <span className="text-xs text-muted" aria-live="polite">
            {category.maxSelections === 1 ? 'Choose one' : `Choose up to ${category.maxSelections} · ${selected.length} chosen`}
          </span>
        </div>
        <label className={cn('mb-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm focus-within:ring-2 focus-within:ring-espresso', selected.length === 0 ? 'border-rose-deep bg-rose/10' : 'border-divider')}>
          <input type="radio" name={`preference-${category.id}`} checked={selected.length === 0} onChange={() => select(category.id, null)} />
          Model&rsquo;s preference — let {creator} choose
        </label>
        {category.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {category.items.map((item) => {
            const checked = selected.includes(item.id)
            const blocked = full && !checked
            return <button key={item.id} type="button" aria-pressed={checked} aria-disabled={blocked} onClick={() => !blocked && select(category.id, item.id)} className={cn(
              'overflow-hidden rounded-card border bg-panel text-left transition-all hover:shadow-subtle focus-ring',
              checked ? 'border-2 border-rose-deep' : 'border-divider',
              blocked && 'cursor-not-allowed opacity-60',
            )}>
              <span className="block aspect-square overflow-hidden"><SceneImage src={item.image} alt={item.name} /></span>
              <span className="flex min-h-12 items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-espresso">
                {item.name}<span aria-hidden="true" className={checked ? 'text-rose-deep' : 'text-muted'}>{checked ? '✓' : '+'}</span>
              </span>
            </button>
          })}
        </div> : <p className="text-sm text-muted">{creator} hasn&rsquo;t added options here yet. Model&rsquo;s preference is selected.</p>}
        {full && <p className="mt-3 text-xs text-muted">That&rsquo;s the most you can choose here. Remove one to pick another.</p>}
        {index < categories.length - 1 && <a href={`#lookbook-${categories[index + 1].id}`} className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-rose-deep underline underline-offset-4 focus-ring">Next: {categories[index + 1].name} ↓</a>}
      </section>
    })}
    <p className="text-xs leading-relaxed text-muted">Your choices are requests. {creator} confirms what can be included and any price changes before approval.</p>
  </div>
}

/**
 * The selection inventory on Review, Saved and Confirmation: every category
 * the fan could see, with what they chose or "Model's preference". Renders
 * nothing in builds without a lookbook (staging's fan journey).
 */
export function LookbookSummary() {
  const lookbook = useOptionalLookbook()
  if (!lookbook) return null
  const { categories, choices } = lookbook

  return <section className="border-b border-divider p-6 sm:p-10" aria-label="Visual requests">
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Visual requests</h3>
    <p className="mb-5 text-sm text-muted">Every category is listed. What you chose is a request, subject to creator approval and any price adjustment.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {categories.map((category) => {
        const selected = category.items.filter((item) => (choices[category.id] ?? []).includes(item.id))
        return <div key={category.id} className="rounded-lg border border-divider bg-cream p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{category.name}</p>
          {selected.length ? <div className="flex flex-wrap gap-2">{selected.map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-md border border-divider bg-panel pr-2 text-xs font-medium text-espresso"><span className="h-10 w-10 overflow-hidden rounded-l-md"><SceneImage src={item.image} alt={item.name} /></span>{item.name}</span>)}</div> : <p className="text-sm text-espresso">Model&rsquo;s preference</p>}
        </div>
      })}
    </div>
  </section>
}
