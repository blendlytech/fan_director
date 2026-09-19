import { effectiveLimits, CHECKLIST_LABELS } from '../../../shared/domain/boundaries.ts'
import { allowedItems, buildOption, DIRECTOR_SLOTS_V1, optionTitle, sameSelections, type BuiltOption, type DropReason } from '../../../shared/domain/director.ts'
import { hardListLines, type HardListKey } from '../../../shared/domain/hardList.ts'
import { quote } from '../../../shared/domain/quote.ts'
import type { BoundaryFlag, Boundaries, GateOptions, Quote, Selection } from '../../../shared/domain/types.ts'
import type { FanIdentity } from '../auth'
import { gateFor, loadVersion, type VersionRow } from '../catalog'
import { checkContent, draftOf, present, requireOwned, type DraftRow } from '../drafts'
import { ApiError, json, readJsonBody } from '../http'
import { checkText, checkTexts, RULESET_VERSION, type CheckContext } from '../rules/check'
import { aiDisabledFor, CLASSIFIER_SUBJECTS, recordHardListBlock, type BlockHit } from '../screening'
import type { Deps, DraftContent, Env } from '../types'
import { assertOnlyKeys, UUID } from '../validation'
import { CLASSIFIER_VERSION, classifierRequest, readVerdict, type ClassifierVerdict } from './classifier'
import { aiConfig, type AiConfig } from './config'
import { providerContext } from './context'
import { COPY_VERSION, copy } from './copy'
import { mentionsIntimate } from './intimate'
import { hold, reconcile, reserve, type CallPurpose } from './ledger'
import { costFromTokens, DIRECTOR_MODELS, reservationFor } from './models'
import { checkOutputText, OUTPUT_CHECKS_VERSION } from './outputChecks'
import { DIRECTOR_MAX_TOKENS, DIRECTOR_PROMPT_VERSION, DIRECTOR_TEMPERATURE, DIRECTOR_TIMEOUT_MS, directorSystemPrompt, retryMessage, RETRY_PROMPT_VERSION } from './prompts/director-v1'
import { isAmbiguous, type AiProviders, type ChatMessage, type CompletionRequest, type CompletionResult } from './provider'
import { directorSchema, parseDirectorReply, SCHEMA_NAME, type DirectorReply } from './schema'

/**
 * One AI Director turn (doc 11 §8 Phase 3, doc 10 §4). The model names
 * catalog items; everything else happens here:
 *
 *  1. gates and limits: kill switches, restrictions, replies left, rates,
 *     the draft's revision; then one pending request per draft (a unique index);
 *  2. the hard list on the fan's words: the rules layer, then the classifier
 *     (failing closed); a hit is recorded like a draft block, with no model call;
 *  3. the model call with a schema built for this request, falling back to the
 *     second model on a provider failure and retrying once on invalid output;
 *  4. checks on every text field: money and approval wording, the rules
 *     layer, and the classifier;
 *  5. options built, validated and quoted by the server; ask-me flags attached;
 *     hard-no and unbuildable options dropped, with reasons recorded;
 *  6. every sentence the fan sees from the fixed templates.
 *
 * The draft is never changed by a turn: only accepting a suggestion changes it.
 */

class TurnFailure extends Error {
  constructor(
    readonly reason: 'provider' | 'invalid' | 'classifier' | 'budget',
    readonly detail: Record<string, unknown> = {},
  ) {
    super(reason)
  }
}

interface TurnState {
  requestId: string
  creatorId: string
  attempts: number
  fallbackUsed: boolean
  config: AiConfig
  providers: AiProviders
  env: Env
  deps: Deps
  detail: Record<string, unknown>
}

const MESSAGE_BODY_BYTES = 12_288

/** GET …/drafts/:id/director: replies left, whether AI is on, and the thread so far. */
export async function getDirector(env: Env, deps: Deps, fan: FanIdentity, creatorId: string, draftId: string): Promise<Response> {
  const row = await requireOwned(env, fan, creatorId, draftId)
  const config = aiConfig(env)
  const availability = await availabilityOf(env, deps, fan, creatorId, config)
  const used = await countedTurns(env, draftId)
  const { results: turns } = await env.DB.prepare(
    `SELECT r.id, r.created_at, t.fan_message, t.response_json
       FROM ai_request r JOIN ai_turn_content t ON t.ai_request_id = r.id
      WHERE r.draft_id = ? AND r.fan_id = ? AND r.status = 'succeeded' AND t.expires_at > ?
      ORDER BY r.created_at`,
  )
    .bind(draftId, fan.fanId, deps.now().toISOString())
    .all<{ id: string; created_at: string; fan_message: string; response_json: string | null }>()
  const { results: decided } = await env.DB.prepare(`SELECT id, status FROM ai_suggestion WHERE draft_id = ? AND fan_id = ?`)
    .bind(draftId, fan.fanId)
    .all<{ id: string; status: string }>()
  return json(200, {
    available: availability === null,
    reason: availability,
    repliesLeft: Math.max(0, config.turnsPerDraft - used),
    draftRevision: row.revision,
    turns: turns.map((t) => ({
      requestId: t.id,
      createdAt: t.created_at,
      fanMessage: t.fan_message,
      response: t.response_json ? JSON.parse(t.response_json) : null,
    })),
    suggestionStatus: Object.fromEntries(decided.map((d) => [d.id, d.status])),
  })
}

