import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

const widths = {
  sm: 'max-w-[480px]',
  md: 'max-w-[800px]',
  lg: 'max-w-[1100px]',
}

type ModalProps = {
  onClose: () => void
  size?: keyof typeof widths
  labelledBy?: string
  children: ReactNode
  className?: string
}

export function Modal({ onClose, size = 'md', labelledBy, children, className }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
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
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative flex max-h-full w-full flex-col overflow-hidden rounded-card bg-panel shadow-modal',
          widths[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-cream/80 text-muted transition-colors duration-160 hover:bg-cream hover:text-espresso focus-ring"
        >
          <Icon icon="lucide:x" width={24} />
        </button>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
