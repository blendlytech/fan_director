import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

const widths = {
  sm: 'max-w-[480px]',
  md: 'max-w-[800px]',
  lg: 'max-w-[1100px]',
}

/** Open modals, deepest last. The creator flow layers Ask/Decline over the
 *  request detail, and only the topmost one may answer Escape or trap Tab. */
const stack: symbol[] = []

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  )
}

type ModalProps = {
  onClose: () => void
  size?: keyof typeof widths
  labelledBy?: string
  children: ReactNode
  className?: string
}

export function Modal({ onClose, size = 'md', labelledBy, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef<symbol>(Symbol('modal'))

  // Join the stack, pull focus in, and hand focus back to whatever opened us.
  useEffect(() => {
    const token = tokenRef.current
    stack.push(token)
    const opener = document.activeElement as HTMLElement | null

    const target = focusableWithin(dialogRef.current)[0] ?? dialogRef.current
    target?.focus()

    return () => {
      const index = stack.indexOf(token)
      if (index !== -1) stack.splice(index, 1)
      opener?.focus?.()
    }
  }, [])

  // Escape and Tab, handled only by the modal currently on top.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1] !== tokenRef.current) return

      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableWithin(dialogRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = dialogRef.current?.contains(active) ?? false

      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-full w-full flex-col overflow-hidden rounded-card bg-panel shadow-modal focus:outline-none',
          widths[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream/80 text-muted transition-colors duration-160 hover:bg-cream hover:text-espresso focus-ring"
        >
          <Icon icon="lucide:x" width={24} />
        </button>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