/** POST …/drafts/:id/director: one turn. */
export async function postDirectorTurn(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
  draftId: string,
): Promise<Response> {
  const row = await requireOwned(env, fan, creatorId, draftId)
  const body = await readJsonBody(request, MESSAGE_BODY_BYTES)
  assertOnlyKeys(body, ['requestId', 'expectedRevision', 'message'], 'invalid_request')
  const config = aiConfig(env)
  if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)) throw new ApiError(400, 'invalid_request', { field: 'requestId' })
  if (!Number.isInteger(body.expectedRevision)) throw new ApiError(400, 'invalid_request', { field: 'expectedRevision' })
  if (typeof body.message !== 'string' || body.message.trim() === '') throw new ApiError(400, 'invalid_request', { field: 'message' })
  const message = body.message.trim()
  if (message.length > config.maxMessageChars) throw new ApiError(413, 'message_too_long', { max: config.maxMessageChars })
  const clientRequestId = body.requestId

  // A retried send with the same id is the same turn.
  const previous = await env.DB.prepare(
    `SELECT r.status, r.draft_id, t.response_json FROM ai_request r LEFT JOIN ai_turn_content t ON t.ai_request_id = r.id
      WHERE r.fan_id = ? AND r.client_request_id = ?`,
  )
    .bind(fan.fanId, clientRequestId)
    .first<{ status: string; draft_id: string; response_json: string | null }>()
  if (previous) {
    if (previous.draft_id !== draftId) throw new ApiError(409, 'duplicate_request')
    if (previous.status === 'pending') throw new ApiError(409, 'ai_request_in_flight')
    if (previous.status === 'succeeded' && previous.response_json) return json(200, JSON.parse(previous.response_json))
    throw new ApiError(409, 'duplicate_request')
  }

  const unavailable = await availabilityOf(env, deps, fan, creatorId, config)
  const used = await countedTurns(env, draftId)
  if (unavailable) throw new ApiError(503, 'ai_unavailable', { reason: unavailable, repliesLeft: Math.max(0, config.turnsPerDraft - used) })
  if (used >= config.turnsPerDraft) throw new ApiError(429, 'ai_replies_exhausted', { repliesLeft: 0 })

  const version = await loadVersion(env, creatorId, row.catalog_version_id)
  if (!version) throw new ApiError(422, 'catalog_version_mismatch')
  if (version.currentVersionId !== version.id) {
    throw new ApiError(409, 'catalog_version_stale', { currentCatalogVersionId: version.currentVersionId })
  }
  if (body.expectedRevision !== row.revision) throw new ApiError(409, 'revision_conflict', { current: draftOf(row) })
  await checkRates(env, deps, fan.fanId, creatorId, config)

  // One request in flight per draft: the partial unique index decides.
  const nowIso = deps.now().toISOString()
  const staleBefore = new Date(deps.now().getTime() - config.staleRequestMs).toISOString()
  await env.DB.prepare(
    `UPDATE ai_request SET status = 'failed', outcome = 'abandoned', finished_at = ? WHERE draft_id = ? AND status = 'pending' AND created_at < ?`,
  )
    .bind(nowIso, draftId, staleBefore)
    .run()
  const requestId = crypto.randomUUID()
  try {
    await env.DB.prepare(
      `INSERT INTO ai_request (id, fan_id, creator_id, draft_id, status, provider, model, created_at, client_request_id, draft_revision,
                               prompt_version, classifier_version, ruleset_version, copy_version)
       VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        requestId, fan.fanId, creatorId, draftId, deps.ai!.director.name, nowIso, clientRequestId, row.revision,
        `${DIRECTOR_PROMPT_VERSION}+${RETRY_PROMPT_VERSION}`, CLASSIFIER_VERSION, `${RULESET_VERSION}+${OUTPUT_CHECKS_VERSION}`, COPY_VERSION,
      )
      .run()
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) throw new ApiError(409, 'ai_request_in_flight')
    throw err
  }

  const state: TurnState = {
    requestId, creatorId, attempts: 0, fallbackUsed: false, config, providers: deps.ai!, env, deps, detail: {},
  }
  try {
    const response = await runTurn(request, state, fan, row, version, message, used)
    await finish(state, 'succeeded', 'reply', true, { fanMessage: message, response })
    return json(200, response)
  } catch (err) {
    if (err instanceof TurnFailure) {
      await finish(state, 'failed', err.reason, false, null, err.detail)
      throw new ApiError(503, 'ai_unavailable', { reason: err.reason, repliesLeft: Math.max(0, config.turnsPerDraft - used) })
    }
    if (err instanceof ApiError && (err.code === 'hard_list_blocked' || err.code === 'account_paused')) {
      await finish(state, 'rejected', 'input_blocked', false, null)
      throw err
    }
    await finish(state, 'failed', 'error', false, null)
    throw err
  }
}

/* ------------------------------ The turn ---------------------------------- */

async function runTurn(
  request: Request,
  state: TurnState,
  fan: FanIdentity,
  row: DraftRow,
  version: VersionRow,
  message: string,
  used: number,
): Promise<Record<string, unknown>> {
  const { env, deps } = state
  const creatorId = state.creatorId
  const creator = version.creatorName
  const draft = JSON.parse(row.content_json) as DraftContent
  const gate = await gateFor(env, creatorId)
  const boundaries = version.content.boundaries
  const limits = effectiveLimits(boundaries, gate)
  const partners = await verifiedPartners(env, creatorId)
  const ctx: CheckContext = { limits, verifiedPerformers: partners.length }
  const earlier = await earlierMessages(env, row.id, deps.now())

  // --- 2. The hard list on the fan's words -----------------------------------
  const blockCtx = (hit: BlockHit) => ({
    creatorId,
    creatorName: creator,
    subjectKind: 'ai_request' as const,
    subjectId: state.requestId,
    field: 'fan_message',
    hit,
    evidence: { draftId: row.id, aiRequestId: state.requestId, field: 'fan_message', message, earlierMessages: earlier, draft },
  })
  const rules = checkTexts([...earlier, message], ctx)
  if (rules.hardList) await recordHardListBlock(request, env, deps, fan, blockCtx(rules.hardList))

  const customLimits = limits.custom.filter((c) => c.text.trim() !== '')
  const policy = { creatorName: creator, performers: partners, customLimits: customLimits.map((c) => ({ id: c.id, text: c.text })) }
  const knownLimitIds = new Set(customLimits.map((c) => c.id))
  const classifierInput = [...earlier.slice(-2), message].join('\n')
  const inputVerdict = await classify(state, 'classify_input', classifierInput, policy, knownLimitIds)
  if (inputVerdict.key) {
    await recordHardListBlock(request, env, deps, fan, blockCtx(classifierHit(inputVerdict.key, inputVerdict.escalated)))
  }

  // Creator limits the message itself touches: only this message, so an
  // earlier "not offered" isn't repeated on every turn.
  const messageLimits = checkText(message, ctx).limits
  const notOffered = new Map<string, string>()
  const askFirst = new Map<string, { flag: BoundaryFlag; label: string }>()
  for (const hit of messageLimits) {
    const label = CHECKLIST_LABELS[hit.limitKey] ?? hit.limitKey
    if (hit.mode === 'hard_no') notOffered.set(`checklist:${hit.limitKey}`, label)
    else askFirst.set(`checklist:${hit.limitKey}`, { label, flag: { source: 'suggestion', limit: { kind: 'checklist', key: hit.limitKey }, mode: 'ask_me' } })
  }
  for (const id of inputVerdict.limitIds) {
    const limit = customLimits.find((c) => c.id === id)!
    if (limit.mode === 'hard_no') notOffered.set(`custom:${id}`, limit.text)
    else askFirst.set(`custom:${id}`, { label: limit.text, flag: { source: 'suggestion', limit: { kind: 'custom', id }, mode: 'ask_me' } })
  }

  // --- 3. The enum and the model call ----------------------------------------
  const allowed = allowedItems(version.content, gate, {
    slots: DIRECTOR_SLOTS_V1,
    excluded: (item) => {
      const text = `${item.label}. ${item.description ?? ''}`
      if (checkText(text, ctx).limits.some((l) => l.mode === 'hard_no')) return true
      // A custom hard no that shares a significant word with the item keeps it out
      // of the enum. Paraphrases (e.g. "beach" vs "outdoors") are not caught here:
      // a creator's own items are expected to respect their own limits (Gate 3 report).
      const words = significantWords(text, creator)
      return customLimits.some((c) => c.mode === 'hard_no' && [...significantWords(c.text, creator)].some((w) => words.has(w)))
    },
  })
  const allowedIds = new Set(allowed.map((e) => e.item.id))
  const maxQty = Math.max(1, ...allowed.map((e) => (e.item.pricing.kind === 'per_unit' ? e.item.pricing.maxQty : 1)))
  const schema = directorSchema([...allowedIds], maxQty)
  const intimate = gate.adultAllowed && mentionsIntimate(message, allowed)
  const decisions = await earlierDecisions(env, row.id)
  const hardNoLabels = [
    ...Object.entries(limits.checklist).filter(([k, v]) => v.enabled && v.mode === 'hard_no' && CHECKLIST_LABELS[k]).map(([k]) => CHECKLIST_LABELS[k]),
    ...customLimits.filter((c) => c.mode === 'hard_no').map((c) => c.text),
  ]
  const data = providerContext({
    content: version.content, creatorName: creator, partners, allowed, doesNotOffer: hardNoLabels,
    fanName: draft.fanDisplayName, current: draft.selections, earlierMessages: earlier, decisions, message,
  })
  const messages: ChatMessage[] = [
    { role: 'system', content: directorSystemPrompt(creator, partners) },
    { role: 'user', content: `DATA:\n${JSON.stringify(data)}` },
  ]

  const current = mustQuote(version, draft.selections, draft, gate)
  let model: string = DIRECTOR_MODELS[0]
  let reply: DirectorReply | null = null
  let built: { option: BuiltOption; quote: Quote }[] = []
  let outputVerdict: ClassifierVerdict = { key: null, limitIds: [], escalated: false }
  const drops: { index: number; reason: DropReason | { code: 'hard_no_item' } | { code: 'duplicate' } }[] = []

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    state.attempts = attempt
    const result = await paidCall(state, 'director', attempt, {
      model, messages, schema, schemaName: SCHEMA_NAME, maxTokens: DIRECTOR_MAX_TOKENS,
      temperature: DIRECTOR_TEMPERATURE, routing: 'router', timeoutMs: DIRECTOR_TIMEOUT_MS,
    })
    if (!result.ok) {
      state.detail[`attempt${attempt}`] = { failure: result.kind, model }
      if (attempt === 1) {
        // A provider failure moves to the second model once (recorded).
        model = DIRECTOR_MODELS[1]
        state.fallbackUsed = true
        continue
      }
      throw new TurnFailure('provider', { failure: result.kind })
    }

    const errors: string[] = []
    const parsed = parseDirectorReply(result.content, allowedIds, maxQty)
    if (!parsed.ok) errors.push(...parsed.errors)
    else {
      const texts = textFields(parsed.value)
      const findings = texts.flatMap((t) => checkOutputText(t.field, t.text, creator))
      const refusalShown = findings.some((f) => f.issue === 'refusal' && f.field === 'clarifyingQuestion')
      if (findings.some((f) => f.issue === 'refusal')) state.detail.refusalWording = true
      const blocking = findings.filter((f) => f.issue !== 'refusal')
      if (blocking.length) errors.push('text fields must not mention prices, amounts, budgets, discounts, dates, delivery times or approval')
      if (refusalShown) errors.push('clarifyingQuestion must be a plain planning question')
      state.detail[`attempt${attempt}Findings`] = findings.map((f) => `${f.field}:${f.issue}`)

      for (const t of texts) {
        const check = checkText(t.text, ctx)
        if (check.hardList) errors.push(`a text field breaks the platform rule "${hardListLines(check.hardList.key, creator)[0]}"; never include it`)
        // The question is shown word for word: it may never suggest a creator's hard no.
        // (notOffered names hard-no things by design; customRequest is converted below.)
        if (t.field === 'clarifyingQuestion') {
          const hardNo = check.limits.find((l) => l.mode === 'hard_no')
          if (hardNo) errors.push(`clarifyingQuestion suggests something ${creator} doesn't offer ("${CHECKLIST_LABELS[hardNo.limitKey] ?? 'a creator limit'}"); ask about catalog choices only`)
        }
      }
      const joined = texts.map((t) => t.text).join('\n')
      if (joined.trim() !== '') {
        outputVerdict = await classify(state, 'classify_output', joined, policy, knownLimitIds)
        if (outputVerdict.key) errors.push(`a text field breaks the platform rule "${hardListLines(outputVerdict.key, creator)[0]}"; never include it`)
        // A custom hard no the output touches, other than by naming it in notOffered, is refused.
        const named = new Set(parsed.value.notOffered.map((n) => matchLimit(n, customLimits, ctx, creator)?.key).filter(Boolean))
        for (const id of outputVerdict.limitIds) {
          const limit = customLimits.find((c) => c.id === id)
          if (limit?.mode === 'hard_no' && !named.has(`custom:${id}`) && !(parsed.value.customRequest && !parsed.value.clarifyingQuestion && parsed.value.options.length === 0)) {
            errors.push(`a text field suggests something ${creator} doesn't offer ("${limit.text}"); list it in notOffered instead`)
          }
          if (limit?.mode === 'ask_me') {
            askFirst.set(`custom:${id}`, { label: limit.text, flag: { source: 'suggestion', limit: { kind: 'custom', id }, mode: 'ask_me' } })
          }
        }
      }

      if (errors.length === 0) {
        reply = parsed.value
        built = []
        drops.length = 0
        parsed.value.options.forEach((o, index) => {
          const b = buildOption(version.content, draft.selections, o, gate, { allowed: allowedIds, intimate })
          if (!b.ok) return void drops.push({ index, reason: b.error })
          if (built.some((x) => sameSelections(x.option.selections, b.value.selections))) return void drops.push({ index, reason: { code: 'duplicate' } })
          const q = quote(version.content, version.id, { selections: b.value.selections, customRequest: draft.customRequest, budget: draft.budget }, gate)
          if (!q.ok) return void drops.push({ index, reason: { code: 'invalid', error: q.error } })
          built.push({ option: b.value, quote: q.value })
        })
        if (parsed.value.options.length > 0 && built.length === 0 && nothingElse(parsed.value)) {
          errors.push(`no option could be built (${drops.map((d) => d.reason.code).join(', ')}); use only allowed ids and the catalog's choose rules`)
          reply = null
        }
      }
    }
    if (errors.length === 0) break
    state.detail[`attempt${attempt}Errors`] = errors
    if (attempt === 2) throw new TurnFailure('invalid', { errors: errors.length })
    messages.push({ role: 'assistant', content: result.content }, { role: 'user', content: retryMessage(errors) })
  }
  if (!reply) throw new TurnFailure('invalid')

  // --- 5–6. What the fan sees -------------------------------------------------
  state.detail.drops = drops.map((d) => ({ index: d.index, code: d.reason.code }))
  state.detail.modelLabels = reply.options.length
  for (const entry of reply.notOffered) {
    const matched = matchLimit(entry, customLimits, ctx, creator)
    notOffered.set(matched ? matched.key : 'generic', matched ? matched.label : '')
  }
  let customRequest = reply.customRequest
  if (customRequest) {
    const hits = checkText(customRequest, ctx).limits
    const hardNo = hits.find((h) => h.mode === 'hard_no')
    const customHardNo = outputVerdict.limitIds.map((id) => customLimits.find((c) => c.id === id)!).find((c) => c.mode === 'hard_no')
    if (hardNo) notOffered.set(`checklist:${hardNo.limitKey}`, CHECKLIST_LABELS[hardNo.limitKey] ?? hardNo.limitKey)
    if (customHardNo) notOffered.set(`custom:${customHardNo.id}`, customHardNo.text)
    if (hardNo || customHardNo || boundaries.customRequestPolicy === 'decline') {
      if (!hardNo && !customHardNo) notOffered.set('generic', '')
      customRequest = null
    }
  }

  const suggestions = []
  const at = deps.now().toISOString()
  const statements: D1PreparedStatement[] = []
  for (const { option, quote: q } of built) {
    const id = crypto.randomUUID()
    const itemFlags = option.adds.flatMap((a) => {
      const entry = allowed.find((e) => e.item.id === a.itemId)
      if (!entry) return []
      return checkText(`${entry.item.label}. ${entry.item.description ?? ''}`, ctx).limits
        .filter((l) => l.mode === 'ask_me')
        .map((l) => ({ label: CHECKLIST_LABELS[l.limitKey] ?? l.limitKey, flag: { source: 'suggestion', limit: { kind: 'checklist', key: l.limitKey }, mode: 'ask_me' } as BoundaryFlag }))
    })
    const touched = uniqueBy([...askFirst.values(), ...itemFlags], (x) => JSON.stringify(x.flag.limit))
    const title = optionTitle(option)
    suggestions.push({
      id,
      title,
      adds: option.adds.map((a) => ({ label: a.label, qty: a.qty, before: a.before })),
      removes: option.removes.map((r) => ({ label: r.label })),
      deltaCents: q.total - current.total,
      newTotalCents: q.total,
      budgetDifferenceCents: q.budgetDifference,
      askFirst: touched.map((t) => ({
        limit: t.label,
        heading: copy.askFirstHeading(creator),
        body: copy.askFirstBody(creator, t.label),
        accept: copy.askFirstAccept(creator),
        decline: copy.askFirstDecline(),
        footnote: copy.askFirstFootnote(creator),
      })),
    })
    statements.push(
      env.DB.prepare(
        `INSERT INTO ai_suggestion (id, ai_request_id, draft_id, fan_id, base_revision, selections_json, flags_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'offered', ?)`,
      ).bind(id, state.requestId, row.id, fan.fanId, row.revision, JSON.stringify({ title, selections: option.selections }), JSON.stringify(touched.map((t) => t.flag)), at),
    )
  }
  if (statements.length) await env.DB.batch(statements)

  const notOfferedOut = [...notOffered].map(([key, label]) => ({
    heading: copy.notOfferedHeading(creator),
    body: key === 'generic' ? copy.notOfferedGeneric(creator) : copy.notOfferedLimit(creator, label),
  }))
  const clarifyingQuestion = reply.clarifyingQuestion
  const hasContent = suggestions.length > 0 || notOfferedOut.length > 0 || customRequest !== null || clarifyingQuestion !== null
  return {
    requestId: state.requestId,
    draftRevision: row.revision,
    repliesLeft: Math.max(0, state.config.turnsPerDraft - used - 1),
    copyVersion: COPY_VERSION,
    reply: suggestions.length === 1 ? copy.introOne() : suggestions.length === 2 ? copy.introTwo() : hasContent ? null : copy.nothingToSuggest(creator),
    suggestions,
    footer: suggestions.length ? copy.pricesFooter(creator) : null,
    notOffered: notOfferedOut,
    customRequest: customRequest
      ? { text: customRequest, offer: copy.customRequestOffer(creator), accept: copy.customRequestAccept(), decline: copy.customRequestDecline() }
      : null,
    clarifyingQuestion,
  }
}

