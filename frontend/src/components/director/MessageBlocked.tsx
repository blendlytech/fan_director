import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 13, state C3: a fan message hit one of the platform's hard rules   */
/*  (never allowed for any creator) and wasn't sent. This renders only the    */
/*  notice box from the design — the read-only textarea beside it in the      */
/*  mockup belongs to the caller's own composer, not this component.          */
/* -------------------------------------------------------------------------- */

type Props = { boutiqueName: string; creatorName: string; lines: string[] }

function lowerFirst(text: string): string {
  return text.length ? text[0].toLowerCase() + text.slice(1) : text
}

export function MessageBlocked({ boutiqueName, creatorName, lines }: Props) {
  const rules = lowerFirst(lines.join('; '))
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card bg-secondary p-4">
      <Icon icon="lucide:ban" width={20} className="mt-0.5 shrink-0" />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">Not sent</p>
        <p>
          Your message includes something that&rsquo;s never allowed on {boutiqueName}:{' '}
          <span className="font-medium">{rules}</span>. Nothing was shared with {creatorName}. You can change your
          message and try again.
        </p>
      </div>
    </div>
  )
}
