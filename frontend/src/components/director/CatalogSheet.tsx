import { useEffect, useRef, useState } from 'react'
import { money } from '../../domain/sceneCard'
import { cn } from '../../lib/cn'
import { Icon } from '../common/Icon'

/* -------------------------------------------------------------------------- */
/*  Design 17, state F: "choose from the catalog", the manual fallback that's */
/*  always available beside the Director. On desktop it sits inline under     */
/*  the chat (as drawn); on narrow screens the same form becomes a bottom     */
/*  sheet, per the design's own note ("opens under the chat; a sheet on       */
/*  mobile"). Rather than rendering the form twice (which would duplicate     */
/*  radio names and label ids), a single media-query check below 640px picks  */
/*  one layout to mount.                                                      */
/* -------------------------------------------------------------------------- */

type CatalogItem = { id: string; name: string; priceCents: number }

type Props = {
  open: boolean
  onClose: () => void
  creatorName: string
  settings: CatalogItem[]
  settingId: string
  greetings: CatalogItem[]
  greetingId: string
  extraMinutes: number
  maxExtraMinutes: number
  perExtraMinuteCents: number
  onSetting: (id: string) => void
  onGreeting: (id: string) => void
  onExtraMinutes: (n: number) => void
}

function useIsMobile(breakpointPx: number): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpointPx,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpointPx])
  return isMobile
}

export function CatalogSheet(props: Props) {
  const {
    open,
    onClose,
    creatorName,
    settings,
    settingId,
    greetings,
    greetingId,
    extraMinutes,
    maxExtraMinutes,
    perExtraMinuteCents,
    onSetting,
    onGreeting,
    onExtraMinutes,
  } = props

  const isMobile = useIsMobile(640)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open, isMobile])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const heading = (
    <h3 tabIndex={-1} ref={headingRef} className="font-serif text-2xl font-semibold focus:outline-none">
      {creatorName}&rsquo;s catalog
    </h3>
  )

  const form = (
    <form className="space-y-6">
      {heading}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Setting <span className="font-normal text-muted">&middot; choose one</span>
        </legend>
        <div className="space-y-2">
          {settings.map((setting) => {
            const checked = setting.id === settingId
            return (
              <label
                key={setting.id}
                className={cn(
                  'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-card px-4',
                  checked ? 'border-2 border-espresso' : 'border border-divider hover:bg-secondary',
                )}
              >
                <input
                  type="radio"
                  name="catalog-setting"
                  checked={checked}
                  onChange={() => onSetting(setting.id)}
                  className="h-4 w-4 accent-espresso"
                />
                <span className="flex-1 text-sm font-medium">{setting.name}</span>
                <span className="text-sm">{setting.priceCents === 0 ? 'Included' : money(setting.priceCents)}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Greeting <span className="font-normal text-muted">&middot; choose one</span>
        </legend>
        <div className="space-y-2">
          {greetings.map((greeting) => {
            const checked = greeting.id === greetingId
            return (
              <label
                key={greeting.id}
                className={cn(
                  'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-card px-4',
                  checked ? 'border-2 border-espresso' : 'border border-divider hover:bg-secondary',
                )}
              >
                <input
                  type="radio"
                  name="catalog-greeting"
                  checked={checked}
                  onChange={() => onGreeting(greeting.id)}
                  className="h-4 w-4 accent-espresso"
                />
                <span className="flex-1 text-sm font-medium">{greeting.name}</span>
                <span className={cn('text-sm', greeting.priceCents === 0 && 'text-muted')}>
                  {greeting.priceCents === 0 ? 'Included' : money(greeting.priceCents)}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-semibold">
          Extra minutes <span className="font-normal text-muted">&middot; {money(perExtraMinuteCents)} each, up to {maxExtraMinutes}</span>
        </p>
        <div className="inline-flex items-center rounded-card border border-divider">
          <button
            type="button"
            aria-label="One fewer minute"
            disabled={extraMinutes <= 0}
            onClick={() => onExtraMinutes(extraMinutes - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-l-card text-muted focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon="lucide:minus" width={16} />
          </button>
          <span className="w-10 text-center text-base font-medium" aria-live="polite">
            {extraMinutes}
          </span>
          <button
            type="button"
            aria-label="One more minute"
            disabled={extraMinutes >= maxExtraMinutes}
            onClick={() => onExtraMinutes(extraMinutes + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-r-card hover:bg-secondary focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon="lucide:plus" width={16} />
          </button>
        </div>
      </div>

      <p className="border-t border-divider pt-4 text-xs text-muted">
        Every change updates the Scene Card with the server&rsquo;s new estimate. Hidden or unavailable items
        don&rsquo;t appear.
      </p>
    </form>
  )

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-espresso/40" onClick={onClose} aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-card border-t border-divider bg-panel p-5 shadow-modal sm:p-6">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close catalog"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-card text-muted hover:bg-secondary focus-ring"
            >
              <Icon icon="lucide:x" width={20} />
            </button>
          </div>
          {form}
        </div>
      </div>
    )
  }

  return <div className="rounded-card border border-divider bg-panel p-5 sm:p-6">{form}</div>
}
