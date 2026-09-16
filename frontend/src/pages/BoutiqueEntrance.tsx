import { Link, useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Icon } from '../components/common/Icon'
import { SceneImage } from '../components/common/SceneImage'
import { useCommission } from '../state/commission'
import type { SettingId } from '../domain/sceneCard'

type ThemeCard = {
  /** Which catalog setting this card starts the fan's draft on. */
  setting: SettingId
  image: string
  alt: string
  title: string
  description: string
  priceRange: string
}

const themeCards: ThemeCard[] = [
  {
    image:
      'https://images.unsplash.com/photo-1551028150-64b9e398f678?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    setting: 'vintage',
    alt: 'Vintage Lounge',
    title: 'Vintage Lounge Greeting',
    description:
      "A cozy, cinematic atmosphere with warm lighting. Perfect for personalized messages and intimate announcements.",
    priceRange: 'From $90 – $150',
  },
  {
    image:
      'https://images.unsplash.com/photo-1563241527-2004cb630db0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    setting: 'floral',
    alt: 'Floral Studio',
    title: 'Floral Studio Scene',
    description:
      'Bright, airy, and surrounded by seasonal blooms. Ideal for cheerful celebrations and uplifting messages.',
    priceRange: 'From $120 – $180',
  },
  {
    image:
      'https://images.unsplash.com/photo-1517457224219-c60317e3df1c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    setting: 'backstage',
    alt: 'Backstage Moment',
    title: 'Intimate Backstage',
    description:
      'Raw, candid, and authentic. A glimpse behind the scenes for a more personal, unpolished connection.',
    priceRange: 'From $80 – $130',
  },
]

export function BoutiqueEntrance() {
  const navigate = useNavigate()
  const { commit } = useCommission()

  // Starting from a curated scene seeds the draft, so the Director opens on the
  // setting the fan actually picked rather than always on the first one.
  function beginWith(setting: SettingId) {
    commit({ setting })
    navigate('/ai-director')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-container mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {/* Hero Section */}
        <section className="mb-16 grid grid-cols-1 items-center gap-8 sm:mb-20 md:grid-cols-12">
          <div className="md:col-span-5 md:pr-8">
            <h1 className="mb-6 text-4xl leading-tight tracking-tight text-espresso sm:text-5xl">
              A little inspiration.
              <br />
              Entirely yours.
            </h1>
            <p className="mb-8 text-base leading-relaxed text-muted">
              Welcome to the studio. Here we collaboratively plan your custom commission. Start
              with a curated theme or describe your vision, and our intelligent Director will
              help you refine the details before Maya's review.
            </p>
          </div>
          <div className="md:col-span-7">
            <div className="relative h-64 w-full overflow-hidden rounded-xl shadow-subtle sm:h-80">
              <SceneImage
                src="https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                alt="Vintage lounge still life"
              />
              <div className="absolute inset-0 bg-black/5" />
            </div>
          </div>
        </section>

        {/* Two Entry Paths */}
        <section className="mb-16 sm:mb-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Link
              to="/ai-director"
              className="group flex cursor-pointer flex-col justify-between rounded-xl border border-divider bg-panel p-8 transition-all duration-160 hover:shadow-subtle focus-ring"
            >
              <div>
                <h3 className="mb-3 text-2xl text-espresso transition-colors duration-160 group-hover:text-rose">
                  Explore Curated Themes
                </h3>
                <p className="text-sm text-muted">
                  Browse our collection of carefully designed commissions, pre-approved by Maya
                  and ready for your personal touch.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <Icon
                  icon="lucide:arrow-right"
                  width={24}
                  className="text-muted transition-colors duration-160 group-hover:text-rose"
                />
              </div>
            </Link>
            <Link
              to="/ai-director"
              className="group flex cursor-pointer flex-col justify-between rounded-xl border border-divider bg-panel p-8 transition-all duration-160 hover:shadow-subtle focus-ring"
            >
              <div>
                <h3 className="mb-3 text-2xl text-espresso transition-colors duration-160 group-hover:text-rose">
                  Tell Us Your Vision
                </h3>
                <p className="text-sm text-muted">
                  Have a specific idea in mind? Describe what you're imagining, and we'll help
                  piece together the perfect scene.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <Icon
                  icon="lucide:arrow-right"
                  width={24}
                  className="text-muted transition-colors duration-160 group-hover:text-rose"
                />
              </div>
            </Link>
          </div>
        </section>

        {/* Theme Cards Section */}
        <section className="mb-20 sm:mb-24">
          <h2 className="mb-10 text-center text-3xl tracking-tight text-espresso">
            Or begin with a curated scene
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {themeCards.map((card) => (
              <div
                key={card.title}
                className="flex flex-col overflow-hidden rounded-xl border border-divider bg-panel transition-all duration-160 hover:shadow-modal"
              >
                <div className="h-48 w-full overflow-hidden">
                  <SceneImage
                    src={card.image}
                    alt={card.alt}
                    className="transition-transform duration-700 hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="mb-2 text-2xl font-bold tracking-tight text-espresso">
                    {card.title}
                  </h3>
                  <p className="mb-6 flex-1 text-sm text-muted">{card.description}</p>
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-espresso">{card.priceRange}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => beginWith(card.setting)}
                  >
                    Begin Your Vision
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Creator Boundaries Explainer */}
        <section className="border-t border-divider pt-12">
          <h2 className="mb-8 text-3xl tracking-tight text-espresso">How this works</h2>
          <div className="grid grid-cols-1 gap-x-16 gap-y-8 md:grid-cols-2">
            <div>
              <div className="mb-6 flex items-start gap-4">
                <div className="mt-1 text-rose">
                  <Icon icon="lucide:check-circle" width={20} />
                </div>
                <div>
                  <h4 className="mb-1 font-medium text-espresso">Curated &amp; Pre-approved</h4>
                  <p className="text-sm text-muted">
                    All listed themes, settings, and wardrobe options in the catalog are
                    pre-approved by Maya. Custom requests outside these boundaries require
                    additional review.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 text-rose">
                  <Icon icon="lucide:calculator" width={20} />
                </div>
                <div>
                  <h4 className="mb-1 font-medium text-espresso">Transparent Estimates</h4>
                  <p className="text-sm text-muted">
                    Prices shown are estimates based on your selections. Final pricing is
                    confirmed upon Maya's review and approval of your Scene Card.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <div className="mb-6 flex items-start gap-4">
                <div className="mt-1 text-rose">
                  <Icon icon="lucide:clock" width={20} />
                </div>
                <div>
                  <h4 className="mb-1 font-medium text-espresso">Standard Delivery</h4>
                  <p className="text-sm text-muted">
                    Delivery is typically 7 days{' '}
                    <span className="font-medium text-rose">after payment confirmation</span>.
                    Expedited options may be available during the planning phase.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 text-rose">
                  <Icon icon="lucide:shield-check" width={20} />
                </div>
                <div>
                  <h4 className="mb-1 font-medium text-espresso">Content Guidelines</h4>
                  <p className="text-sm text-muted">
                    Wardrobe is strictly creator-curated. No explicit content, political
                    endorsements, or commercial promotions are permitted in these personal
                    commissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
