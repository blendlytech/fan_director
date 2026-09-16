import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { SceneImage } from '../components/common/SceneImage'
import { useCommission } from '../state/commission'
import { currency, includedComponents, settingOf } from '../domain/sceneCard'

/* -------------------------------------------------------------------------- */
/*  Saved ideas — in a demo with no backend, no profile and no storage.        */
/*                                                                            */
/*  Built from design draft 10-saved-ideas.html. There is no profile to list   */
/*  saved drafts from: there is exactly one draft, it lives in the shared      */
/*  CommissionContext for this browser tab only, and it is gone on reload.     */
/*  This screen says so plainly, shows that one draft honestly labelled as     */
/*  unsaved, and describes — without performing — what the real feature       */
/*  would do. Do not add a delete/rename/share control or a saved timestamp;   */
/*  there is nothing behind any of them to act on.                            */
/* -------------------------------------------------------------------------- */

const REAL_STUDIO_POINTS = [
  {
    icon: 'lucide:user-check',
    title: '1. Stay on your account',
    body: 'Drafts would be kept on a signed-in profile instead of this browser tab.',
  },
  {
    icon: 'lucide:clock',
    title: '2. Wait for you to come back',
    body: 'Return later, compare versions and pick up where you left off.',
  },
  {
    icon: 'lucide:refresh-cw',
    title: "3. Re-check against Maya's catalog",
    body: "Prices would be recalculated from Maya's current catalog before anything is sent.",
  },
] as const

export function SavedIdeas() {
  const { draft, total } = useCommission()
  const setting = settingOf(draft)

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <Header />

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Title */}
        <div className="mb-8">
          <h1 className="mb-3 font-serif text-4xl font-semibold tracking-tight text-espresso md:text-5xl">
            Saved ideas
          </h1>
          <p className="text-base text-muted">
            A calm place your commission ideas would live between visits.
          </p>
        </div>

        {/* Notice: this demo has no profile or storage, so nothing is kept */}
        <div
          role="note"
          className="mb-12 flex items-start gap-3 rounded-card border border-divider bg-secondary p-5 sm:p-6"
        >
          <Icon icon="lucide:info" width={20} className="mt-0.5 shrink-0 text-espresso" />
          <p className="text-sm leading-relaxed text-espresso">
            This demo saves nothing. There&rsquo;s no profile or storage behind it, so ideas aren&rsquo;t
            kept — and refreshing the page clears the draft you&rsquo;re working on.
          </p>
        </div>

        {/* The one draft actually live in memory right now */}
        <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-wider text-muted">
          In this tab right now — not saved
        </h2>
        <div className="mb-14 flex flex-col overflow-hidden rounded-card border border-divider bg-panel shadow-subtle md:flex-row">
          <div className="aspect-[4/3] w-full shrink-0 border-b border-divider md:aspect-auto md:w-2/5 md:border-b-0 md:border-r">
            <SceneImage src={setting.imageLarge} alt={setting.alt} />
          </div>
          <div className="w-full p-6 sm:p-8 md:w-3/5">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-divider bg-secondary px-3 py-1 text-xs font-medium text-muted">
              <Icon icon="lucide:file-pen-line" width={12} />
              Draft · this tab only
            </div>
            <h3 className="mb-3 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
              {setting.sceneTitle}
            </h3>
            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              {includedComponents(draft).map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <Icon icon={item.icon} width={16} className="text-rose" />
                  {item.value}
                </span>
              ))}
            </div>
            <div className="mb-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
                Estimated total
              </p>
              <p className="font-serif text-3xl font-bold tracking-tight text-espresso">
                {currency.format(total)}
              </p>
              <p className="mt-1 text-xs text-muted">Estimate, subject to Maya&rsquo;s approval</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button to="/ai-director" variant="primary" icon="lucide:pencil">
                Continue editing
              </Button>
              <Button to="/review" variant="secondary">
                Review Scene Card
              </Button>
            </div>
          </div>
        </div>

        {/* What the real product would do instead — none of it happening now */}
        <div className="mb-14">
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-espresso sm:text-3xl">
              In the real studio, saved ideas would&hellip;
            </h2>
            <p className="mt-1 text-sm text-muted">
              How this would work in the real product — none of this is happening now.
            </p>
          </div>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {REAL_STUDIO_POINTS.map((point) => (
              <li key={point.title} className="rounded-card border border-divider bg-panel p-6">
                <Icon icon={point.icon} width={24} className="mb-3 text-rose" />
                <h3 className="mb-2 font-serif text-xl font-semibold text-espresso">{point.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{point.body}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Back */}
        <div className="border-t border-divider pt-8">
          <Button to="/" variant="secondary" icon="lucide:arrow-left">
            Back to collection
          </Button>
        </div>
      </main>
    </div>
  )
}
