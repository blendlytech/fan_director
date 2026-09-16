import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { ProgressTrail } from '../components/layout/ProgressTrail'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { SceneImage } from '../components/common/SceneImage'

const includedComponents = [
  { icon: 'lucide:video', label: 'Duration', value: '3-Minute Video' },
  { icon: 'lucide:armchair', label: 'Setting', value: 'Vintage Lounge Setup' },
  { icon: 'lucide:message-square-heart', label: 'Personalization', value: 'Detailed Greeting' },
]

const priceLines = [
  { label: 'Base Video (3-min)', amount: '$90.00' },
  { label: 'Lounge Setting', amount: '$35.00' },
  { label: 'Detailed Greeting', amount: '$20.00' },
]

export function ReviewScene() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* Top Navigation & Progress */}
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <Link
            to="/ai-director"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors duration-160 hover:text-espresso focus-ring"
          >
            <Icon icon="lucide:arrow-left" width={18} />
            Back to Details
          </Link>

          <ProgressTrail currentStep={2} />
        </div>

        {/* Hero Section */}
        <div className="mb-10 text-center">
          <h1 className="mb-3 font-serif text-4xl font-semibold text-espresso md:text-5xl">
            Review Your Commission
          </h1>
          <p className="text-base text-muted">
            Please review the details of your Scene Card before sending it to Maya for approval.
          </p>
        </div>

        {/* Scene Card Panel */}
        <div className="overflow-hidden rounded-card border border-divider bg-panel shadow-subtle">
          {/* Header / Theme */}
          <div className="flex flex-col items-start gap-8 border-b border-divider p-6 sm:p-10 md:flex-row">
            <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-divider md:w-1/3">
              <SceneImage
                src="https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Vintage Lounge Reference"
              />
            </div>
            <div className="w-full md:w-2/3">
              <div className="mb-4 inline-flex items-center rounded-full border border-divider bg-secondary px-3 py-1 text-xs font-medium text-muted">
                Status: Draft
              </div>
              <h2 className="mb-3 font-serif text-3xl font-semibold text-espresso">Vintage Lounge Greeting</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted">
                A cinematic, atmospheric personal greeting set in a cozy vintage lounge. Perfect for anniversaries
                and intimate celebrations.
              </p>
              <div className="flex items-start gap-3 rounded-xl border border-divider bg-cream p-4">
                <Icon icon="lucide:quote" width={18} className="mt-0.5 text-muted" />
                <p className="text-sm italic text-espresso">
                  &ldquo;For my partner&rsquo;s anniversary. They love 80s aesthetics. Something atmospheric and
                  warm.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Components Breakdown */}
          <div className="border-b border-divider p-6 sm:p-10">
            <h3 className="mb-6 text-xs font-semibold uppercase tracking-wider text-muted">Included Components</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {includedComponents.map((item) => (
                <div key={item.label} className="rounded-xl border border-divider bg-panel p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Icon icon={item.icon} width={20} className="text-rose" />
                    <span className="text-sm font-medium text-espresso">{item.label}</span>
                  </div>
                  <p className="text-sm text-muted">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Financials & Timeline */}
          <div className="flex flex-col gap-10 bg-secondary p-6 sm:p-10 md:flex-row">
            {/* Price Breakdown */}
            <div className="flex-1">
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted">Estimated Price</h3>
              <div className="mb-5 space-y-3">
                {priceLines.map((line) => (
                  <div key={line.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{line.label}</span>
                    <span className="font-medium text-espresso">{line.amount}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-end justify-between border-t border-divider pt-4">
                <span className="font-medium text-espresso">Total Estimate</span>
                <span className="font-serif text-3xl font-bold tracking-tight text-espresso">$145.00</span>
              </div>

              {/* Budget Indicator */}
              <div className="mt-4 flex w-fit items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                <Icon icon="lucide:check-circle-2" width={16} />
                $5 remaining of $150 budget
              </div>
            </div>

            {/* Timeline & Terms */}
            <div className="flex flex-1 flex-col gap-4">
              <div className="rounded-xl border border-divider bg-panel p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:calendar-clock" width={20} className="mt-0.5 text-rose" />
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-espresso">Standard Delivery</h4>
                    <p className="text-xs leading-relaxed text-muted">
                      Estimated 7 days after payment confirmation. Subject to final creator approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-divider bg-panel p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:shield-check" width={20} className="mt-0.5 text-rose" />
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-espresso">Creator Boundaries</h4>
                    <p className="mb-2 text-xs leading-relaxed text-muted">
                      All options are from Maya&rsquo;s approved catalog. Wardrobe is creator&rsquo;s choice
                      (non-explicit).
                    </p>
                    <p className="text-xs leading-relaxed text-muted">
                      <strong>No payment is taken today.</strong> Maya will review your request first.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final Action Area */}
        <div className="mx-auto mb-20 mt-10 max-w-[600px] text-center">
          <p className="mb-8 text-sm text-muted">
            <span className="font-medium text-espresso">Almost done!</span> Once you send this, Maya will review and
            approve within 24-48 hours. You&rsquo;ll be notified when it&rsquo;s ready for payment.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button variant="secondary" to="/ai-director">
              Back to Edit
            </Button>
            <Button variant="primary" icon="lucide:send" to="/confirmation">
              Send to Creator
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
