import type { ReactNode } from 'react'
import { Icon } from '../common/Icon'
import { cn } from '../../lib/cn'

/** One turn of the Director conversation: the fan's or the Director's. */
export function Turn({ speaker, children }: { speaker: 'fan' | 'director'; children: ReactNode }) {
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
