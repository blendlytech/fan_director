import { Fragment } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './../common/Icon'

const steps = ['Idea', 'Details', 'Review', 'Send']

export function ProgressTrail({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted sm:flex-nowrap">
      {steps.map((step, index) => (
        <Fragment key={step}>
          <span
            aria-current={index === currentStep ? 'step' : undefined}
            className={cn(
              index === currentStep && 'rounded-md bg-rose/20 px-2 py-1 font-medium text-espresso',
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <Icon icon="lucide:chevron-right" width={14} className="hidden sm:inline" />
          )}
        </Fragment>
      ))}
    </div>
  )
}
