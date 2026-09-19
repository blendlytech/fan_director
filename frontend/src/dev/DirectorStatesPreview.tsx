import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AskFirstNotice, DirectorSuggestion } from '../api/types'
import { CatalogSheet } from '../components/director/CatalogSheet'
import { CustomRequestOffer } from '../components/director/CustomRequestOffer'
import { DirectorUnavailable } from '../components/director/DirectorUnavailable'
import { LimitNotice } from '../components/director/LimitNotice'
import { MessageBlocked } from '../components/director/MessageBlocked'
import { RepliesCounter } from '../components/director/RepliesCounter'
import { RepliesExhausted } from '../components/director/RepliesExhausted'
import { SuggestionCard } from '../components/director/SuggestionCard'
import { SuggestionOutcome } from '../components/director/SuggestionOutcome'
import { ThinkingIndicator } from '../components/director/ThinkingIndicator'
import { ChangedElsewhereNotice } from '../components/save/ChangedElsewhereNotice'
import { PriceChangeNotice } from '../components/save/PriceChangeNotice'
import { SaveStatus } from '../components/save/SaveStatus'

/* -------------------------------------------------------------------------- */
/*  A single page that mounts every state of every director/ and save/        */
/*  component, for visual review and Playwright screenshots. Not routed —    */
/*  the lead mounts this in dev builds only.                                  */
/*                                                                              */
/*  Fixtures use creator "Maya" / boutique "Maya Atelier", matching the       */
/*  designs. The "richer greeting" suggestion (deltaCents 2000, newTotalCents */
/*  14500, budgetDifferenceCents 500) mirrors design 17 B's own numbers        */
/*  ($20 adds, $145 new estimate, $5 under budget) so the screenshot lines up  */
/*  with the source design.                                                   */
/* -------------------------------------------------------------------------- */

const CREATOR_NAME = 'Maya'
const BOUTIQUE_NAME = 'Maya Atelier'

const RICHER_GREETING: DirectorSuggestion = {
  id: 'sugg-1',
  title: 'Richer greeting',
  adds: [{ label: 'Detailed greeting', qty: 1, before: 0 }],
  removes: [],
  deltaCents: 2000,
  newTotalCents: 14500,
  budgetDifferenceCents: 500,
  askFirst: [],
}

const EXTRA_MINUTE_SAVES: DirectorSuggestion = {
  id: 'sugg-2',
  title: 'Trim to fit your budget',
  adds: [{ label: 'Standard greeting', qty: 1, before: 0 }],
  removes: [{ label: 'Detailed greeting' }],
  deltaCents: -1500,
  newTotalCents: 11000,
  budgetDifferenceCents: 4000,
  askFirst: [],
}

const ASK_FIRST_NOTICE: AskFirstNotice = {
  limit: 'partner-scenes',
  heading: 'Ask Maya first',
  body: 'This touches one of Maya’s limits: “Scenes with my partner, Leo.” You can add it. Maya may say no, or set a price for it after reading your request.',
  accept: 'Add and ask Maya',
  decline: 'Not this one',
  footnote: 'No price is shown for this part yet. Maya sets it.',
}

const ASK_FIRST_SUGGESTION: DirectorSuggestion = {
  id: 'sugg-3',
  title: 'Add Leo to the scene',
  adds: [{ label: 'Leo appears in the scene', qty: 1, before: 0 }],
  removes: [],
  deltaCents: 0,
  newTotalCents: 14500,
  budgetDifferenceCents: null,
  askFirst: [ASK_FIRST_NOTICE],
}

const CATALOG_SETTINGS = [
  { id: 'vintage', name: 'Vintage Lounge', priceCents: 3500 },
  { id: 'floral', name: 'Floral Studio', priceCents: 4500 },
  { id: 'backstage', name: 'Backstage', priceCents: 1500 },
]

const CATALOG_GREETINGS = [
  { id: 'standard', name: 'Standard greeting', priceCents: 0 },
  { id: 'detailed', name: 'Detailed greeting', priceCents: 2000 },
]

const PRICE_CHANGE_ROWS = [
  { label: '3-minute video', beforeCents: 9000, nowCents: 9000 },
  { label: 'Vintage Lounge', beforeCents: 3500, nowCents: 4000 },
  { label: 'Detailed greeting', beforeCents: 2000, nowCents: 2000 },
]

function Heading({ children }: { children: string }) {
  return (
    <p className="mb-4 font-mono text-xs uppercase tracking-wider text-muted">{children}</p>
  )
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section aria-label={heading} className="max-w-[680px]">
      <Heading>{heading}</Heading>
      {children}
    </section>
  )
}

