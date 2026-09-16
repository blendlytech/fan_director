import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { SceneImage } from '../components/common/SceneImage'
import { Header } from '../components/layout/Header'
import { ProgressTrail } from '../components/layout/ProgressTrail'
import { cn } from '../lib/cn'

/* -------------------------------------------------------------------------- */
/*  Catalog — deterministic prices, mirroring Maya's approved catalog.         */
/*  Local to this page on purpose: no shared data module at this stage.        */
/* -------------------------------------------------------------------------- */

const BUDGET = 150
const BASE_VIDEO_PRICE = 90
const BASE_MINUTES = 3
const PER_EXTRA_MINUTE = 40
const PERSONALIZED_GREETING_PRICE = 20

type SettingId = 'vintage' | 'floral' | 'backstage'
type FocusId = 'richer' | 'longer'

type SettingOption = {
  id: SettingId
  name: string
  blurb: string
  price: number
  image: string
  alt: string
  sceneTitle: string
  lineLabel: string
}

const SETTINGS: readonly SettingOption[] = [
  {
    id: 'vintage',
    name: 'Vintage Lounge',
    blurb: 'Cozy, intimate evening',
    price: 35,
    image:
      'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    alt: 'Warmly lit vintage lounge with velvet seating and soft lamps',
    sceneTitle: 'Vintage Lounge Greeting',
    lineLabel: 'Vintage Lounge Setup',
  },
  {
    id: 'floral',
    name: 'Floral Studio',
    blurb: 'Bright & celebratory',
    price: 45,
    image:
      'https://images.unsplash.com/photo-1563241527-2004cb630db0?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    alt: 'Bright studio table arranged with fresh cut flowers',
    sceneTitle: 'Floral Studio Greeting',
    lineLabel: 'Floral Studio Setup',
  },
  {
    id: 'backstage',
    name: 'Backstage',
    blurb: 'Raw & authentic',
    price: 15,
    image:
      'https://images.unsplash.com/photo-1517457224219-c60317e3df1c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    alt: 'Backstage dressing area with mirror lights and hanging garments',
    sceneTitle: 'Backstage Greeting',
    lineLabel: 'Backstage Setup',
  },
] as const

type FocusOption = {
  id: FocusId
  name: string
  blurb: string
  icon: string
}

const FOCUS_OPTIONS: readonly FocusOption[] = [
  {
    id: 'richer',
    name: 'Richer Setting',
    blurb: 'Keep 3 mins, add detailed personalized greeting',
    icon: 'lucide:sparkles',
  },
  {
    id: 'longer',
    name: 'Longer Video',
    blurb: 'Extend to 4 mins, standard greeting',
    icon: 'lucide:clock',
  },
] as const

/* -------------------------------------------------------------------------- */
/*  Scene card model                                                          */
/* -------------------------------------------------------------------------- */

type LineItemId = 'video' | 'runtime' | 'setup' | 'greeting'

type LineItem = {
  id: LineItemId
  label: string
  detail: string
  /** Amount in whole dollars. The estimated total is always the sum of these. */
  amount: number
  /** Renders the rose "Added" badge for options the fan chose. */
  added: boolean
  /** Only optional add-ons can be removed; required components cannot. */
  removable: boolean
  /** Which conversation control edits this line. */
  edits: EditTarget
}

type EditTarget = 'setting' | 'focus'

type FanNote = { id: number; text: string }

type Draft = {
  setting: SettingId
  focus: FocusId
  extraMinute: boolean
  notes: FanNote[]
}

const INITIAL_DRAFT: Draft = {
  setting: 'vintage',
  focus: 'richer',
  extraMinute: false,
  notes: [],
}

function settingOf(draft: Draft): SettingOption {
  // SETTINGS is exhaustive over SettingId, so this is always defined.
  return SETTINGS.find((option) => option.id === draft.setting) ?? SETTINGS[0]
}

function focusOf(draft: Draft): FocusOption {
  return FOCUS_OPTIONS.find((option) => option.id === draft.focus) ?? FOCUS_OPTIONS[0]
}

