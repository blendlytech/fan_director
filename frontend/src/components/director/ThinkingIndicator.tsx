import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 17, state A: the Director's "thinking" row, drawn verbatim from     */
/*  docs/designs/html/17-ai-director-live-states.html. Same avatar and row     */
/*  shape as a Director turn in pages/AIDirector.tsx's <Turn>, so it can drop  */
/*  straight into the conversation while a reply is in flight.                 */
/*                                                                              */
/*  The design animates the three dots with a custom @keyframes "dot" rule     */
/*  and turns it off under prefers-reduced-motion. Tailwind's built-in         */
/*  animate-pulse (no config change needed) gives the same "one at a time"     */
/*  feel via staggered animation-delay, gated by the motion-safe: variant so   */
/*  reduced-motion users get static dots, matching the design's intent.        */
/* -------------------------------------------------------------------------- */

export function ThinkingIndicator() {
  return (
    <div className="flex gap-4" role="status" aria-live="polite">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-espresso text-cream">
        <Icon icon="lucide:sparkles" width={14} />
      </div>
      <div className="flex items-center gap-3 pt-1.5 text-sm text-muted">
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse" />
          <span
            className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-muted motion-safe:animate-pulse"
            style={{ animationDelay: '300ms' }}
          />
        </span>
        The Director is thinking&hellip;
      </div>
    </div>
  )
}
