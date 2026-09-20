import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { applyTemplate, templateCards, templateDropsScript, type TemplateCard } from '../../domain/options'
import { money } from '../../domain/sceneCard'
import { useCommission } from '../../state/commission'
import { ScriptDiscardDialog } from './ScriptDiscardDialog'

/* -------------------------------------------------------------------------- */
/*  Design 20 A: starting templates at the entrance. Cards, order and prices   */
/*  come from the catalog's own templates (templateCards), never a fixed list  */
/*  — the fifth "specialties" template design 20 A describes only appears at   */
/*  all once adult content is on for the creator, which templateCards already  */
/*  filters on the shared gate.                                               */
/* -------------------------------------------------------------------------- */

// No icon data comes from the catalog template itself; this is decorative
// variety only, cycled by position, and never implies a category or price.
const ICONS = ['lucide:heart', 'lucide:timer', 'lucide:stethoscope', 'lucide:scan-eye', 'lucide:sparkles'] as const

export function TemplatePicker() {
  const { view, draft, commit } = useCommission()
  const navigate = useNavigate()
  const [pending, setPending] = useState<TemplateCard | null>(null)
  const cards = templateCards(view)

  if (cards.length === 0) return null

  function start(card: TemplateCard) {
    commit(applyTemplate(view, draft, card))
    navigate('/ai-director')
  }

  function choose(card: TemplateCard) {
    if (templateDropsScript(view, draft, card)) {
      setPending(card)
      return
    }
    start(card)
  }

  return (
    <section aria-labelledby="template-picker-heading">
      <h2 id="template-picker-heading" className="mb-2 text-3xl tracking-tight text-espresso sm:text-4xl">
        Where would you like to start?
      </h2>
      <p className="mb-8 max-w-[560px] text-base text-muted">
        Pick a starting point. You can change every choice before you send it to {view.creatorName}.
      </p>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <li key={card.id}>
            <button
              type="button"
              onClick={() => choose(card)}
              className="flex h-full w-full flex-col rounded-card border border-divider bg-panel p-5 text-left transition-colors duration-160 hover:border-espresso focus-ring"
            >
              <Icon icon={ICONS[index % ICONS.length]} width={22} className="mb-3 text-rose-deep" />
              <span className="mb-1 font-serif text-2xl font-medium">{card.label}</span>
              <span className="mb-4 flex-1 text-sm text-muted">{card.description}</span>
              <span className="text-sm font-medium">From {money(card.fromPrice)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        &ldquo;From&rdquo; prices are derived from each template&rsquo;s cheapest valid build.
      </p>

      {pending && (
        <ScriptDiscardDialog
          view={view}
          draft={draft}
          onKeep={() => setPending(null)}
          onDelete={() => {
            const card = pending
            setPending(null)
            start(card)
          }}
        />
      )}
    </section>
  )
}