export default function DirectorStatesPreview() {
  const [settingId, setSettingId] = useState('vintage')
  const [greetingId, setGreetingId] = useState('detailed')
  const [extraMinutes, setExtraMinutes] = useState(0)
  const [savedAt] = useState(() => new Date(2026, 8, 18, 14, 32))

  return (
    <div className="min-h-screen bg-cream font-sans text-espresso">
      <main className="mx-auto max-w-3xl space-y-16 px-4 py-12 sm:px-6">
        <Section heading="17 A">
          <ThinkingIndicator />
          <div className="mt-2">
            <RepliesCounter left={14} />
          </div>
          <div className="mt-1">
            <RepliesCounter left={1} />
          </div>
          <div className="mt-1">
            <RepliesCounter left={5} />
          </div>
        </Section>

        <Section heading="17 B">
          <SuggestionCard
            suggestion={RICHER_GREETING}
            creatorName={CREATOR_NAME}
            budgetSet
            busy={false}
            onAccept={() => {}}
            onDecline={() => {}}
          />
        </Section>

        <Section heading="17 B (saves)">
          <SuggestionCard
            suggestion={EXTRA_MINUTE_SAVES}
            creatorName={CREATOR_NAME}
            budgetSet
            busy={false}
            onAccept={() => {}}
            onDecline={() => {}}
          />
        </Section>

        <Section heading="13 C1">
          <SuggestionCard
            suggestion={ASK_FIRST_SUGGESTION}
            creatorName={CREATOR_NAME}
            budgetSet={false}
            busy={false}
            onAccept={() => {}}
            onDecline={() => {}}
          />
        </Section>

        <Section heading="17 C accepted/declined/out of date">
          <div className="space-y-4">
            <SuggestionOutcome kind="accepted" title="Richer greeting" totalCents={14500} onUndo={() => {}} />
            <SuggestionOutcome kind="declined" title="One more minute" />
            <SuggestionOutcome kind="out_of_date" title="Richer greeting" />
          </div>
        </Section>

        <Section heading="17 D">
          <DirectorUnavailable onCatalog={() => {}} onRetry={() => {}} />
        </Section>

        <Section heading="17 E">
          <RepliesExhausted onCatalog={() => {}} />
        </Section>

        <Section heading="17 F">
          {/* On narrow viewports CatalogSheet renders its mobile sheet as
              `position: fixed`, which is correct in the real app but would
              otherwise escape this long, single-page preview and overlay
              unrelated sections above it. `contain: layout` on this wrapper
              gives fixed descendants a local containing block instead, so it
              renders in place. Note this box only substitutes for the real
              viewport's *position*, not its size: the panel's own 85vh cap is
              a true viewport unit and isn't rescoped by contain, so this demo
              frame is sized tall enough that the panel's real content never
              needs the internal scroll a shorter phone viewport would apply. */}
          <div
            style={{ position: 'relative', contain: 'layout', height: 760, overflow: 'hidden' }}
            className="rounded-card border border-divider"
          >

            <CatalogSheet
              open
              onClose={() => {}}
              creatorName={CREATOR_NAME}
              settings={CATALOG_SETTINGS}
              settingId={settingId}
              greetings={CATALOG_GREETINGS}
              greetingId={greetingId}
              extraMinutes={extraMinutes}
              maxExtraMinutes={2}
              perExtraMinuteCents={4000}
              onSetting={setSettingId}
              onGreeting={setGreetingId}
              onExtraMinutes={setExtraMinutes}
            />
          </div>
        </Section>

        <Section heading="13 C2">
          <LimitNotice
            heading={'Maya doesn’t do this'}
            body={
              '“Filming outdoors” is one of Maya’s limits, so it’s been left out of your plan. Everything else you asked for is still here.'
            }
          />
        </Section>

        <Section heading="13 C3">
          <MessageBlocked
            boutiqueName={BOUTIQUE_NAME}
            creatorName={CREATOR_NAME}
            lines={['School, student, childlike, family or step-family roles']}
          />
        </Section>

        <Section heading="Custom request offer">
          <CustomRequestOffer
            text="Could you do a slow pan across the vintage lounge before you start talking?"
            offer="Maya can add a slow establishing pan for $15."
            accept="Add for $15"
            decline="No thanks"
            onAccept={() => {}}
            onDecline={() => {}}
            busy={false}
          />
        </Section>

        <Section heading="18 A1">
          <div className="rounded-card border border-divider bg-secondary p-5">
            <SaveStatus status="saving" savedAt={null} onRetry={() => {}} />
          </div>
        </Section>

        <Section heading="18 A2">
          <div className="rounded-card border border-divider bg-secondary p-5">
            <SaveStatus status="saved" savedAt={savedAt} onRetry={() => {}} />
          </div>
        </Section>

        <Section heading="18 A3">
          <div className="rounded-card border border-divider bg-secondary p-5">
            <SaveStatus status="failed" savedAt={null} onRetry={() => {}} />
          </div>
        </Section>

        <Section heading="18 A4">
          <div className="rounded-card border border-divider bg-secondary p-5">
            <SaveStatus status="signed_out" savedAt={null} onRetry={() => {}} />
          </div>
        </Section>

        <Section heading="18 B">
          <ChangedElsewhereNotice onDismiss={() => {}} />
        </Section>

        <Section heading="18 C">
          <PriceChangeNotice
            creatorName={CREATOR_NAME}
            rows={PRICE_CHANGE_ROWS}
            beforeTotalCents={14500}
            nowTotalCents={15000}
            budgetDifferenceCents={0}
            onAccept={() => {}}
            onChange={() => {}}
            busy={false}
          />
        </Section>
      </main>
    </div>
  )
}