/* ------------------------------ Helpers ----------------------------------- */

function nothingElse(r: DirectorReply): boolean {
  return r.notOffered.length === 0 && r.customRequest === null && r.clarifyingQuestion === null
}

function textFields(r: DirectorReply): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = []
  r.options.forEach((o, i) => out.push({ field: `options[${i}].label`, text: o.label }))
  r.notOffered.forEach((n, i) => out.push({ field: `notOffered[${i}]`, text: n }))
  if (r.customRequest) out.push({ field: 'customRequest', text: r.customRequest })
  if (r.clarifyingQuestion) out.push({ field: 'clarifyingQuestion', text: r.clarifyingQuestion })
  if (r.note) out.push({ field: 'note', text: r.note })
  return out.filter((t) => t.text.trim() !== '')
}

function classifierHit(key: HardListKey, escalated: boolean): BlockHit {
  return {
    key,
    ruleId: escalated ? 'classifier+child' : 'classifier',
    subject: CLASSIFIER_SUBJECTS[key],
    line: null,
    layer: 'classifier',
    version: CLASSIFIER_VERSION,
  }
}

/** Matches a model's "not offered" entry to one of the creator's hard-no limits, or none. */
function matchLimit(
  entry: string,
  custom: Boundaries['custom'],
  ctx: CheckContext,
  creator: string,
): { key: string; label: string } | null {
  const hit = checkText(entry, ctx).limits.find((l) => l.mode === 'hard_no')
  if (hit && CHECKLIST_LABELS[hit.limitKey]) return { key: `checklist:${hit.limitKey}`, label: CHECKLIST_LABELS[hit.limitKey] }
  const words = significantWords(entry, creator)
  for (const c of custom) {
    if (c.mode !== 'hard_no') continue
    const cw = significantWords(c.text, creator)
    if ([...words].some((w) => cw.has(w))) return { key: `custom:${c.id}`, label: c.text }
  }
  return null
}

