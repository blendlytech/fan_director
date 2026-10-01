import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fanCategories, isAdultCategory, PROFILE_LIMITS, type CreatorProfile } from '../../../shared/domain/creatorProfile.ts'
import { LookbookContext } from './lookbook'

const BRAND_VARS = [
  ['background', '--studio-cream'],
  ['surface', '--studio-panel'],
  ['text', '--studio-espresso'],
  ['accent', '--studio-accent'],
] as const

/** "#84485D" → "132 72 93", the form tailwind.config.js reads. */
function channels(hex: string): string | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return match ? match.slice(1).map((part) => parseInt(part, 16)).join(' ') : null
}

/**
 * One creator's lookbook, held in memory. The public demo mounts one for the
 * whole visit, so a refresh restores the sample profile; staging's editor
 * mounts one per saved revision and saves it through the API itself.
 */
export function LookbookProvider({
  initialProfile,
  adultAllowed = false,
  storeImage,
  children,
}: {
  initialProfile: CreatorProfile
  adultAllowed?: boolean
  storeImage?: (file: File) => Promise<string>
  children: ReactNode
}) {
  const [profile, setProfile] = useState<CreatorProfile>(initialProfile)
  const [choices, setChoices] = useState<Record<string, string[]>>({})

  // The brand previews across the site while this lookbook is mounted, and
  // goes back to the design system's colours when it isn't.
  useEffect(() => {
    const root = document.documentElement
    for (const [field, name] of BRAND_VARS) {
      const value = channels(profile.brand[field])
      if (value) root.style.setProperty(name, value)
      else root.style.removeProperty(name)
    }
    if (profile.brand.backgroundImage) root.style.setProperty('--studio-background-image', `url("${profile.brand.backgroundImage}")`)
    else root.style.removeProperty('--studio-background-image')
    return () => {
      for (const [, name] of BRAND_VARS) root.style.removeProperty(name)
      root.style.removeProperty('--studio-background-image')
    }
  }, [profile.brand])

  const allCategories = profile.categories
  const categories = useMemo(() => fanCategories(profile, { adultAllowed }), [profile, adultAllowed])
  const selectedItems = useMemo(() => categories.flatMap((category) => category.items
    .filter((item) => (choices[category.id] ?? []).includes(item.id))
    .map((item) => ({ ...item, categoryId: category.id, categoryName: category.name }))), [categories, choices])

  function choose(categoryId: string, itemId: string | null) {
    const category = categories.find((entry) => entry.id === categoryId)
    if (!category) return
    if (itemId !== null && !category.items.some((item) => item.id === itemId)) return
    setChoices((current) => {
      const selected = current[categoryId] ?? []
      if (itemId === null) return { ...current, [categoryId]: [] }
      if (selected.includes(itemId)) return { ...current, [categoryId]: selected.filter((id) => id !== itemId) }
      if (category.maxSelections === 1) return { ...current, [categoryId]: [itemId] }
      if (selected.length >= category.maxSelections) return current
      return { ...current, [categoryId]: [...selected, itemId] }
    })
  }

  function nameTaken(name: string, exceptId?: string) {
    return allCategories.some((category) => category.id !== exceptId && category.name.toLowerCase() === name.toLowerCase())
  }

  function addCategory(name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > PROFILE_LIMITS.categoryName || nameTaken(trimmed)) return false
    if (allCategories.length >= PROFILE_LIMITS.categories) return false
    setProfile((current) => ({ ...current, categories: [...current.categories, { id: crypto.randomUUID(), name: trimmed, maxSelections: 1, items: [], custom: true }] }))
    return true
  }

  function renameCategory(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > PROFILE_LIMITS.categoryName || nameTaken(trimmed, id)) return false
    setProfile((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, name: trimmed } : category) }))
    return true
  }

  function removeCategory(id: string) {
    setProfile((current) => ({ ...current, categories: current.categories.filter((category) => category.id !== id) }))
    setChoices((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function setCategoryLimit(id: string, maxSelections: number) {
    if (!Number.isInteger(maxSelections) || maxSelections < 1 || maxSelections > PROFILE_LIMITS.maxSelections) return
    setProfile((current) => ({ ...current, categories: current.categories.map((category) => category.id === id ? { ...category, maxSelections } : category) }))
    setChoices((current) => ({ ...current, [id]: (current[id] ?? []).slice(0, maxSelections) }))
  }

  function addItem(categoryId: string, name: string, image: string) {
    const trimmed = name.trim()
    const category = allCategories.find((entry) => entry.id === categoryId)
    if (!trimmed || trimmed.length > PROFILE_LIMITS.itemName || !image || !category) return false
    // Adult categories stay empty until adult content is allowed (doc 11 §5.4).
    if (isAdultCategory(category) && !adultAllowed) return false
    if (category.items.length >= PROFILE_LIMITS.itemsPerCategory) return false
    setProfile((current) => ({ ...current, categories: current.categories.map((entry) => entry.id === categoryId
      ? { ...entry, items: [...entry.items, { id: crypto.randomUUID(), name: trimmed, image, custom: true }] }
      : entry) }))
    return true
  }

  function removeItem(categoryId: string, itemId: string) {
    setProfile((current) => ({ ...current, categories: current.categories.map((category) => category.id === categoryId
      ? { ...category, items: category.items.filter((entry) => entry.id !== itemId) }
      : category) }))
    setChoices((current) => ({ ...current, [categoryId]: (current[categoryId] ?? []).filter((id) => id !== itemId) }))
  }

  function updateBrand(changes: Partial<CreatorProfile['brand']>) {
    setProfile((current) => ({ ...current, brand: { ...current.brand, ...changes } }))
  }

  function updateVoice(field: 'style' | 'tone' | 'mood', value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  function updateBoundaries(field: 'hardNo' | 'askFirst', values: string[]) {
    setProfile((current) => ({ ...current, boundaries: { ...current.boundaries, [field]: values } }))
  }

  return <LookbookContext.Provider value={{
    profile, categories, allCategories, adultAllowed, storeImage, choices, selectedItems, choose,
    addCategory, renameCategory, removeCategory, setCategoryLimit, addItem, removeItem,
    updateBrand, updateVoice, updateBoundaries,
  }}>{children}</LookbookContext.Provider>
}
