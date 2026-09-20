import { useState } from 'react'
import { PILOT_BOUTIQUE_NAME } from '../../../../shared/catalog/pilot-v1.ts'
import { Icon } from '../common/Icon'
import { MessageBlocked } from '../director/MessageBlocked'
import { cn } from '../../lib/cn'
import {
  NAME_MAX,
  SCRIPT_MAX,
  choiceLabel,
  hasScript,
  optionGroups,
  personalParts,
  pickOption,
  scriptItem,
  setScript,
  videoNotice,
  type OptionChoice,
  type OptionGroup,
} from '../../domain/options'
import { money, type CatalogView, type Draft } from '../../domain/sceneCard'
import { useCommission } from '../../state/commission'
import type { DraftSyncValue, SaveStatus } from '../../state/draftSync'
import { ScriptDiscardDialog } from './ScriptDiscardDialog'

/* -------------------------------------------------------------------------- */
/*  Design 20 B (option groups + the fan's own script) and design 24 B and C  */
/*  (the fan's name, and adding/removing the script). Every price shown comes  */
/*  from optionGroups()/scriptItem(), which price the current draft the same   */
/*  way the server does — nothing here computes a price of its own.           */
/* -------------------------------------------------------------------------- */

export function OptionsPanel({ sync }: { sync: DraftSyncValue | null }) {
  const { view, draft, commit, total } = useCommission()
  const groups = optionGroups(view, draft)
  const resaleLabel =
    groups.find((g) => g.key === 'rights')?.choices.find((c) => c.item.traits?.includes('resale'))?.item.label ??
    'sell it to other fans later'

  return (
    <div className="space-y-6 rounded-card border border-divider bg-panel p-5 sm:p-6">
      {groups.map((group) => (
        <Fieldset
          key={group.key}
          group={group}
          view={view}
          draft={draft}
          commit={commit}
          sync={sync}
          resaleSelected={videoNotice(view, draft) === 'resale'}
        />
      ))}

      <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted">
        <Icon icon="lucide:info" width={14} className="mt-0.5 shrink-0" />
        Percentages apply to the video, set and extras above them, not to each other. {view.creatorName} confirms
        delivery dates on approval.
      </p>

      <ScriptSection view={view} draft={draft} commit={commit} sync={sync} total={total} resaleLabel={resaleLabel} />
    </div>
  )
}

/* --------------------------------- Groups --------------------------------- */

function Fieldset({
  group,
  view,
  draft,
  commit,
  sync,
  resaleSelected,
}: {
  group: OptionGroup
  view: CatalogView
  draft: Draft
  commit: (changes: Partial<Draft>) => void
  sync: DraftSyncValue | null
  resaleSelected: boolean
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{group.title}</legend>
      <div className={cn('space-y-2', group.key === 'resolution' && 'grid grid-cols-1 gap-2 sm:grid-cols-2 sm:space-y-0')}>
        {group.choices.map((choice) => (
          <Choice
            key={choice.item.id}
            group={group}
            choice={choice}
            view={view}
            draft={draft}
            commit={commit}
            sync={sync}
          />
        ))}
      </div>
      {group.key === 'name_use' && resaleSelected && (
        <p className="mt-2 text-xs text-muted">Choosing your name makes this video just for you.</p>
      )}
    </fieldset>
  )
}

function Choice({
  group,
  choice,
  view,
  draft,
  commit,
  sync,
}: {
  group: OptionGroup
  choice: OptionChoice
  view: CatalogView
  draft: Draft
  commit: (changes: Partial<Draft>) => void
  sync: DraftSyncValue | null
}) {
  const { item, selected, priceLabel, unavailableReason } = choice
  const disabled = unavailableReason !== null
  const descId = `${item.id}-why`
  const label = group.key === 'name_use' ? choiceLabel(item, draft.fanDisplayName) : item.label
  const showNameField = group.key === 'name_use' && selected && item.traits?.includes('uses_name')

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        disabled ? 'border-dashed border-divider text-muted' : selected ? 'border-espresso bg-secondary' : 'border-divider',
      )}
    >
      <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <input
            type="radio"
            name={group.key}
            checked={selected}
            disabled={disabled}
            onChange={() => commit(pickOption(view, draft, item.id))}
            aria-describedby={disabled ? descId : undefined}
            className="h-4 w-4 accent-espresso"
          />
          {label}
        </span>
        <span className={disabled ? undefined : 'text-muted'}>{priceLabel}</span>
      </label>
      {disabled && (
        <p id={descId} className="flex items-start gap-2 pb-1 pl-7 text-xs">
          <Icon icon="lucide:lock" width={14} className="mt-0.5 shrink-0" />
          {unavailableReason}
        </p>
      )}
      {showNameField && <NameField view={view} draft={draft} commit={commit} sync={sync} />}
    </div>
  )
}