const STOP = new Set(['the', 'and', 'with', 'for', 'any', 'anything', 'not', 'no', 'dont', 'does', 'doing', 'filming', 'being', 'from', 'that', 'this', 'your', 'you', 'her', 'his', 'their', 'into', 'onto'])
/** Content words for limit matching; the creator's own name never counts as a match. */
function significantWords(text: string, creator: string): Set<string> {
  const name = creator.toLowerCase()
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/(?:ing|s)$/, ''))
      .filter((w) => w.length >= 4 && !STOP.has(w) && w !== name),
  )
}

function uniqueBy<T>(list: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>()
  return list.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)))
}

function mustQuote(version: VersionRow, selections: Selection[], draft: DraftContent, gate: GateOptions): Quote {
  const q = quote(version.content, version.id, { selections, customRequest: draft.customRequest, budget: draft.budget }, gate)
  // A saved draft always validated; if it no longer does, the Director can't plan from it.
  if (!q.ok) throw new TurnFailure('invalid', { currentDraft: q.error.code })
  return q.value
}

/** One paid call: reserve first, call, then reconcile (or hold when the outcome is unclear). */
async function paidCall(state: TurnState, purpose: CallPurpose, attempt: number, req: CompletionRequest): Promise<CompletionResult> {
  const chars = req.messages.reduce((n, m) => n + m.content.length, 0) + (req.schema ? JSON.stringify(req.schema).length : 0)
  const reservation = await reserve(state.env, {
    creatorId: state.creatorId,
    requestId: state.requestId,
    purpose,
    model: req.model,
    attempt,
    amountMicroUsd: reservationFor(req.model, chars, req.maxTokens),
    ceilings: { global: state.config.globalCeilingMicroUsd, creator: state.config.creatorCeilingMicroUsd },
    now: state.deps.now(),
  })
  if (!reservation) throw new TurnFailure('budget')
  const provider = purpose === 'director' ? state.providers.director : state.providers.classifier
  let result: CompletionResult
  try {
    result = await provider.complete(req)
  } catch {
    result = { ok: false, kind: 'network', status: null, usage: null, latencyMs: 0 }
  }
  const usage = result.usage
  const common = {
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    upstream: result.ok ? result.upstream : null,
    latencyMs: result.latencyMs,
    errorKind: result.ok ? null : result.kind,
    now: state.deps.now(),
  }
  if (isAmbiguous(result)) {
    await hold(state.env, reservation, common)
  } else {
    const actual = usage?.costMicroUsd ?? (usage?.inputTokens != null && usage.outputTokens != null ? costFromTokens(req.model, usage.inputTokens, usage.outputTokens) : result.ok ? reservation.amountMicroUsd : 0)
    await reconcile(state.env, reservation, { ...common, actualMicroUsd: actual })
  }
  if (purpose === 'director') {
    await state.env.DB.prepare('UPDATE ai_request SET model = ? WHERE id = ?').bind(req.model, state.requestId).run()
  }
  return result
}

