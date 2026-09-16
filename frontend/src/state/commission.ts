import { createContext, useContext } from 'react'
import type { Draft, LineItem } from '../domain/sceneCard'

export type CommissionValue = {
  draft: Draft
  lineItems: LineItem[]
  /** Always derived: sumOf(lineItems). Never assign a total directly. */
  total: number
  /** Positive when under budget, negative when over. */
  difference: number
  overBudget: boolean
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
