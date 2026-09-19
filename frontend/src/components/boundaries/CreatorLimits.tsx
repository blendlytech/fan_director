import { Link } from 'react-router-dom'
import type { RenderedBoundaries } from '../../../../shared/domain/boundaries.ts'
import { PILOT_BOUTIQUE_NAME } from '../../../../shared/catalog/pilot-v1.ts'
import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Creator limits, drawn from design 13 (docs/designs/html/13-creator-       */
/*  limits.html). Staging only: the public demo keeps its own copy. Every     */
/*  line comes from the one boundaries renderer (shared/domain/boundaries),   */
/*  so the entrance, the Director and the review screen always agree.         */
/*                                                                            */
/*  Design 13's rules: limits are never collapsed or truncated; one limit per */
/*  line; meaning never depends on colour alone (every group has a heading,   */
/*  an icon and a count); "doesn't do" first, then "ask first", then the      */
/*  platform rules.                                                            */
/* -------------------------------------------------------------------------- */

type Props = { boundaries: RenderedBoundaries; creatorName: string }

/** Design 13, state A: the full panel. On the entrance, before planning, and on the review screen. */
export function LimitsPanel({ boundaries, creatorName, id = 'limits-panel' }: Props & { id?: string }) {
  const { hardNo, askFirst } = boundaries
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-[100px] rounded-card border border-divider bg-panel p-6 shadow-subtle sm:p-8"
    >
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon icon="lucide:shield-check" width={22} className="text-rose-deep" />
        </div>
        <div>
          <h2 id={`${id}-title`} className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {creatorName}&rsquo;s limits
          </h2>
          <p className="mt-1 text-base text-muted">
            Please read these before you plan. {creatorName} wrote them, and they apply to every request.
          </p>
          {boundaries.wardrobeCreatorCurated && (
            <p className="mt-1 text-base text-muted">{creatorName} chooses the wardrobe.</p>
          )}
        </div>
      </div>

      {(hardNo.length > 0 || askFirst.length > 0) && (
        <div className={hardNo.length > 0 && askFirst.length > 0 ? 'grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2' : 'grid grid-cols-1'}>
          {hardNo.length > 0 && (
            <div className="rounded-card border border-limitno-border bg-limitno-bg p-5 sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-semibold">
                <Icon icon="lucide:circle-x" width={20} className="text-rose-deep" />
                {creatorName} doesn&rsquo;t do these
                <span className="ml-auto rounded-full border border-limitno-border bg-panel px-2 py-0.5 text-xs font-medium text-muted">
                  {hardNo.length}
                </span>
              </h3>
              <ul className="space-y-3 text-base leading-snug">
                {hardNo.map((line) => (
                  <li key={`${line.source}-${line.id}`} className="flex items-start gap-3">
                    <Icon icon="lucide:x" width={18} className="mt-0.5 shrink-0 text-rose-deep" />
                    {line.text}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-limitno-border pt-4 text-sm text-muted">
                The AI Director won&rsquo;t suggest these, and a request that includes them can&rsquo;t be sent.
              </p>
            </div>
          )}
          {askFirst.length > 0 && (
            <div className="rounded-card border border-limitask-border bg-limitask-bg p-5 sm:p-6">
              <h3 className="mb-4 flex items-center gap-2 font-sans text-base font-semibold">
                <Icon icon="lucide:message-circle-question" width={20} className="text-limitask-ink" />
                Ask {creatorName} first
                <span className="ml-auto rounded-full border border-limitask-border bg-panel px-2 py-0.5 text-xs font-medium text-muted">
                  {askFirst.length}
                </span>
              </h3>
              <ul className="space-y-3 text-base leading-snug">
                {askFirst.map((line) => (
                  <li key={`${line.source}-${line.id}`} className="flex items-start gap-3">
                    <Icon icon="lucide:circle-help" width={18} className="mt-0.5 shrink-0 text-limitask-ink" />
                    {line.text}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-limitask-border pt-4 text-sm text-muted">
                You can include these. {creatorName} will say yes, say no, or set a price after reading your request.
              </p>
            </div>
          )}
        </div>
      )}

      <PlatformRules boundaries={boundaries} creatorName={creatorName} />
    </section>
  )
}

/** The platform hard list: always shown in full in panel A, smaller, never collapsed. */
function PlatformRules({ boundaries, creatorName }: Props) {
  return (
    <div className="mt-6 rounded-card bg-secondary p-5 sm:p-6">
      <h3 className="mb-1 flex items-center gap-2 font-sans text-sm font-semibold">
        <Icon icon="lucide:ban" width={18} className="text-espresso" />
        Never allowed anywhere on {PILOT_BOUTIQUE_NAME}
      </h3>
      <p className="mb-4 text-sm text-muted">These rules protect everyone. No creator can change them.</p>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm leading-snug sm:grid-cols-2">
        {boundaries.platform.flatMap((rule) =>
          rule.lines.map((line, i) => (
            <li key={`${rule.key}-${i}`} className="flex items-start gap-2">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-espresso" />
              {line}
            </li>
          )),
        )}
      </ul>
      <p className="mt-4 flex items-start gap-2 text-sm text-muted">
        <Icon icon="lucide:info" width={16} className="mt-0.5 shrink-0" />
        Adult roles like a nurse, doctor or police officer are fine if {creatorName} agrees.
      </p>
    </div>
  )
}

/**
 * Design 13, state B: the AI Director's card. The creator's own limits are
 * always in full; only the platform rules, already read on the entrance, sit
 * behind the link.
 */
export function LimitsCard({ boundaries, creatorName, className }: Props & { className?: string }) {
  const { hardNo, askFirst } = boundaries
  return (
    <section aria-label={`${creatorName}’s limits`} className={`rounded-card border border-divider bg-panel p-5 ${className ?? ''}`}>
      <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
        <Icon icon="lucide:shield-check" width={18} className="text-rose-deep" />
        {creatorName}&rsquo;s limits
      </h3>
      {hardNo.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-deep">
            <Icon icon="lucide:circle-x" width={14} />
            {creatorName} doesn&rsquo;t do these
          </p>
          <ul className="mb-4 space-y-1.5 text-sm leading-snug">
            {hardNo.map((line) => (
              <li key={`${line.source}-${line.id}`}>{line.text}</li>
            ))}
          </ul>
        </>
      )}
      {askFirst.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-limitask-ink">
            <Icon icon="lucide:message-circle-question" width={14} />
            Ask {creatorName} first
          </p>
          <ul className="mb-4 space-y-1.5 text-sm leading-snug">
            {askFirst.map((line) => (
              <li key={`${line.source}-${line.id}`}>{line.text}</li>
            ))}
          </ul>
        </>
      )}
      <Link
        to="/#limits-panel"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium underline decoration-divider underline-offset-4 hover:decoration-espresso focus-ring"
      >
        Rules for everyone on {PILOT_BOUTIQUE_NAME}
        <Icon icon="lucide:arrow-down" width={14} />
      </Link>
      <p className="text-xs text-muted">
        {creatorName}&rsquo;s own limits are always shown in full here. Only the platform rules, already read on
        the entrance, sit behind this link.
      </p>
    </section>
  )
}