/** The classifier layer, failing closed: anything but a readable verdict ends the turn. */
async function classify(
  state: TurnState,
  purpose: 'classify_input' | 'classify_output',
  text: string,
  policy: Parameters<typeof classifierRequest>[1],
  knownLimitIds: ReadonlySet<string>,
): Promise<ClassifierVerdict> {
  const result = await paidCall(state, purpose, 1, classifierRequest(text, policy))
  if (!result.ok) throw new TurnFailure('classifier', { purpose, failure: result.kind })
  const verdict = readVerdict(result.content, text, knownLimitIds)
  if (!verdict) throw new TurnFailure('classifier', { purpose, failure: 'unreadable' })
  return verdict
}

async function finish(
  state: TurnState,
  status: 'succeeded' | 'failed' | 'rejected',
  outcome: string,
  counts: boolean,
  content: { fanMessage: string; response: Record<string, unknown> } | null,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const at = state.deps.now()
  const statements = [
    state.env.DB.prepare(
      `UPDATE ai_request SET status = ?, outcome = ?, counts_toward_limit = ?, attempts = ?, fallback_used = ?, detail_json = ?, finished_at = ?
        WHERE id = ? AND status = 'pending'`,
    ).bind(status, outcome, counts ? 1 : 0, state.attempts, state.fallbackUsed ? 1 : 0, JSON.stringify({ ...state.detail, ...extra }), at.toISOString(), state.requestId),
  ]
  if (content) {
    const expires = new Date(at.getTime() + state.config.retentionDays * 86_400_000).toISOString()
    statements.push(
      state.env.DB.prepare(
        `INSERT INTO ai_turn_content (ai_request_id, fan_message, model_output_json, response_json, created_at, expires_at)
         VALUES (?, ?, NULL, ?, ?, ?)`,
      ).bind(state.requestId, content.fanMessage, JSON.stringify(content.response), at.toISOString(), expires),
    )
  }
  await state.env.DB.batch(statements)
}