/** Extra minutes beyond the 3-minute base, from the focus choice and the add-on. */
function extraMinutesOf(draft: Draft): number {
  return (draft.focus === 'longer' ? 1 : 0) + (draft.extraMinute ? 1 : 0)
}

function buildLineItems(draft: Draft): LineItem[] {
  const setting = settingOf(draft)
  const extraMinutes = extraMinutesOf(draft)
  const items: LineItem[] = [
    {
      id: 'video',
      label: `${BASE_MINUTES}-Minute Video`,
      detail: 'Standard base rate',
      amount: BASE_VIDEO_PRICE,
      added: false,
      removable: false,
      edits: 'focus',
    },
  ]

  if (extraMinutes > 0) {
    items.push({
      id: 'runtime',
      label: `Extra Runtime (+${extraMinutes} min)`,
      detail: `$${PER_EXTRA_MINUTE} per additional minute · ${BASE_MINUTES + extraMinutes} minutes total`,
      amount: extraMinutes * PER_EXTRA_MINUTE,
      added: true,
      removable: true,
      edits: 'focus',
    })
  }

  items.push({
    id: 'setup',
    label: setting.lineLabel,
    detail: 'Set dressing & lighting',
    amount: setting.price,
    added: true,
    removable: false,
    edits: 'setting',
  })

  items.push(
    draft.focus === 'richer'
      ? {
          id: 'greeting',
          label: 'Personalized Greeting',
          detail: 'Detailed opening & closing',
          amount: PERSONALIZED_GREETING_PRICE,
          added: true,
          removable: false,
          edits: 'focus',
        }
      : {
          id: 'greeting',
          label: 'Standard Greeting',
          detail: 'Included with every commission',
          amount: 0,
          added: false,
          removable: false,
          edits: 'focus',
        },
  )

  return items
}

function sumOf(items: readonly LineItem[]): number {
  return items.reduce((running, item) => running + item.amount, 0)
}

/** Total for a hypothetical draft — used to price the choice cards honestly. */
function previewTotal(draft: Draft, changes: Partial<Draft>): number {
  return sumOf(buildLineItems({ ...draft, ...changes }))
}

const money = (amount: number) => `$${amount}`

/* -------------------------------------------------------------------------- */
/*  Composer prompt starters — canned text, never sent automatically.          */
/* -------------------------------------------------------------------------- */

