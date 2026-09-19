import { CHECKLIST_LABELS } from '../../shared/domain/boundaries.ts'
import { MAX_RANGE_COMBINATIONS, combinationCount } from '../../shared/domain/ranges.ts'
import type { CatalogContent } from '../../shared/domain/types.ts'
import { checkText } from './rules/check.ts'

/**
 * Catalog publishing (doc 11 §8 Phase 2: "Catalog publish runs through the
 * admin script, not an editor UI"). The checks here run before any SQL is
 * written; a version that fails stays unpublished, and each problem names the
 * item and the rule.
 */

export type PublishProblem =
  | { code: 'hard_list'; where: string; key: string }
  | { code: 'structure'; where: string; detail: string }

const ID = /^[A-Za-z0-9_-]{1,64}$/
const LIMITS = { customLimits: 10, customLimitText: 200, pricingNote: 400, label: 80, description: 400 }

export function validateCatalogForPublish(
  content: CatalogContent,
  opts: { performerNames?: string[] } = {},
): PublishProblem[] {
  const problems: PublishProblem[] = []
  const structure = (where: string, detail: string) => problems.push({ code: 'structure', where, detail })
  /** `onlyKeys`: for text that states a refusal, only these hard-list keys count. */
  const texts: { where: string; text: string; onlyKeys?: string[] }[] = []

  const ids = new Set<string>()
  for (const category of content.categories) {
    const at = `category ${category.key}`
    if (!category.key || !category.label) structure(at, 'needs a key and a label')
    texts.push({ where: `${at} label`, text: category.label })
    if (category.description) texts.push({ where: `${at} description`, text: category.description })
    if (category.contentRating === 'adult' && (category.items.length > 0 || !category.hidden)) {
      // Adult content is modelled but off (§5.4): nothing adult may be published in Phases 0–3.
      structure(at, 'adult categories must stay hidden and empty')
    }
    if (category.selection.min > category.selection.max) structure(at, 'selection min is above max')
    const groups = category.groups ?? []
    for (const g of groups) {
      if (g.min > g.max) structure(`${at} group ${g.key}`, 'min is above max')
      const visible = category.items.filter((i) => i.groupKey === g.key && !i.hidden).length
      if (!category.hidden && visible < g.min) structure(`${at} group ${g.key}`, 'not enough visible items for its minimum')
    }
    if (!groups.length && !category.hidden && category.items.filter((i) => !i.hidden).length < category.selection.min) {
      structure(at, 'not enough visible items for its minimum')
    }
    for (const item of category.items) {
      const where = `item ${item.id}`
      if (!ID.test(item.id)) structure(where, 'id must be 1–64 letters, digits, _ or -')
      if (ids.has(item.id)) structure(where, 'duplicate id')
      ids.add(item.id)
      if (!item.label || item.label.length > LIMITS.label) structure(where, `label must be 1–${LIMITS.label} characters`)
      if ((item.description?.length ?? 0) > LIMITS.description) structure(where, 'description too long')
      if (groups.length && !groups.some((g) => g.key === item.groupKey)) structure(where, 'groupKey matches no group')
      if (item.contentRating === 'adult') structure(where, 'adult items are not allowed')
      const p = item.pricing
      if (p.kind === 'per_unit' && (p.minQty < 1 || p.minQty > p.maxQty)) structure(where, 'per-unit quantity range is invalid')
      if (p.kind === 'percent' && (p.basisPoints < 1 || p.basisPoints > 10_000)) structure(where, 'percentage must be 0.01%–100%')
      texts.push({ where: `${where} label`, text: item.label })
      if (item.description) texts.push({ where: `${where} description`, text: item.description })
    }
  }
  for (const category of content.categories) {
    for (const item of category.items) {
      for (const ref of [...(item.requires ?? []), ...(item.excludes ?? [])]) {
        if (!ids.has(ref)) structure(`item ${item.id}`, `refers to unknown item ${ref}`)
      }
    }
  }
  for (const template of content.templates) {
    const where = `template ${template.key}`
    for (const s of template.selections) if (!ids.has(s.itemId)) structure(where, `refers to unknown item ${s.itemId}`)
    texts.push({ where: `${where} label`, text: template.label })
    if (template.description) texts.push({ where: `${where} description`, text: template.description })
  }

  const b = content.boundaries
  for (const key of Object.keys(b.checklist)) {
    // A limit fans can't read can't be "listed up front" (§5.3.4).
    if (!CHECKLIST_LABELS[key]) structure(`limit ${key}`, 'has no approved fan-facing label')
  }
  if (b.custom.length > LIMITS.customLimits) structure('custom limits', `at most ${LIMITS.customLimits}`)
  for (const c of b.custom) {
    if (!c.text.trim() || c.text.length > LIMITS.customLimitText) structure(`custom limit ${c.id}`, `text must be 1–${LIMITS.customLimitText} characters`)
    // A limit names what the creator refuses ("No deepfakes"), so naming a
    // hard-list subject there is fine. Contact details, payment links and
    // hate are not.
    texts.push({ where: `custom limit ${c.id}`, text: c.text, onlyKeys: ['solicitation', 'hate_harassment'] })
  }
  if (content.pricingNote !== null) {
    if (content.pricingNote.length > LIMITS.pricingNote) structure('pricing note', `at most ${LIMITS.pricingNote} characters`)
    texts.push({ where: 'pricing note', text: content.pricingNote })
  }
  for (const name of opts.performerNames ?? []) texts.push({ where: `performer ${name}`, text: name })

  // Check point 4 of §5.3.3: every creator-written text, at publish.
  for (const { where, text, onlyKeys } of texts) {
    const hit = checkText(text).hardList
    if (hit && (!onlyKeys || onlyKeys.includes(hit.key))) problems.push({ code: 'hard_list', where, key: hit.key })
  }

  if (combinationCount(content, { adultAllowed: false }) > MAX_RANGE_COMBINATIONS) {
    structure('catalog', 'too many combinations to derive price ranges; simplify the selection groups')
  }
  return problems
}

