import { createContext, useContext } from 'react'
import type { CatalogView, Draft, LineItem } from '../domain/sceneCard'

export type CommissionValue = {
  /** The catalog the draft is priced against. */
  view: CatalogView
  draft: Draft
  lineItems: LineItem[]
  /** Cents. Always the quote's total, which the lines add up to. Never assign a total directly. */
  total: number
  /** Cents. Positive when under budget, negative when over. */
  difference: number
  overBudget: boolean
  /** Days from payment confirmation, from the quote. */
  deliveryDays: number
  canUndo: boolean
  commit: (changes: Partial<Draft>) => void
  addNote: (text: string) => void
  undo: () => void
  reset: () => void
}

export const CommissionContext = createContext<CommissionValue | null>(null)

export function useCommission(): CommissionValue {
  const value = useContext(CommissionContext)
  if (!value) {
    throw new Error('useCommission must be used inside <CommissionProvider>')
  }
  return value
}