/** Why AI can't run for this fan and creator right now, or null when it can. */
async function availabilityOf(env: Env, deps: Deps, fan: FanIdentity, creatorId: string, config: AiConfig): Promise<string | null> {
  if (env.AI_ENABLED !== 'true' || !deps.ai) return 'off'
  const creator = await env.DB.prepare(`SELECT ai_enabled FROM creator WHERE id = ? AND status = 'active'`).bind(creatorId).first<{ ai_enabled: number }>()
  if (creator?.ai_enabled !== 1) return 'off'
  if (await aiDisabledFor(env, fan.fanId)) return 'restricted'
  if (config.globalCeilingMicroUsd <= 0 || config.creatorCeilingMicroUsd <= 0) return 'budget'
  return null
}

async function countedTurns(env: Env, draftId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_request WHERE draft_id = ? AND counts_toward_limit = 1').bind(draftId).first<{ n: number }>()
  return row?.n ?? 0
}

async function checkRates(env: Env, deps: Deps, fanId: string, creatorId: string, config: AiConfig): Promise<void> {
  const since = new Date(deps.now().getTime() - 3_600_000).toISOString()
  const row = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM ai_request WHERE fan_id = ?1 AND created_at > ?3) AS fan,
            (SELECT COUNT(*) FROM ai_request WHERE creator_id = ?2 AND created_at > ?3) AS creator`,
  )
    .bind(fanId, creatorId, since)
    .first<{ fan: number; creator: number }>()
  if ((row?.fan ?? 0) >= config.fanTurnsPerHour || (row?.creator ?? 0) >= config.creatorTurnsPerHour) {
    throw new ApiError(429, 'ai_rate_limited')
  }
}

async function verifiedPartners(env: Env, creatorId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT display_name FROM performer
      WHERE creator_id = ? AND kind = 'partner' AND age_verified = 1 AND consent_record_id IS NOT NULL ORDER BY display_name`,
  )
    .bind(creatorId)
    .all<{ display_name: string }>()
  return results.map((r) => r.display_name)
}