export interface PublishInput {
  creatorId: string
  catalogId: string
  versionId: string
  version: number
  content: CatalogContent
  now: string
  /** First publish only: create the creator (no Clerk user, so nobody can sign in as them) and the catalog. */
  createCreator?: { displayName: string }
}

/**
 * The statements that publish a version: insert it as published, retire the
 * previous published version, and point the catalog at the new one. Older
 * versions stay readable, because drafts are pinned to them until the fan
 * accepts the new breakdown.
 */
export function publishStatements(input: PublishInput): { sql: string; params: (string | number | null)[] }[] {
  const statements: { sql: string; params: (string | number | null)[] }[] = []
  if (input.createCreator) {
    statements.push({
      sql: `INSERT INTO creator (id, clerk_user_id, display_name, status, invited_at, created_at) VALUES (?, NULL, ?, 'active', ?, ?)`,
      params: [input.creatorId, input.createCreator.displayName, input.now, input.now],
    })
    statements.push({ sql: 'INSERT INTO catalog (id, creator_id) VALUES (?, ?)', params: [input.catalogId, input.creatorId] })
  }
  statements.push(
    {
      sql: `INSERT INTO catalog_version (id, catalog_id, version, status, content_json, created_at, published_at) VALUES (?, ?, ?, 'published', ?, ?, ?)`,
      params: [input.versionId, input.catalogId, input.version, JSON.stringify(input.content), input.now, input.now],
    },
    {
      sql: `UPDATE catalog_version SET status = 'retired' WHERE catalog_id = ? AND status = 'published' AND id <> ?`,
      params: [input.catalogId, input.versionId],
    },
    {
      sql: 'UPDATE catalog SET current_published_version_id = ? WHERE id = ? AND creator_id = ?',
      params: [input.versionId, input.catalogId, input.creatorId],
    },
  )
  return statements
}

/** Renders the statements as one SQL file for `wrangler d1 execute --file`. */
export function toSqlFile(statements: { sql: string; params: (string | number | null)[] }[]): string {
  const literal = (v: string | number | null) =>
    v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`
  return statements
    .map(({ sql, params }) => {
      let i = 0
      return `${sql.replace(/\?/g, () => literal(params[i++]))};`
    })
    .join('\n')
    .concat('\n')
}
