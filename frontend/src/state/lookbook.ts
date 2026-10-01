import { createContext, useContext } from 'react'
import type { CreatorProfile, VisualCategory, VisualItem } from '../../../shared/domain/creatorProfile.ts'

export type LookbookItem = VisualItem
export type LookbookCategory = VisualCategory

type SelectedItem = LookbookItem & { categoryId: string; categoryName: string }

export type LookbookValue = {
  profile: CreatorProfile
  /** What a fan sees: adult categories left out unless allowed. */
  categories: LookbookCategory[]
  /** Everything, for the creator's editor. */
  allCategories: LookbookCategory[]
  adultAllowed: boolean
  /**
   * Turns a file into an image URL the profile can hold. Absent when this site
   * can't store images; the editor then says so instead of offering uploads.
   */
  storeImage?: (file: File) => Promise<string>
  /** Category id → chosen item ids. In memory only, in every build. */
  choices: Record<string, string[]>
  selectedItems: SelectedItem[]
  choose: (categoryId: string, itemId: string | null) => void
  addCategory: (name: string) => boolean
  renameCategory: (id: string, name: string) => boolean
  removeCategory: (id: string) => void
  setCategoryLimit: (id: string, maxSelections: number) => void
  addItem: (categoryId: string, name: string, image: string) => boolean
  removeItem: (categoryId: string, itemId: string) => void
  updateBrand: (changes: Partial<CreatorProfile['brand']>) => void
  updateVoice: (field: 'style' | 'tone' | 'mood', value: string) => void
  updateBoundaries: (field: 'hardNo' | 'askFirst', values: string[]) => void
}

export const LookbookContext = createContext<LookbookValue | null>(null)

export function useLookbook(): LookbookValue {
  const value = useContext(LookbookContext)
  if (!value) throw new Error('useLookbook must be used inside <LookbookProvider>')
  return value
}

/** For screens shared by builds where a lookbook may not be mounted (staging's fan journey). */
export function useOptionalLookbook(): LookbookValue | null {
  return useContext(LookbookContext)
}
