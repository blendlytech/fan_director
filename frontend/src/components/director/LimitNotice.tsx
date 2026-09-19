import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 13, state C2: the fan asked for something the creator's boundaries */
/*  rule out entirely. Heading and body are pre-written by the server         */
/*  (director-copy-v1 / the boundaries renderer), so they're just rendered.   */
/* -------------------------------------------------------------------------- */

export function LimitNotice({ heading, body }: { heading: string; body: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-card border border-limitno-border bg-limitno-bg p-4">
      <Icon icon="lucide:circle-x" width={20} className="mt-0.5 shrink-0 text-rose-deep" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">{heading}</p>
        <p>{body}</p>
      </div>
    </div>
  )
}
