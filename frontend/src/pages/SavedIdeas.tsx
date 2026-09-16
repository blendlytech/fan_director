import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'

// The fan navigation includes "Saved ideas", but no design draft covers it yet.
export function SavedIdeas() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-container px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="mb-4 text-4xl font-semibold tracking-tight">Saved ideas</h1>
        <p className="mx-auto mb-10 max-w-md text-muted">
          This part of the boutique has not been designed yet. Ideas you save in the Director are
          not stored by this prototype.
        </p>
        <Button to="/" variant="secondary" icon="lucide:arrow-left">
          Back to collection
        </Button>
      </main>
    </>
  )
}
