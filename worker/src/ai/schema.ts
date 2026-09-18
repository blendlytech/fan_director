import type { DirectorOption } from '../../../shared/domain/director.ts'

/**
 * The Director's response contract (doc 11 §8 Phase 3), built per request:
 * `itemId` and `removes` are locked to an enum of the ids the fan may choose
 * this turn. The same shape is checked again here, strictly, because a schema
 * sent to a provider is a request, not a guarantee.
 */

export const SCHEMA_NAME = 'director_intent'

export interface DirectorReply {
  options: DirectorOption[]
  notOffered: string[]
  customRequest: string | null
  clarifyingQuestion: string | null
  note: string | null
}

export const LIMITS = {
  options: 2,
  wants: 6,
  removes: 4,
  label: 60,
  notOffered: 3,
  notOfferedText: 80,
  customRequest: 200,
  clarifyingQuestion: 160,
  note: 140,
} as const

export function directorSchema(allowedIds: readonly string[], maxQty: number): Record<string, unknown> {
  const ids = [...allowedIds].sort()
  const idSchema = ids.length > 0 ? { type: 'string', enum: ids } : { type: 'string', enum: ['__none__'] }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['options', 'notOffered', 'customRequest', 'clarifyingQuestion', 'note'],
    properties: {
      options: {
        type: 'array',
        maxItems: ids.length > 0 ? LIMITS.options : 0,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'wants', 'removes'],
          properties: {
            label: { type: 'string', maxLength: LIMITS.label },
            wants: {
              type: 'array',
              maxItems: LIMITS.wants,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['itemId', 'qty'],
                properties: {
                  itemId: idSchema,
                  qty: { type: 'integer', minimum: 1, maximum: Math.max(1, maxQty) },
                },
              },
            },
            removes: { type: 'array', maxItems: LIMITS.removes, items: idSchema },
          },
        },
      },
      notOffered: { type: 'array', maxItems: LIMITS.notOffered, items: { type: 'string', maxLength: LIMITS.notOfferedText } },
      customRequest: { type: ['string', 'null'], maxLength: LIMITS.customRequest },
      clarifyingQuestion: { type: ['string', 'null'], maxLength: LIMITS.clarifyingQuestion },
      note: { type: ['string', 'null'], maxLength: LIMITS.note },
    },
  }
}

export type Parsed = { ok: true; value: DirectorReply } | { ok: false; errors: string[] }

/**
 * Parses and checks a reply. Errors are short, fixed phrases the retry prompt
 * can repeat to the model; they never quote the reply. The qty maximum here
 * is only the schema's; the option builder caps each item to its own range.
 */
export function parseDirectorReply(raw: string, allowedIds: ReadonlySet<string>, maxQty: number): Parsed {
  let data: unknown
  try {
    data = JSON.parse(stripFence(raw))
  } catch {
    return { ok: false, errors: ['the reply was not valid JSON'] }
  }
  const errors: string[] = []
  if (!isRecord(data)) return { ok: false, errors: ['the reply must be a JSON object'] }
  exactKeys(data, ['options', 'notOffered', 'customRequest', 'clarifyingQuestion', 'note'], 'the reply', errors)

  const options: DirectorOption[] = []
  if (!Array.isArray(data.options) || data.options.length > LIMITS.options) {
    errors.push(`options must be an array of at most ${LIMITS.options}`)
  } else {
    data.options.forEach((o, i) => {
      const where = `options[${i}]`
      if (!isRecord(o)) return void errors.push(`${where} must be an object`)
      exactKeys(o, ['label', 'wants', 'removes'], where, errors)
      if (!boundedString(o.label, LIMITS.label)) errors.push(`${where}.label must be a string of at most ${LIMITS.label} characters`)
      const wants: DirectorOption['wants'] = []
      if (!Array.isArray(o.wants) || o.wants.length > LIMITS.wants) errors.push(`${where}.wants must be an array of at most ${LIMITS.wants}`)
      else
        o.wants.forEach((w, j) => {
          if (!isRecord(w)) return void errors.push(`${where}.wants[${j}] must be an object`)
          exactKeys(w, ['itemId', 'qty'], `${where}.wants[${j}]`, errors)
          if (typeof w.itemId !== 'string' || !allowedIds.has(w.itemId)) errors.push(`${where}.wants[${j}].itemId is not an allowed item id`)
          if (!Number.isInteger(w.qty) || (w.qty as number) < 1 || (w.qty as number) > Math.max(1, maxQty)) {
            errors.push(`${where}.wants[${j}].qty must be an integer from 1 to ${Math.max(1, maxQty)}`)
          }
          wants.push({ itemId: String(w.itemId), qty: Number(w.qty) })
        })
      const removes: string[] = []
      if (!Array.isArray(o.removes) || o.removes.length > LIMITS.removes) errors.push(`${where}.removes must be an array of at most ${LIMITS.removes}`)
      else
        o.removes.forEach((r, j) => {
          if (typeof r !== 'string' || !allowedIds.has(r)) errors.push(`${where}.removes[${j}] is not an allowed item id`)
          removes.push(String(r))
        })
      options.push({ label: typeof o.label === 'string' ? o.label : '', wants, removes })
    })
  }

  const notOffered: string[] = []
  if (!Array.isArray(data.notOffered) || data.notOffered.length > LIMITS.notOffered) {
    errors.push(`notOffered must be an array of at most ${LIMITS.notOffered}`)
  } else {
    for (const n of data.notOffered) {
      if (!boundedString(n, LIMITS.notOfferedText)) errors.push(`notOffered entries must be strings of at most ${LIMITS.notOfferedText} characters`)
      else notOffered.push(n)
    }
  }
  const nullable = (key: 'customRequest' | 'clarifyingQuestion' | 'note', max: number): string | null => {
    const v = data[key]
    if (v === null) return null
    if (!boundedString(v, max)) {
      errors.push(`${key} must be null or a string of at most ${max} characters`)
      return null
    }
    return v.trim() === '' ? null : v
  }
  const customRequest = nullable('customRequest', LIMITS.customRequest)
  const clarifyingQuestion = nullable('clarifyingQuestion', LIMITS.clarifyingQuestion)
  const note = nullable('note', LIMITS.note)

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)].slice(0, 8) }
  return { ok: true, value: { options, notOffered, customRequest, clarifyingQuestion, note } }
}

function stripFence(raw: string): string {
  const t = raw.trim()
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t)
  return m ? m[1] : t
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function boundedString(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.length <= max
}

function exactKeys(obj: Record<string, unknown>, keys: string[], where: string, errors: string[]): void {
  for (const k of Object.keys(obj)) if (!keys.includes(k)) errors.push(`${where} has an unknown field`)
  for (const k of keys) if (!(k in obj)) errors.push(`${where} is missing ${k}`)
}