/** The fan's earlier messages to the Director on this draft, within the retention period. */
async function earlierMessages(env: Env, draftId: string, now: Date): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT t.fan_message FROM ai_request r JOIN ai_turn_content t ON t.ai_request_id = r.id
      WHERE r.draft_id = ? AND t.expires_at > ? ORDER BY r.created_at DESC LIMIT 5`,
  )
    .bind(draftId, now.toISOString())
    .all<{ fan_message: string }>()
  return results.map((r) => r.fan_message).reverse()
}

async function earlierDecisions(env: Env, draftId: string): Promise<{ title: string; status: 'accepted' | 'declined' }[]> {
  const { results } = await env.DB.prepare(
    `SELECT selections_json, status FROM ai_suggestion WHERE draft_id = ? AND status IN ('accepted', 'declined') ORDER BY decided_at DESC LIMIT 4`,
  )
    .bind(draftId)
    .all<{ selections_json: string; status: 'accepted' | 'declined' }>()
  return results.reverse().map((r) => ({ title: String((JSON.parse(r.selections_json) as { title?: string }).title ?? ''), status: r.status }))
}

/* ---------------------- Accepting or declining ---------------------------- */

interface SuggestionRow {
  id: string
  draft_id: string
  base_revision: number
  selections_json: string
  flags_json: string
  status: string
}

async function loadSuggestion(env: Env, fan: FanIdentity, draftId: string, suggestionId: string): Promise<SuggestionRow> {
  if (!UUID.test(suggestionId)) throw new ApiError(404, 'not_found')
  const s = await env.DB.prepare(
    'SELECT id, draft_id, base_revision, selections_json, flags_json, status FROM ai_suggestion WHERE id = ? AND draft_id = ? AND fan_id = ?',
  )
    .bind(suggestionId, draftId, fan.fanId)
    .first<SuggestionRow>()
  if (!s) throw new ApiError(404, 'not_found')
  return s
}

/**
 * POST …/director/suggestions/:id/accept. The stored, server-built selections
 * are checked again against the draft as it is now, through the same checks
 * as any save. If the draft moved on since the suggestion was made, it is out
 * of date (design 17 C) and never applied.
 */
export async function acceptSuggestion(
  request: Request,
  env: Env,
  deps: Deps,
  fan: FanIdentity,
  creatorId: string,
  draftId: string,
  suggestionId: string,
): Promise<Response> {
  const row = await requireOwned(env, fan, creatorId, draftId)
  const s = await loadSuggestion(env, fan, draftId, suggestionId)
  const body = await readJsonBody(request, 1_024)
  assertOnlyKeys(body, ['expectedRevision'], 'invalid_request')
  if (!Number.isInteger(body.expectedRevision)) throw new ApiError(400, 'invalid_request', { field: 'expectedRevision' })
  if (s.status !== 'offered') throw new ApiError(409, 'suggestion_already_decided', { status: s.status })
  const at = deps.now().toISOString()
  if (s.base_revision !== row.revision || body.expectedRevision !== row.revision) {
    await env.DB.prepare(`UPDATE ai_suggestion SET status = 'out_of_date', decided_at = ? WHERE id = ? AND status = 'offered'`).bind(at, s.id).run()
    throw new ApiError(409, 'suggestion_out_of_date', { current: draftOf(row) })
  }
  const version = await loadVersion(env, creatorId, row.catalog_version_id)
  if (!version || version.currentVersionId !== version.id) {
    throw new ApiError(409, 'catalog_version_stale', { currentCatalogVersionId: version?.currentVersionId ?? null })
  }
  const stored = JSON.parse(s.selections_json) as { selections: Selection[] }
  const content: DraftContent = { ...(JSON.parse(row.content_json) as DraftContent), selections: stored.selections }
  const gate = await gateFor(env, creatorId)
  const flags = await checkContent(request, env, deps, fan, version, creatorId, draftId, content, gate)
  const prior = row.boundary_flags_json ? (JSON.parse(row.boundary_flags_json) as BoundaryFlag[]).filter((f) => f.source === 'suggestion') : []
  const merged = uniqueBy([...flags, ...prior, ...(JSON.parse(s.flags_json) as BoundaryFlag[])], (f) => JSON.stringify(f))

  // Claim the suggestion first: a decline racing this accept wins or loses as a
  // whole, and the draft changes only if the claim succeeded (one transaction).
  const results = await env.DB.batch([
    env.DB.prepare(`UPDATE ai_suggestion SET status = 'accepted', decided_at = ? WHERE id = ? AND status = 'offered'`).bind(at, s.id),
    env.DB.prepare(
      `UPDATE draft SET content_json = ?, boundary_flags_json = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND fan_id = ? AND creator_id = ? AND revision = ? AND changes() = 1`,
    ).bind(JSON.stringify(content), JSON.stringify(merged), at, draftId, fan.fanId, creatorId, row.revision),
    // The draft moved on in between: give the claim back, marked out of date.
    env.DB.prepare(`UPDATE ai_suggestion SET status = 'out_of_date' WHERE id = ? AND status = 'accepted' AND changes() = 0 AND decided_at = ?`).bind(s.id, at),
  ])
  const updated = (await requireOwned(env, fan, creatorId, draftId))
  if ((results[0].meta.changes ?? 0) !== 1) throw new ApiError(409, 'suggestion_already_decided', { current: draftOf(updated) })
  if ((results[1].meta.changes ?? 0) !== 1) throw new ApiError(409, 'suggestion_out_of_date', { current: draftOf(updated) })
  return present(env, updated)
}

/** POST …/director/suggestions/:id/decline: "not added" (design 17 C). */
export async function declineSuggestion(env: Env, deps: Deps, fan: FanIdentity, creatorId: string, draftId: string, suggestionId: string): Promise<Response> {
  await requireOwned(env, fan, creatorId, draftId)
  const s = await loadSuggestion(env, fan, draftId, suggestionId)
  if (s.status !== 'offered') throw new ApiError(409, 'suggestion_already_decided', { status: s.status })
  await env.DB.prepare(`UPDATE ai_suggestion SET status = 'declined', decided_at = ? WHERE id = ? AND status = 'offered'`).bind(deps.now().toISOString(), s.id).run()
  return json(200, { id: s.id, status: 'declined' })
}
