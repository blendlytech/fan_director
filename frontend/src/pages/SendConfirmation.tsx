import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { ProgressTrail } from '../components/layout/ProgressTrail'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { cn } from '../lib/cn'

const orderDetails = [
  { icon: 'lucide:calculator', label: 'Estimated Price', value: '$145.00', note: 'Subject to approval' },
  { icon: 'lucide:wallet', label: 'Budget Remaining', value: '$5.00', note: 'Under $150 budget' },
  { icon: 'lucide:calendar-clock', label: 'Est. Delivery', value: 'Dec 19', note: '7 days post-payment' },
]

const nextSteps = [
  {
    title: '1. Creator Reviews',
    body: "Maya will review your request within 24-48 hours. She may approve it, propose slight adjustments, or ask for clarification to ensure it's perfect.",
    active: true,
  },
  {
    title: '2. Payment Confirmation',
    body: "Once approved, you'll receive a link to securely complete your payment of $145.00.",
    active: false,
  },
  {
    title: '3. Production Begins',
    body: 'Maya records your custom greeting in the studio.',
    active: false,
  },
  {
    title: '4. Delivery',
    body: 'Your final video is delivered securely, typically within 7 days of payment.',
    active: false,
  },
]

export function SendConfirmation() {
  const [saved, setSaved] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col items-center px-6 py-16 sm:px-8">
        <div className="mb-10 flex w-full justify-center">
          <ProgressTrail currentStep={3} />
        </div>

        {/* Header Section */}
        <div className="mb-12 flex w-full animate-bounce-in flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose/20">
            <Icon icon="lucide:check" width={36} className="text-rose-deep" />
          </div>
          <h1 className="mb-4 font-serif text-[44px] leading-tight text-espresso">
            Commission Submitted Successfully!
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted">
            Maya will review your request and confirm final details. You&rsquo;ll receive updates via email when
            your Scene Card is approved.
          </p>
        </div>

        {/* Order Details Card */}
        <div className="mb-12 w-full overflow-hidden rounded-card border border-divider bg-panel shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-divider bg-cream/30 px-8 py-5 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Request Reference</p>
              <p className="inline-block rounded border border-divider bg-cream px-2 py-1 font-mono text-sm text-espresso">
                Order #MA-2024-001847
              </p>
            </div>
            <div className="sm:text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-cream px-3 py-1 text-xs font-medium text-muted">
                <Icon icon="lucide:clock" width={10} />
                Awaiting Review
              </span>
            </div>
          </div>

          <div className="p-8">
            <h2 className="mb-6 font-serif text-2xl font-medium text-espresso">Vintage Lounge Greeting</h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {orderDetails.map((detail) => (
                <div key={detail.label} className="rounded-xl border border-divider bg-cream/30 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon icon={detail.icon} width={20} className="text-rose" />
                    <h3 className="text-sm font-medium text-muted">{detail.label}</h3>
                  </div>
                  <p className="text-xl font-semibold text-espresso">{detail.value}</p>
                  <p className="mt-1 text-xs text-muted">{detail.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Next Steps Timeline */}
        <div className="mx-auto mb-16 w-full max-w-2xl">
          <h3 className="mb-8 text-center font-serif text-2xl font-medium text-espresso">What happens next?</h3>

          <div className="relative ml-3 space-y-8 border-l border-divider pb-4 sm:ml-6">
            {nextSteps.map((step) => (
              <div key={step.title} className={cn('relative pl-8', !step.active && 'opacity-60')}>
                <div
                  className={cn(
                    'absolute -left-[9px] top-1 h-4 w-4 rounded-full border-4',
                    step.active ? 'border-cream bg-rose' : 'border-divider bg-panel',
                  )}
                />
                <h4 className={cn('mb-1 text-base text-espresso', step.active ? 'font-semibold' : 'font-medium')}>
                  {step.title}
                  {!step.active && <span className="sr-only"> (upcoming)</span>}
                </h4>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Button
            variant="primary"
            icon={saved ? 'lucide:bookmark-check' : 'lucide:bookmark'}
            aria-pressed={saved}
            onClick={() => setSaved((current) => !current)}
          >
            {saved ? 'Saved to Profile' : 'Save Idea to Profile'}
          </Button>
          <Link
            to="/"
            className="flex h-[48px] w-full items-center justify-center rounded-card font-medium text-espresso transition-colors duration-160 hover:bg-black/5 focus-ring"
          >
            Back to Collection
          </Link>
        </div>
      </main>
    </div>
  )
}
