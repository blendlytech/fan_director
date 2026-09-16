import { createElement } from 'react'
import 'iconify-icon'

type IconProps = {
  icon: string
  width?: number | string
  className?: string
}

// iconify-icon is a custom element, so it is created outside JSX to keep it typed.
export function Icon({ icon, width = 20, className }: IconProps) {
  return createElement('iconify-icon', { icon, width, class: className, 'aria-hidden': true })
}
