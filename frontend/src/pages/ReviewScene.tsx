import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { ProgressTrail } from '../components/layout/ProgressTrail'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { SceneImage } from '../components/common/SceneImage'
import { useCommission } from '../state/commission'
import { BUDGET, DELIVERY_DAYS, briefOf, currency, includedComponents, settingOf } from '../domain/sceneCard'

export function ReviewScene() {
  const { draft, lineItems, total, difference, overBudget } = useCommission()
  const setting = settingOf(draft)

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
              <SceneImage src={setting.imageLarge} alt={setting.alt} />
            </div>
            <div className="w-full md:w-2/3">
              <div className="mb-4 inline-flex items-center rounded-full border border-divider bg-secondary px-3 py-1 text-xs font-medium text-muted">
                Status: Draft
              </div>
              <h2 className="mb-3 font-serif text-3xl font-semibold text-espresso">{setting.sceneTitle}</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted">{setting.sceneDescription}</p>
              <div className="flex items-start gap-3 rounded-xl border border-divider bg-cream p-4">
                <Icon icon="lucide:quote" width={18} className="mt-0.5 text-muted" />
                <p className="text-sm italic text-espresso">&ldquo;{briefOf(draft)}&rdquo;</p>
              </div>
            </div>
          </div>

          {/* Components Breakdown */}
          <div className="border-b border-divider p-6 sm:p-10">
            <h3 className="mb-6 text-xs font-semibold uppercase tracking-wider text-muted">Included Components</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {includedComponents(draft).map((item) => (
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
                {lineItems
                  .filter((line) => line.amount !== 0)
                  .map((line) => (
                    <div key={line.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted">{line.shortLabel}</span>
                      <span className="font-medium text-espresso">{currency.format(line.amount)}</span>
                    </div>
                  ))}
              </div>
              <div className="flex items-end justify-between border-t border-divider pt-4">
                <span className="font-medium text-espresso">Total Estimate</span>
                <span className="font-serif text-3xl font-bold tracking-tight text-espresso">
                  {currency.format(total)}
                </span>
              </div>

              {/* Budget Indicator */}
              {overBudget ? (
                <div className="mt-4 flex w-fit items-center gap-2 rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-xs font-medium text-alert">
                  <Icon icon="lucide:alert-triangle" width={16} />
                  {currency.format(Math.abs(difference))} over {currency.format(BUDGET)} budget
                </div>
              ) : (
                <div className="mt-4 flex w-fit items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
                  <Icon icon="lucide:check-circle-2" width={16} />
                  {currency.format(difference)} remaining of {currency.format(BUDGET)} budget
                </div>
              )}
            </div>

            {/* Timeline & Terms */}
            <div className="flex flex-1 flex-col gap-4">
              <div className="rounded-xl border border-divider bg-panel p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:calendar-clock" width={20} className="mt-0.5 text-rose" />
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-espresso">Standard Delivery</h4>
                    <p className="text-xs leading-relaxed text-muted">
                      Estimated {DELIVERY_DAYS} days after payment confirmation. Subject to final creator approval.
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
