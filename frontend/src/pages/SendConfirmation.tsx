import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { ProgressTrail } from '../components/layout/ProgressTrail'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { useCommission } from '../state/commission'
import { BUDGET, currency, settingOf } from '../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  The end of the fan journey — in a demo with no backend.                    */
/*                                                                            */
/*  Design draft 08 shows a success screen ("Commission Submitted              */
/*  Successfully!", an order number, email updates). None of that happens     */
/*  here, so the screen says plainly that nothing was sent, saved, charged or  */
/*  assigned a reference. Do not reintroduce a success state without a server  */
/*  that actually performs the action.                                        */
/* -------------------------------------------------------------------------- */

export function SendConfirmation() {
  const [saveAttempted, setSaveAttempted] = useState(false)
  const { view, draft, total, difference, overBudget, deliveryDays } = useCommission()

  const orderDetails = [
    { icon: 'lucide:calculator', label: 'Estimated Price', value: currency.format(total), note: 'Subject to approval' },
    overBudget
      ? {
          icon: 'lucide:alert-triangle',
          label: 'Over Budget',
          value: currency.format(Math.abs(difference)),
          note: `Over ${currency.format(BUDGET)} budget`,
        }
      : {
          icon: 'lucide:wallet',
          label: 'Budget Remaining',
          value: currency.format(difference),
          note: `Under ${currency.format(BUDGET)} budget`,
        },
    // No payment exists, so there is no date to count from — only the rule.
    { icon: 'lucide:calendar-clock', label: 'Est. Delivery', value: `${deliveryDays} days`, note: 'After payment confirmation' },
  ]

  const nextSteps = [
    {
      title: '1. Creator Reviews',
      body: "Maya would review your request within 24-48 hours. She could approve it, propose slight adjustments, or ask for clarification.",
    },
    {
      title: '2. Payment Confirmation',
      body: `Only once approved would you receive a link to pay ${currency.format(total)}. This demo takes no payment.`,
    },
    {
      title: '3. Production Begins',
      body: 'Maya would record your custom greeting in the studio.',
    },
    {
      title: '4. Delivery',
      body: `Your final video would be delivered securely, typically within ${deliveryDays} days of payment.`,
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col items-center px-6 py-16 sm:px-8">
        <div className="mb-10 flex w-full justify-center">
          <ProgressTrail currentStep={3} />
        </div>

        {/* Header Section */}
        <div className="mb-12 flex w-full flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
            <Icon icon="lucide:info" width={36} className="text-espresso" />
          </div>
          <h1 className="mb-4 font-serif text-[36px] leading-tight text-espresso sm:text-[44px]">
            Nothing was sent to Maya
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted">
            This is a design demo with no backend. Your Scene Card was not submitted, saved or charged, it has
            no reference number, and you will not receive any email. Here is what you planned, and what would
            happen next in the real studio.
          </p>
        </div>

        {/* Scene Card summary */}
        <div className="mb-12 w-full overflow-hidden rounded-card border border-divider bg-panel shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-divider bg-cream/30 px-8 py-5 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">Request Reference</p>
              <p className="text-sm text-espresso">None — this request was not submitted</p>
            </div>
            <div className="sm:text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-cream px-3 py-1 text-xs font-medium text-muted">
                <Icon icon="lucide:file-pen-line" width={10} />
                Draft only · Not sent
              </span>
            </div>
          </div>

          <div className="p-8">
            <h2 className="mb-6 font-serif text-2xl font-medium text-espresso">{settingOf(view, draft).sceneTitle}</h2>

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

        {/* What the real product would do next */}
        <div className="mx-auto mb-16 w-full max-w-2xl">
          <h3 className="mb-8 text-center font-serif text-2xl font-medium text-espresso">
            What would happen next in the real studio
          </h3>

          <div className="relative ml-3 space-y-8 border-l border-divider pb-4 sm:ml-6">
            {nextSteps.map((step) => (
              <div key={step.title} className="relative pl-8">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-4 border-divider bg-panel" />
                <h4 className="mb-1 text-base font-medium text-espresso">{step.title}</h4>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="flex w-full max-w-sm flex-col gap-4">
          <Button
            variant="primary"
            icon="lucide:bookmark"
            aria-describedby="save-status"
            onClick={() => setSaveAttempted(true)}
          >
            Save Idea to Profile
          </Button>
          <p id="save-status" role="status" className="text-center text-sm text-muted">
            {saveAttempted
              ? 'Not saved — this demo has no profile or storage.'
              : ''}
          </p>
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