/* ------------------------------- The name field ---------------------------- */

function NameField({
  view,
  draft,
  commit,
  sync,
}: {
  view: CatalogView
  draft: Draft
  commit: (changes: Partial<Draft>) => void
  sync: DraftSyncValue | null
}) {
  // Explicit "Change name" reopens the field; a save (blur/Enter) closes it again.
  // Uncontrolled input (defaultValue + key) so this never has to mirror the
  // draft into local state on every render.
  const [manualEdit, setManualEdit] = useState(false)

  const hasName = !!draft.fanDisplayName?.trim()
  const rejection = sync?.rejection
  const solicitation =
    rejection?.error === 'hard_list_blocked' && rejection.field === 'display_name' && rejection.key === 'solicitation'
  // A minors hit on the name follows its own safety-case path elsewhere, never this inline message.
  const otherBlock =
    rejection?.error === 'hard_list_blocked' &&
    rejection.field === 'display_name' &&
    rejection.key !== 'solicitation' &&
    rejection.key !== 'minors'
  // A block on the name always keeps the field open, whatever "Change name" last did.
  const editing = manualEdit || solicitation || otherBlock

  function save(raw: string) {
    const trimmed = raw.trim()
    commit({ fanDisplayName: trimmed || null })
    setManualEdit(false)
  }

  if (hasName && !editing) {
    return (
      <div className="pb-2 pt-1">
        <p className="flex items-center justify-between gap-3 text-sm">
          {sync?.status === 'saved' ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-okink">
              <Icon icon="lucide:cloud-check" width={14} />
              Saved to your account
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setManualEdit(true)}
            className="inline-flex min-h-[44px] items-center font-medium underline underline-offset-4 focus-ring"
          >
            Change name
          </button>
        </p>
        {otherBlock && rejection && (
          <div className="mt-2">
            <MessageBlocked boutiqueName={PILOT_BOUTIQUE_NAME} creatorName={view.creatorName} lines={rejection.lines} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pb-2 pt-1">
      <label htmlFor="fan-display-name" className="mb-1 block text-sm font-medium">
        What should {view.creatorName} call you?
      </label>
      <input
        key={editing ? 'editing' : 'closed'}
        id="fan-display-name"
        type="text"
        maxLength={NAME_MAX}
        autoComplete="nickname"
        defaultValue={draft.fanDisplayName ?? ''}
        onBlur={(event) => save(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            save(event.currentTarget.value)
          }
        }}
        aria-invalid={solicitation || undefined}
        aria-describedby={solicitation ? 'fan-name-error' : 'fan-name-hint'}
        placeholder="First name or nickname"
        className={cn(
          'w-full min-h-[44px] rounded-lg border bg-panel px-3 text-base focus-ring',
          solicitation ? 'border-2 border-alertink' : 'border-divider',
        )}
      />
      {solicitation ? (
        <p id="fan-name-error" role="alert" className="mt-2 flex items-start gap-2 text-sm text-alertink">
          <Icon icon="lucide:circle-alert" width={16} className="mt-0.5 shrink-0" />
          {view.creatorName} can&rsquo;t use this name. Use just a first name or nickname, with no phone number,
          email or links.
        </p>
      ) : (
        <p id="fan-name-hint" className="mt-1 text-xs text-muted">
          Just a first name or nickname. No surname or contact details.
        </p>
      )}
      {otherBlock && rejection && (
        <div className="mt-2">
          <MessageBlocked boutiqueName={PILOT_BOUTIQUE_NAME} creatorName={view.creatorName} lines={rejection.lines} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------- The script ------------------------------- */

function SavedIndicator({ status }: { status: SaveStatus | undefined }) {
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-okink">
        <Icon icon="lucide:cloud-check" width={14} />
        Saved to your account
      </span>
    )
  }
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Icon icon="lucide:loader" width={14} className="motion-safe:animate-spin" />
        Saving&hellip;
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-alertink">
        <Icon icon="lucide:cloud-off" width={14} />
        Not saved
      </span>
    )
  }
  return <span />
}

function ScriptRemovedNotice({ total, resaleLabel, bothCleared }: { total: number; resaleLabel: string; bothCleared: boolean }) {
  return (
    <div className="space-y-3">
      <div role="status" className="flex items-start gap-3 rounded-card border border-divider bg-panel p-4 text-sm">
        <Icon icon="lucide:circle-check" width={20} className="mt-0.5 shrink-0 text-okink" />
        <div>
          <p className="font-semibold">Script removed</p>
          <p className="text-muted">Your total is now {money(total)}.</p>
        </div>
      </div>
      {bothCleared && (
        <div className="flex items-start gap-3 rounded-card border border-divider bg-secondary p-4 text-sm">
          <Icon icon="lucide:unlock" width={20} className="mt-0.5 shrink-0 text-rose-deep" />
          <p>
            &ldquo;{resaleLabel}&rdquo; is available again, because nothing personal is in this video now.{' '}
            <span className="text-muted">&ldquo;Just for you&rdquo; stays selected.</span>
          </p>
        </div>
      )}
    </div>
  )
}

function ScriptSection({
  view,
  draft,
  commit,
  sync,
  total,
  resaleLabel,
}: {
  view: CatalogView
  draft: Draft
  commit: (changes: Partial<Draft>) => void
  sync: DraftSyncValue | null
  total: number
  resaleLabel: string
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justRemoved, setJustRemoved] = useState(false)
  const item = scriptItem(view)
  if (!item) return null

  const on = hasScript(view, draft)
  const rejection = sync?.rejection
  const scriptBlocked = rejection?.error === 'hard_list_blocked' && rejection.field === 'fan_script' && rejection.key !== 'minors'
  const priceLabel = item.pricing.kind === 'fixed' ? money(item.pricing.amount) : ''

  function addScript() {
    commit(setScript(view, draft, true))
    setJustRemoved(false)
  }
  function removeNow() {
    commit(setScript(view, draft, false))
    setConfirmOpen(false)
    setJustRemoved(true)
  }
  function requestRemove() {
    if (draft.fanScript?.trim()) setConfirmOpen(true)
    else removeNow()
  }

  if (!on) {
    return (
      <div className="space-y-3">
        {justRemoved && (
          <ScriptRemovedNotice
            total={total}
            resaleLabel={resaleLabel}
            bothCleared={!personalParts(view, draft).name && !personalParts(view, draft).script}
          />
        )}
        <button
          type="button"
          onClick={addScript}
          className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-card border border-divider bg-panel px-4 text-left text-sm font-medium transition-colors duration-160 hover:border-espresso focus-ring"
        >
          <span className="flex items-center gap-2">
            <Icon icon="lucide:pen-line" width={16} />
            Add your own script
          </span>
          <span className="shrink-0 text-muted">{priceLabel ? `+${priceLabel}` : ''}</span>
        </button>
      </div>
    )
  }

  const text = draft.fanScript ?? ''
  const empty = text.trim().length === 0

  return (
    <div className="rounded-card border border-divider bg-panel p-5 sm:p-6">
      <div className="mb-1 flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold">Your own script</h3>
        <span className="shrink-0 text-sm font-medium">{priceLabel}</span>
      </div>
      <p className="mb-4 text-sm text-muted">
        Write the lines you&rsquo;d like {view.creatorName} to say. {view.creatorName} reads it before approving,
        and may ask to change parts.
      </p>
      <label htmlFor="fan-script" className="sr-only">
        Your own script
      </label>
      <textarea
        id="fan-script"
        rows={7}
        maxLength={SCRIPT_MAX}
        aria-describedby={empty ? 'fan-script-need' : undefined}
        value={text}
        onChange={(event) => commit({ fanScript: event.target.value })}
        className="w-full resize-y rounded-lg border border-divider bg-cream px-4 py-3 text-base leading-relaxed focus-ring"
      />
      <div className="mt-2 flex items-start justify-between gap-3 text-xs text-muted">
        {empty ? (
          <span id="fan-script-need" className="inline-flex items-center gap-1.5 text-limitask-ink">
            <Icon icon="lucide:pen-line" width={14} />
            Write your script, or remove this option
          </span>
        ) : (
          <SavedIndicator status={sync?.status} />
        )}
        <span>
          {text.length.toLocaleString()} / {SCRIPT_MAX.toLocaleString()}
        </span>
      </div>
      {scriptBlocked && rejection && (
        <div className="mt-3">
          <MessageBlocked boutiqueName={PILOT_BOUTIQUE_NAME} creatorName={view.creatorName} lines={rejection.lines} />
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted">
        <Icon icon="lucide:shield-check" width={14} className="mt-0.5 shrink-0" />
        {view.creatorName}&rsquo;s limits apply to your script too. Because it&rsquo;s your writing, only you get
        this video.
      </p>
      <button
        type="button"
        onClick={requestRemove}
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-card border border-divider bg-panel px-4 text-sm font-medium transition-colors duration-160 hover:bg-secondary focus-ring"
      >
        <Icon icon="lucide:trash-2" width={16} />
        Remove script
      </button>
      {confirmOpen && <ScriptDiscardDialog view={view} draft={draft} onKeep={() => setConfirmOpen(false)} onDelete={removeNow} />}
    </div>
  )
}
