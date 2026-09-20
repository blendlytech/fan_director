import { useMemo, useState } from 'react'
import { creatorApi } from '../../api/client'
import type { CommissionVersion } from '../../api/types'
import { Button } from '../../components/common/Button'
import { Icon } from '../../components/common/Icon'
import { creatorCopy as copy } from '../../copy/creatorRequests'
import {
  parsePriceDollars,
  previewProposal,
  proposalGroups,
  sameSelections,
  setChoiceQty,
  toggleChoice,
  type ProposalGroup,
} from '../../domain/creatorProposal'
import { currency } from '../../domain/sceneCard'
import { useCatalog } from '../../state/catalog'
import { MESSAGE_MAX } from '../../../../shared/domain/commission.ts'
import type { Selection } from '../../../../shared/domain/types.ts'
import { useRequestContext } from './requestContext'

/* -------------------------------------------------------------------------- */
/*  Design 05's "Propose Changes", on real data.                              */
/*                                                                            */
/*  The creator edits the choices, not the price: the server prices whatever  */
/*  it is sent against the creator's current catalog and returns the figures   */
/*  the screen then shows. The one number typed here is the custom request's   */
/*  price, which no catalog covers.                                            */
/*                                                                            */
/*  The proposal becomes a new immutable version the fan has to accept before  */
/*  it can be approved, so nothing on this form changes the request on its own.*/
/* -------------------------------------------------------------------------- */

export function ProposeChanges({ base, onDone }: { base: CommissionVersion; onDone: () => void }) {
  const { view: catalog } = useCatalog()
  const { view, busy, act } = useRequestContext()
  const [selections, setSelections] = useState<Selection[]>(() => base.terms.selections.map((s) => ({ ...s })))
  const [priceText, setPriceText] = useState(() =>
    base.customRequestPriceCents === null ? '' : (base.customRequestPriceCents / 100).toFixed(2),
  )
  const [note, setNote] = useState('')

  const groups = useMemo(() => proposalGroups(catalog, selections), [catalog, selections])
  const price = parsePriceDollars(priceText)
  const preview = useMemo(() => previewProposal(catalog, selections, price ?? null), [catalog, selections, price])

  const unchanged = sameSelections(selections, base.terms.selections) && (price ?? null) === base.customRequestPriceCents
  const priceBad = price === undefined
  const canSend = !busy && !unchanged && !priceBad && preview.ok

  async function send() {
    const ok = await act(
      () => creatorApi.propose(view.commission.id, base.id, selections.map((s) => ({ itemId: s.itemId, qty: s.qty })), price ?? null, note.trim() || null),
      copy.proposeSent,
    )
    if (ok) onDone()
  }

  return (
    <div className="animate-slide-up rounded-xl border border-divider bg-cream p-5">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Icon icon="lucide:arrow-right-left" width={16} className="text-rose" />
        {copy.proposeHeading}
      </h4>
      <p className="mb-5 text-xs leading-relaxed text-muted">{copy.proposeIntro}</p>

      <div className="mb-5 space-y-5">
        {groups.map((group) => (
          <Group key={group.id} group={group} onToggle={(itemId) => setSelections((s) => toggleChoice(group, s, itemId))} onQty={(itemId, qty) => setSelections((s) => setChoiceQty(group, s, itemId, qty))} />
        ))}
      </div>

      {base.terms.customRequest && (
        <div className="mb-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{copy.customRequestHeading}</p>
          <p className="mb-3 whitespace-pre-wrap rounded-lg border border-divider bg-panel p-3 text-sm text-espresso">{base.terms.customRequest}</p>
          <label htmlFor="custom-price" className="mb-1 block text-xs font-medium text-espresso">
            {copy.proposePriceLabel}
          </label>
          <input
            id="custom-price"
            type="text"
            inputMode="decimal"
            value={priceText}
            aria-describedby="custom-price-help"
            aria-invalid={priceBad ? true : undefined}
            onChange={(event) => setPriceText(event.target.value)}
            className="w-full rounded-lg border border-divider bg-panel p-2 text-sm text-espresso focus:border-espresso focus:outline-none focus-ring"
          />
          <p id="custom-price-help" className="mt-1 text-xs text-muted">
            {copy.proposePriceHelp}
          </p>
        </div>
      )}

      <label htmlFor="proposal-note" className="mb-1 block text-xs font-medium text-espresso">
        {copy.proposeNoteLabel}
      </label>
      <textarea
        id="proposal-note"
        rows={3}
        value={note}
        maxLength={MESSAGE_MAX}
        onChange={(event) => setNote(event.target.value)}
        aria-describedby="proposal-note-count"
        className="mb-1 w-full resize-none rounded-lg border border-divider bg-panel p-3 text-sm focus:border-espresso focus:outline-none focus-ring"
      />
      <p id="proposal-note-count" className="mb-5 text-right text-xs text-muted">
        {copy.charCount(note.length, MESSAGE_MAX)}
      </p>

      {/* A preview from the same module the server prices with; the server's own figure replaces it. */}
      <div className="mb-5 rounded-lg border border-divider bg-panel p-4">
        {preview.ok ? (
          <>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{copy.proposeEstimate}</span>
              <span className="font-serif text-xl font-semibold text-espresso">{currency.format(preview.totalCents)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{copy.proposeEstimateNote}</p>
          </>
        ) : (
          <p className="text-sm text-alert">{copy.proposeInvalid}</p>
        )}
        {unchanged && <p className="mt-2 text-xs text-muted">{copy.proposeUnchanged}</p>}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" size="sm" type="button" className="flex-1" onClick={onDone}>
          {copy.proposeCancel}
        </Button>
        <Button variant="primary" size="sm" type="button" icon="lucide:send" className="flex-1" disabled={!canSend} onClick={() => void send()}>
          {copy.proposeSend}
        </Button>
      </div>
    </div>
  )
}

function Group({
  group,
  onToggle,
  onQty,
}: {
  group: ProposalGroup
  onToggle: (itemId: string) => void
  onQty: (itemId: string, qty: number) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{group.label}</legend>
      <div className="space-y-2">
        {group.choices.map((choice) => (
          <div key={choice.item.id} className="rounded-lg border border-divider bg-panel">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 p-3 text-sm">
              <input
                type={group.single ? 'radio' : 'checkbox'}
                name={group.id}
                checked={choice.selected}
                onChange={() => onToggle(choice.item.id)}
                className="h-4 w-4 shrink-0 accent-rose-deep focus-ring"
              />
              <span className="flex-1 text-espresso">{choice.item.label}</span>
            </label>
            {choice.selected && choice.qtyRange && (
              <div className="flex items-center justify-between gap-3 border-t border-divider px-3 py-2">
                <label htmlFor={`qty-${choice.item.id}`} className="text-xs text-muted">
                  {choice.item.pricing.kind === 'per_unit' ? choice.item.pricing.unitLabel : 'Quantity'}
                </label>
                <input
                  id={`qty-${choice.item.id}`}
                  type="number"
                  min={choice.qtyRange.min}
                  max={choice.qtyRange.max}
                  value={choice.qty}
                  onChange={(event) => onQty(choice.item.id, Number(event.target.value))}
                  className="min-h-[44px] w-20 rounded-lg border border-divider bg-panel p-2 text-sm text-espresso focus:border-espresso focus:outline-none focus-ring"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  )
}
