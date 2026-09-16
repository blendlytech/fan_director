import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

const base =
  'rounded-card font-medium transition-colors duration-160 focus-ring inline-flex items-center justify-center gap-2'

const variants: Record<Variant, string> = {
  primary: 'bg-rose text-espresso hover:bg-rose-hover shadow-sm',
  secondary: 'border border-divider bg-transparent text-espresso hover:bg-panel',
  destructive: 'bg-alert text-white hover:bg-alert-hover shadow-sm',
}

const sizes: Record<Size, string> = {
  sm: 'px-6 h-[44px] text-sm',
  md: 'px-8 h-[48px] text-base',
  lg: 'px-10 h-[52px] text-lg',
}

type BaseProps = {
  variant?: Variant
  size?: Size
  icon?: string
  children: ReactNode
  className?: string
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined }

type LinkProps = BaseProps & { to: string }

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', icon, children, className } = props
  const classes = cn(base, variants[variant], sizes[size], className)
  const content = (
    <>
      {children}
      {icon && <Icon icon={icon} width={18} />}
    </>
  )

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes}>
        {content}
      </Link>
    )
  }

  const { variant: _v, size: _s, icon: _i, children: _c, className: _cn, ...rest } = props as ButtonProps
  return (
    <button className={cn(classes, rest.disabled && 'opacity-50 cursor-not-allowed')} {...rest}>
      {content}
    </button>
  )
}