const PROMPT_STARTERS: readonly string[] = [
  'Could the vintage lounge lean more into 80s neon without changing the price?',
  'What would it cost to swap the setting but keep the personalized greeting?',
  'Is there a catalog option for a handwritten card alongside the video?',
  'Can you show me the cheapest arrangement that still feels cinematic?',
] as const

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function AIDirector() {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [history, setHistory] = useState<Draft[]>([])
  const [message, setMessage] = useState('')
  const [starterIndex, setStarterIndex] = useState(0)
  const [savedLocally, setSavedLocally] = useState(false)

  const settingGroupRef = useRef<HTMLDivElement>(null)
  const focusGroupRef = useRef<HTMLDivElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const lineItems = useMemo(() => buildLineItems(draft), [draft])
  const total = useMemo(() => sumOf(lineItems), [lineItems])
  const difference = BUDGET - total
  const overBudget = difference < 0
  const setting = settingOf(draft)
  const focus = focusOf(draft)
  const minutes = BASE_MINUTES + extraMinutesOf(draft)
  const removableItem = lineItems.find((item) => item.removable)

  const budgetSentence = overBudget
    ? `${money(Math.abs(difference))} over budget`
    : `${money(difference)} under budget`

  function commit(changes: Partial<Draft>) {
    setHistory((past) => [...past, draft])
    setDraft((current) => ({ ...current, ...changes }))
  }

  function undo() {
    if (history.length === 0) return
    setDraft(history[history.length - 1])
    setHistory((past) => past.slice(0, -1))
  }

  function focusGroup(target: EditTarget) {
    const container = target === 'setting' ? settingGroupRef.current : focusGroupRef.current
    if (!container) return
    container.scrollIntoView({ block: 'center', behavior: 'smooth' })
    container.querySelector<HTMLButtonElement>('button')?.focus()
  }

  function sendMessage() {
    const text = message.trim()
    if (!text) return
    setHistory((past) => [...past, draft])
    setDraft((current) => ({
      ...current,
      notes: [...current.notes, { id: Date.now(), text }],
    }))
    setMessage('')
    window.requestAnimationFrame(() => {
      threadEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  function suggestIdea() {
    setMessage(PROMPT_STARTERS[starterIndex % PROMPT_STARTERS.length])
    setStarterIndex((index) => index + 1)
    composerRef.current?.focus()
  }

  return (
    <div className="flex min-h-screen flex-col pb-40 lg:pb-0">
      <Header />

      <main className="mx-auto w-full max-w-container flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* ---------------------------------------------------------------- */}
        {/* Title + progress trail                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-8 lg:mb-12">
          <Link
            to="/"
            className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted transition-colors duration-160 hover:text-espresso focus-ring"
          >
            <Icon icon="lucide:arrow-left" width={18} />
            Back to collection
          </Link>

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <h1 className="mb-3 text-3xl leading-tight sm:text-[44px]">
                A little inspiration. Entirely yours.
              </h1>
              <p className="text-sm leading-relaxed text-muted sm:text-base">
                The AI Director is helping plan your commission. All suggestions are from Maya's
                approved catalog.
              </p>
            </div>
            <ProgressTrail currentStep={1} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          {/* -------------------------------------------------------------- */}
          {/* Column 1 — conversation                                         */}
          {/* -------------------------------------------------------------- */}
          <div className="flex flex-col lg:col-span-7">
            <div className="mb-8 flex-1 space-y-8">
              {/* Turn 1 — fan brief */}
              <Turn speaker="fan">
                <p className="text-sm leading-relaxed sm:text-base">
                  I'd love a cinematic personal greeting for my anniversary. Something atmospheric,
                  budget is under {money(BUDGET)}.
                </p>
              </Turn>

              {/* Turn 2 — Director offers the setting catalog */}
              <Turn speaker="director">
                <p className="text-sm leading-relaxed sm:text-base">
                  Which vibe resonates—vintage lounge (cozy, intimate), floral studio (bright,
                  celebratory), or backstage (raw, authentic)?
                </p>

                <div
                  ref={settingGroupRef}
                  role="radiogroup"
                  aria-label="Scene setting"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                  {SETTINGS.map((option) => {
                    const selected = option.id === draft.setting
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => commit({ setting: option.id })}
                        className={cn(
                          'group relative flex flex-col overflow-hidden rounded-card p-3 text-left transition-all duration-160 focus-ring sm:block',
                          selected
                            ? 'border-2 border-rose bg-panel shadow-subtle'
                            : 'border border-divider bg-panel hover:border-muted hover:shadow-subtle',
                        )}
                      >
                        {selected && (
                          <span className="absolute right-2 top-2 z-10 flex h-5 w-5 animate-bounce-in items-center justify-center rounded-full bg-rose text-espresso">
                            <Icon icon="lucide:check" width={12} />
                          </span>
                        )}
                        <span className="mb-3 block h-20 overflow-hidden rounded-lg border border-divider bg-secondary sm:h-24">
                          <SceneImage
                            src={option.image}
                            alt={option.alt}
                            className="transition-transform duration-500 group-hover:scale-105"
                          />
                        </span>
                        <span className="block">
                          <span className="mb-0.5 block text-sm font-medium">{option.name}</span>
                          <span className="block text-[11px] text-muted">{option.blurb}</span>
                          <span
                            className={cn(
                              'mt-1 block text-[11px]',
                              selected ? 'font-medium text-espresso' : 'text-muted',
                            )}
                          >
                            +{money(option.price)} setup
                            {selected && <span className="sr-only"> — selected</span>}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                <p className="flex items-center gap-1.5 text-[11px] text-muted">
                  <Icon icon="lucide:info" width={12} />
                  Reference imagery, not a preview of your order.
                </p>
              </Turn>

              {/* Turn 3 — fan confirms the setting */}
              <Turn speaker="fan">
                <SelectionChip label={`Selected: ${setting.name}`} />
                {draft.setting === 'vintage' && (
                  <p className="text-sm leading-relaxed sm:text-base">
                    Let's do the Vintage Lounge. My partner loves 80s aesthetics.
                  </p>
                )}
              </Turn>

              {/* Turn 4 — Director frames the tradeoff */}
              <Turn speaker="director">
                <p className="text-sm leading-relaxed sm:text-base">
                  Perfect. Would you prefer a longer video (+{money(PER_EXTRA_MINUTE)}/min) to tell
                  more of your story, or focus on a richer setting with detailed greeting within your
                  budget?
                </p>

                <div
                  ref={focusGroupRef}
                  role="radiogroup"
                  aria-label="Where to spend the budget"
                  className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
                >
                  {FOCUS_OPTIONS.map((option) => {
                    const selected = option.id === draft.focus
                    const optionTotal = previewTotal(draft, {
                      focus: option.id,
                      extraMinute: false,
                    })
                    const optionOver = optionTotal > BUDGET
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => commit({ focus: option.id })}
                        className={cn(
                          'relative overflow-hidden rounded-card p-4 text-left transition-all duration-160 focus-ring',
                          selected
                            ? 'border-2 border-espresso bg-rose/10 shadow-subtle'
                            : 'border border-divider bg-panel hover:border-muted hover:shadow-subtle',
                        )}
                      >
                        {selected && (
                          <span className="absolute right-3 top-3 animate-bounce-in text-espresso">
                            <Icon icon="lucide:check-circle-2" width={20} />
                          </span>
                        )}
                        <span className="mb-2 flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border border-divider',
                              selected ? 'bg-panel text-rose-deep shadow-sm' : 'bg-secondary text-muted',
                            )}
                          >
                            <Icon icon={option.icon} width={18} />
                          </span>
                          <span className="text-sm font-medium">{option.name}</span>
                        </span>
                        <span className="mb-2 block text-[11px] text-muted sm:text-xs">
                          {option.blurb}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium',
                            optionOver
                              ? 'border-divider bg-secondary text-muted'
                              : 'border-divider bg-panel text-espresso',
                          )}
                        >
                          <Icon
                            icon={optionOver ? 'lucide:alert-circle' : 'lucide:check-circle-2'}
                            width={11}
                          />
                          Total: {money(optionTotal)} {optionOver ? '(Exceeds budget)' : '(Under budget)'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Turn>

              {/* Turn 5 — fan confirms the tradeoff */}
              <Turn speaker="fan">
                <SelectionChip label={`Selected: ${focus.name}`} />
              </Turn>

              {/* Turn 6 — Director recaps the deterministic estimate */}
              <Turn speaker="director">
                <p className="text-sm leading-relaxed sm:text-base">
                  That's {money(total)} total—{setting.name.toLowerCase()} setup, {minutes}-minute
                  video, {draft.focus === 'richer' ? 'personalized greeting' : 'standard greeting'}.{' '}
                  {budgetSentence}. Ready to review your Scene Card?
                </p>

                <div className="rounded-card border border-divider bg-panel p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon icon="lucide:list-plus" width={14} className="text-muted" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Optional add-on from Maya's catalog
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-pressed={draft.extraMinute}
                    onClick={() => commit({ extraMinute: !draft.extraMinute })}
                    className={cn(
                      'flex w-full min-h-[44px] items-center justify-between gap-3 rounded-card border p-3 text-left transition-all duration-160 focus-ring',
                      draft.extraMinute
                        ? 'border-2 border-espresso bg-rose/10'
                        : 'border-divider bg-secondary hover:border-muted',
                    )}
                  >
                    <span>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon
                          icon={draft.extraMinute ? 'lucide:check-square' : 'lucide:square'}
                          width={15}
                        />
                        Extra minute of runtime
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
                        +{money(PER_EXTRA_MINUTE)} · {draft.extraMinute ? 'Added' : 'Not added'}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">
                      {money(previewTotal(draft, { extraMinute: !draft.extraMinute }))}
                    </span>
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    Prices come from Maya's approved catalog. The Director cannot invent options or
                    prices outside it.
                  </p>
                </div>
              </Turn>

              {/* Fan's own free-text notes */}
              {draft.notes.length > 0 && (
                <>
                  {draft.notes.map((note) => (
                    <Turn key={note.id} speaker="fan">
                      <p className="animate-slide-up whitespace-pre-wrap text-sm leading-relaxed sm:text-base">
                        {note.text}
                      </p>
                    </Turn>
                  ))}
                  <p className="flex items-start gap-2 rounded-card border border-divider bg-secondary/60 p-3 text-[11px] leading-relaxed text-muted">
                    <Icon icon="lucide:info" width={13} className="mt-0.5 shrink-0" />
                    <span>
                      Prototype note: this demo has no AI behind it. Your notes are kept with the
                      draft on this page only — the Director does not generate new replies, and
                      nothing is sent anywhere yet.
                    </span>
                  </p>
                </>
              )}

              <div ref={threadEndRef} />
            </div>

            {/* ------------------------------------------------------------ */}
            {/* Composer                                                      */}
            {/* ------------------------------------------------------------ */}
            <div className="sticky bottom-28 z-30 bg-cream pt-2 lg:bottom-4 lg:pt-4">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  sendMessage()
                }}
                className="overflow-hidden rounded-card border border-divider bg-panel shadow-subtle transition-shadow focus-within:border-espresso"
              >
                <label htmlFor="director-composer" className="sr-only">
                  Tell the Director what you have in mind
                </label>
                <textarea
                  id="director-composer"
                  ref={composerRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell the Director what you have in mind or ask for suggestions..."
                  className="min-h-[100px] w-full resize-none border-0 bg-transparent p-4 text-sm text-espresso placeholder:text-muted focus:outline-none sm:p-5 sm:text-base"
                />
                <div className="flex items-center justify-between gap-2 border-t border-divider bg-secondary px-3 py-3 sm:px-4">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={suggestIdea}
                      title="Insert a canned prompt starter into the box (nothing is sent)"
                      className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-transparent px-3 text-[11px] font-medium text-muted transition-colors duration-160 hover:border-divider hover:bg-panel hover:text-espresso focus-ring sm:flex"
                    >
                      <Icon icon="lucide:wand-2" width={14} />
                      Suggest an idea
                    </button>
                    <button
                      type="button"
                      onClick={undo}
                      disabled={history.length === 0}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-transparent px-3 text-[11px] font-medium text-muted transition-colors duration-160 hover:border-divider hover:bg-panel hover:text-espresso focus-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-muted"
                    >
                      <Icon icon="lucide:undo-2" width={14} />
                      <span className="hidden sm:inline">Undo</span>
                      <span className="sr-only">
                        {history.length === 0 ? 'Nothing to undo' : 'Undo last change'}
                      </span>
                    </button>
                  </div>
                  <Button type="submit" variant="primary" size="sm" icon="lucide:send" disabled={message.trim() === ''}>
                    Send
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Column 2 — live Scene Card                                      */}
          {/* -------------------------------------------------------------- */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[104px]">
              <section
                aria-label="Live Scene Card"
                className="overflow-hidden rounded-card border border-divider bg-panel shadow-subtle"
              >
                {/* Header */}
                <div className="border-b border-divider bg-secondary p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full border border-rose bg-panel px-2.5 py-1 text-xs font-medium text-espresso shadow-sm">
                      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-rose" />
                      Status: Draft
                    </span>
                    <button
                      type="button"
                      aria-pressed={savedLocally}
                      onClick={() => setSavedLocally((saved) => !saved)}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted transition-colors duration-160 hover:bg-panel hover:text-espresso focus-ring"
                    >
                      <Icon
                        icon={savedLocally ? 'lucide:bookmark-check' : 'lucide:bookmark'}
                        width={14}
                      />
                      {savedLocally ? 'Saved for this session' : 'Save idea'}
                    </button>
                  </div>
                  <h2 className="mb-2 text-[28px] leading-tight">{setting.sceneTitle}</h2>
                  <p className="text-sm text-muted">
                    A cinematic personalized message for your anniversary.
                  </p>
                </div>

                {/* Included components */}
                <div className="border-b border-divider px-6 pt-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                    Included components
                  </h3>
                  <ul className="mb-6 flex flex-wrap gap-2">
                    {lineItems.map((item) => (
                      <li
                        key={`chip-${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-secondary px-2.5 py-1 text-[11px] text-espresso"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose" />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Itemized line items */}
                <ul className="space-y-6 border-b border-divider p-6">
                  {lineItems.map((item) => (
                    <li key={item.id} className="group flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {item.added && (
                            <span className="rounded bg-rose px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-espresso">
                              Added
                            </span>
                          )}
                          <h4 className="text-sm font-medium">{item.label}</h4>
                          <button
                            type="button"
                            onClick={() => focusGroup(item.edits)}
                            className="-my-2 flex h-11 w-11 items-center justify-center rounded text-muted opacity-100 transition-all duration-160 hover:bg-secondary hover:text-espresso focus-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                          >
                            <Icon icon="lucide:pencil" width={12} />
                            <span className="sr-only">Edit {item.label}</span>
                          </button>
                          {item.removable && (
                            <button
                              type="button"
                              onClick={() => commit({ focus: 'richer', extraMinute: false })}
                              className="-my-2 flex h-11 items-center gap-1 rounded px-2 text-[11px] font-medium text-muted transition-colors duration-160 hover:bg-secondary hover:text-alert focus-ring"
                            >
                              <Icon icon="lucide:x" width={12} />
                              Remove
                              <span className="sr-only"> {item.label}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-sm font-medium">
                        {item.amount === 0 ? 'Included' : money(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Totals + budget indicator */}
                <div
                  aria-live="polite"
                  className="relative overflow-hidden bg-secondary p-6"
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-rose opacity-10 blur-2xl" />

                  <div className="relative z-10 mb-2 flex items-end justify-between gap-3">
                    <span className="text-sm font-medium uppercase tracking-wider text-muted">
                      Estimated Total
                    </span>
                    <span
                      key={total}
                      className="animate-price-flash rounded px-1 font-serif text-2xl font-bold tracking-tight text-espresso"
                    >
                      {money(total)}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-3 text-xs text-muted">
                    <span>Budget limit: {money(BUDGET)}</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded border px-2 py-1 font-medium text-espresso',
                        overBudget ? 'border-alert bg-alert/15' : 'border-success bg-success/20',
                      )}
                    >
                      <Icon
                        icon={overBudget ? 'lucide:alert-triangle' : 'lucide:check-circle-2'}
                        width={12}
                        className={overBudget ? 'text-alert' : 'text-rose-deep'}
                      />
                      {budgetSentence}
                    </span>
                  </div>

                  {overBudget && (
                    <div className="relative z-10 mt-3 rounded-card border border-alert bg-alert/10 p-3">
                      <p className="mb-2 text-[11px] leading-relaxed text-espresso">
                        This estimate is {money(Math.abs(difference))} above the {money(BUDGET)}{' '}
                        budget you gave the Director.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {removableItem && (
                          <button
                            type="button"
                            onClick={() => commit({ focus: 'richer', extraMinute: false })}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-alert bg-panel px-3 text-[11px] font-medium text-espresso transition-colors duration-160 hover:bg-alert hover:text-white focus-ring"
                          >
                            <Icon icon="lucide:x" width={12} />
                            Remove {removableItem.label}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => focusGroup('setting')}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-divider bg-panel px-3 text-[11px] font-medium text-espresso transition-colors duration-160 hover:bg-secondary focus-ring"
                        >
                          <Icon icon="lucide:pencil" width={12} />
                          Choose a lighter setting
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery + boundaries */}
                <div className="space-y-5 border-t border-divider p-6">
                  <div className="flex gap-3 text-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-divider bg-secondary text-muted">
                      <Icon icon="lucide:truck" width={16} />
                    </span>
                    <div>
                      <p className="mb-0.5 font-medium">Standard Delivery</p>
                      <p className="text-xs leading-relaxed text-muted">
                        Estimated 7 days after payment confirmation. Subject to creator approval.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 rounded-lg border border-divider bg-secondary/50 p-3 text-sm">
                    <Icon icon="lucide:shield-check" width={16} className="mt-0.5 shrink-0 text-muted" />
                    <div className="space-y-1 text-[11px] leading-relaxed text-muted">
                      <p className="mb-1 font-medium text-espresso">Creator Boundaries Apply</p>
                      <p>
                        All options are selected from Maya's approved catalog. Wardrobe and setting
                        adhere to non-explicit guidelines.
                      </p>
                      <p>
                        Final scope, price, and delivery date require creator review before any
                        payment is taken.
                      </p>
                    </div>
                  </div>

                  <details className="rounded-lg border border-divider bg-panel">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-medium text-espresso focus-ring">
                      What "within listed options" means
                      <Icon icon="lucide:chevron-down" width={14} className="text-muted" />
                    </summary>
                    <div className="space-y-2 border-t border-divider px-3 py-3 text-[11px] leading-relaxed text-muted">
                      <p>
                        <span className="font-medium text-espresso">Within listed options</span> means
                        every component above already exists in Maya's published catalog at the price
                        shown. It is not the same as approved.
                      </p>
                      <p>
                        <span className="font-medium text-espresso">Creator approved</span> only
                        happens after Maya reviews this Scene Card and confirms the scope, price and
                        delivery date herself.
                      </p>
                      <p>
                        Anything outside the listed options is a custom request: the Director cannot
                        price it, and Maya has to review it before it can go ahead.
                      </p>
                      <p>
                        Estimates on this page are subject to approval. No payment is taken by this
                        prototype.
                      </p>
                    </div>
                  </details>
                </div>

                {/* CTA */}
                <div className="p-6 pt-0">
                  <Button
                    to="/review"
                    variant="primary"
                    size="md"
                    icon="lucide:arrow-right"
                    className="w-full"
                  >
                    Review Scene Card
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile sticky estimate bar                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-panel p-4 shadow-modal lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div aria-live="polite">
            <h2 className="text-lg font-bold">Scene Estimate</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span key={total} className="animate-price-flash rounded px-0.5 text-xl font-bold tracking-tight">
                {money(total)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium text-espresso',
                  overBudget ? 'border-alert bg-alert/15' : 'border-success bg-success/20',
                )}
              >
                <Icon
                  icon={overBudget ? 'lucide:alert-triangle' : 'lucide:check-circle-2'}
                  width={10}
                  className={overBudget ? 'text-alert' : 'text-rose-deep'}
                />
                {overBudget ? `${money(Math.abs(difference))} over` : `${money(difference)} under`}
              </span>
            </div>
          </div>
          <Button to="/review" variant="primary" size="sm" icon="lucide:arrow-right">
            Review
          </Button>
        </div>
        {overBudget && removableItem && (
          <button
            type="button"
            onClick={() => commit({ focus: 'richer', extraMinute: false })}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-card border border-alert bg-alert/10 px-3 text-[11px] font-medium text-espresso transition-colors duration-160 hover:bg-alert hover:text-white focus-ring"
          >
            <Icon icon="lucide:x" width={12} />
            Remove {removableItem.label} to get back under budget
          </button>
        )}
        <p className="mt-2 text-center text-[10px] text-muted">
          Estimate only — subject to creator approval. No payment is taken.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small presentational pieces                                               */
/* -------------------------------------------------------------------------- */

function Turn({ speaker, children }: { speaker: 'fan' | 'director'; children: ReactNode }) {
  const isDirector = speaker === 'director'
  return (
    <article className="flex gap-4">
      <span
        aria-hidden
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isDirector
            ? 'bg-espresso text-cream'
            : 'border border-divider bg-secondary text-muted',
        )}
      >
        <Icon icon={isDirector ? 'lucide:sparkles' : 'lucide:user'} width={15} />
      </span>
      <div className="w-full space-y-4 pt-1">
        <h3 className="sr-only">{isDirector ? 'AI Director' : 'You'}</h3>
        {children}
      </div>
    </article>
  )
}

function SelectionChip({ label }: { label: string }) {
  return (
    <span className="mb-2 inline-flex items-center gap-2 rounded-card border border-divider bg-panel px-3 py-1.5">
      <span className="h-2 w-2 rounded-full bg-rose" />
      <span className="text-xs font-medium">{label}</span>
    </span>
  )
}
