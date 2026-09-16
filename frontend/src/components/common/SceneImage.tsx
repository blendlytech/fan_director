import { useState } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

type SceneImageProps = {
  src: string
  alt: string
  className?: string
}

// Several reference photos in the original design drafts now 404, so images
// degrade to an on-brand placeholder instead of a blank box.
export function SceneImage({ src, alt, className }: SceneImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} — reference image unavailable`}
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-2 bg-secondary text-muted',
          className,
        )}
      >
        <Icon icon="lucide:image-off" width={24} className="text-rose" />
        <span className="px-4 text-center text-xs">{alt}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
