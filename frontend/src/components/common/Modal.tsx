import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

const widths = {
  sm: 'max-w-[480px]',
  md: 'max-w-[800px]',
  lg: 'max-w-[1100px]',
}

type Layer = {
  token: symbol
  el: HTMLElement | null
  /** Where focus goes when this layer closes. */
  opener: HTMLElement | null
}

/** Open modals, deepest last. The creator flow layers Ask/Decline over the
 *  request detail, and only the topmost one may answer Escape, trap Tab, or be
 *  reachable at all — everything beneath it is made inert. */
const stack: Layer[] = []

/** The app root is inert while any modal is open; every layer but the top is inert too.
 *  Layers are portalled to <body>, so inerting #root never inerts a modal. */
function syncInert() {
  const root = document.getElementById('root')
  if (root) root.inert = stack.length > 0
  stack.forEach((layer, index) => {
    if (layer.el) layer.el.inert = index !== stack.length - 1
  })
}

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
  const layerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef<symbol>(Symbol('modal'))

  // Join the stack, make everything beneath inert, pull focus in, and hand focus
  // back to whatever opened us.
  useEffect(() => {
    // Capture the opener before syncInert() — inerting its subtree would blur it.
    const layer: Layer = {
      token: tokenRef.current,
      el: layerRef.current,
      opener: document.activeElement as HTMLElement | null,
    }
    stack.push(layer)
    syncInert()

    const target = focusableWithin(dialogRef.current)[0] ?? dialogRef.current
    target?.focus()

    return () => {
      const index = stack.indexOf(layer)
      if (index === -1) return
      const wasTop = index === stack.length - 1
      stack.splice(index, 1)

      // A parent route unmounting takes its child modal with it, and React runs the
      // parent's cleanup first. The layer above was opened from inside this one, so
      // it inherits this layer's opener instead of one that is about to be detached.
      const above = stack[index]
      if (above && (!above.opener || !above.opener.isConnected || layer.el?.contains(above.opener))) {
        above.opener = layer.opener
      }

      if (layer.el) layer.el.inert = false
      // Un-inert first: focus() on an element inside an inert subtree silently fails.
      syncInert()
      if (wasTop) layer.opener?.focus?.()
    }
  }, [])

  // Escape and Tab, handled only by the modal currently on top.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (stack[stack.length - 1]?.token !== tokenRef.current) return

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

  return createPortal(
    <div
      ref={layerRef}
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
    </div>,
    document.body,
  )
}
