/**
 * Builds the demo fixtures and the verification manifest from a recorded run
 * (demo-recording.live.test.ts).
 *
 *   node test/live/demo-manifest.mjs <run-id>
 *
 * Writes, inside the git-ignored worker/.live-recordings/<run-id>/:
 *   fixtures/<case>.json   what the demo replays: fan-visible text, the script,
 *                          and per-turn provenance. No request bodies, ids or key.
 *   manifest.json          sha256 of every raw record file, of every raw
 *                          OpenRouter response a fixture quotes, and of each
 *                          fixture, so a fixture can be checked against the raw
 *                          record. It holds no conversation text, so it may be
 *                          committed.
 *
 * Nothing here rewrites model output: fixture text is copied from the record.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const runId = process.argv[2]
if (!runId || !/^[a-z0-9-]+$/.test(runId)) throw new Error('usage: node test/live/demo-manifest.mjs <run-id>')
const root = path.join(import.meta.dirname, '..', '..', '.live-recordings', runId)
const sha = (text) => createHash('sha256').update(text).digest('hex')
/** Canonical JSON: keys sorted, so the hash doesn't depend on key order. */
const canonical = (v) =>
  Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  : JSON.stringify(v)

// Manual review notes (doc 12 §6 check 2, done by reading the script): NOT model output.
const REVIEW = JSON.parse(readFileSync(path.join(root, 'review.json'), 'utf8'))
const CASES = JSON.parse(readFileSync(path.join(root, '_run', 'in-0.json'), 'utf8')).cases
const META = JSON.parse(readFileSync(path.join(root, 'cases.json'), 'utf8'))

const manifest = { runId, builtAt: new Date().toISOString(), cases: {} }
mkdirSync(path.join(root, 'fixtures'), { recursive: true })

for (const kase of CASES) {
  const dir = path.join(root, kase)
  const files = readdirSync(dir).filter((f) => /^out-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(4)) - parseInt(b.slice(4)))
  const raw = Object.fromEntries(files.map((f) => [f, sha(readFileSync(path.join(dir, f)))]))
  const records = files.map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')))
  const setup = records[0]
  const responses = []

  const callsOf = (r) =>
    (r.exchanges ?? []).map((e) => {
      const p = JSON.parse(e.responseText)
      const hash = sha(e.responseText)
      responses.push({ step: r.step, model: p.model, host: p.provider, generationId: p.id, sha256: hash })
      return {
        purpose: String(e.request.model).includes('safeguard') ? 'classifier' : 'generation',
        requestedModel: e.request.model, answeredModel: p.model, host: p.provider,
        startedAt: e.startedAt, finishedAt: e.finishedAt,
        inputTokens: p.usage?.prompt_tokens ?? null, outputTokens: p.usage?.completion_tokens ?? null, costUsd: p.usage?.cost ?? null,
        rawResponseSha256: hash,
      }
    })

  const steps = []
  for (const r of records.slice(1)) {
    const a = r.action
    if (a.type === 'message') {
      steps.push({ kind: 'fan_message', text: a.text })
      const f = r.fanVisible
      const common = { at: r.at, attempts: r.aiRequest?.attempts ?? null, fallbackUsed: r.aiRequest ? r.aiRequest.fallback_used === 1 : null, calls: callsOf(r) }
      if (r.httpStatus === 200) {
        steps.push({
          kind: 'director_reply',
          reply: f.reply,
          suggestions: f.suggestions.map((s) => ({ title: s.title, adds: s.adds, removes: s.removes, deltaCents: s.deltaCents, newTotalCents: s.newTotalCents, askFirst: s.askFirst })),
          footer: f.footer, notOffered: f.notOffered, customRequest: f.customRequest, clarifyingQuestion: f.clarifyingQuestion, repliesLeft: f.repliesLeft,
          provenance: common,
        })
      } else {
        steps.push({ kind: 'director_unavailable', httpStatus: r.httpStatus, error: f.error, reason: f.reason ?? null, repliesLeft: f.repliesLeft ?? null, provenance: common })
      }
    } else if (a.type === 'accept' || a.type === 'decline') {
      steps.push({ kind: 'fan_action', action: a.type, suggestion: a.suggestion, httpStatus: r.httpStatus, totalCentsAfter: r.draftAfter.quote?.total ?? null })
    } else if (a.type === 'edit') {
      const keys = Object.keys(a.draft)
      steps.push({
        kind: 'fan_action', action: 'edit', fields: keys, httpStatus: r.httpStatus,
        refused: r.httpStatus === 200 ? null : r.result?.error ?? 'error',
        customRequest: keys.includes('customRequest') ? a.draft.customRequest : undefined,
        totalCentsAfter: r.draftAfter.quote?.total ?? null,
      })
    } else if (a.type === 'script') {
      const s = r.script
      steps.push({
        kind: 'script',
        label: 'AI-assisted draft from a SYNTHETIC approved Scene Card. No creator reviewed or approved this request. Creator review required before filming.',
        promptVersion: s.promptVersion, style: a.style, assumptions: s.assumptions,
        sceneCard: s.syntheticApprovedSceneCard.sceneCard,
        script: s.script, checks: s.checks, review: REVIEW[kase] ?? [],
        provenance: { calls: callsOf(r) },
      })
    }
  }
  const last = records.at(-1).draftAfter
  const fixture = {
    schema: 'fds.recorded-demo/v1',
    caseId: kase,
    title: META[kase].title,
    summary: META[kase].summary,
    recordedOn: setup.at.slice(0, 10),
    notice: 'Recorded example. Every AI answer here is a real, unedited response recorded on this date and replayed. Nothing is sent or saved while you watch.',
    provenance: { ...setup.versions, adult: setup.adult, run: runId },
    start: { lookbook: setup.lookbook, fanDisplayName: setup.draftAfter.draft.fanDisplayName, quote: setup.draftAfter.quote },
    steps,
    final: { quote: last.quote, customRequest: last.draft.customRequest, fanDisplayName: last.draft.fanDisplayName },
  }
  const text = JSON.stringify(fixture, null, 2)
  writeFileSync(path.join(root, 'fixtures', `${kase}.json`), text)
  const gen = responses.filter((x) => !String(x.model).includes('safeguard'))
  manifest.cases[kase] = {
    rawRecordFiles: raw,
    openRouterResponses: responses,
    allGenerationsByPrimaryModel: gen.every((x) => x.model === 'qwen/qwen3-235b-a22b-2507'),
    fallbackUsed: steps.some((s) => s.provenance?.fallbackUsed === true),
    totalCostUsd: Number(steps.flatMap((s) => s.provenance?.calls ?? []).reduce((n, c) => n + (c.costUsd ?? 0), 0).toFixed(9)),
    fixtureSha256: sha(canonical(fixture)),
  }
}
writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2))
writeFileSync(path.join(root, 'RESULTS.md'), renderResults(CASES.map((k) => JSON.parse(readFileSync(path.join(root, 'fixtures', `${k}.json`), 'utf8')))))

/** RESULTS.md: the fixtures as a readable transcript for the owner. Copied text only, never reworded. */
function renderResults(fixtures) {
  const usd = (c) => (c == null ? '–' : `$${(c / 100).toFixed(2)}`)
  const out = [`# Recorded demo run: ${runId}`, '', 'Every fan message below is synthetic. Every Director reply and script is the real, unedited model output as the fan or creator would see it. Raw records: `<case>/out-N.json`.', '']
  for (const f of fixtures) {
    out.push(`## ${f.title} (${f.caseId})`, '', f.summary, '')
    out.push(`- Recorded on ${f.recordedOn}. Primary model ${f.provenance.primaryModel}; prompt ${f.provenance.prompt}; classifier ${f.provenance.classifier}; rules ${f.provenance.ruleset}.`)
    out.push(`- Adult content: ${f.provenance.adult}.`)
    out.push(`- Lookbook picks: ${Object.entries(f.start.lookbook).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')} (everything else: the creator's choice). Fan display name: ${f.start.fanDisplayName}.`)
    out.push(`- Starting draft: ${f.start.quote.minutes} min, ${usd(f.start.quote.total)}.`, '')
    let n = 0
    for (const s of f.steps) {
      if (s.kind === 'fan_message') out.push(`### ${++n}. Fan`, '', `> ${s.text}`, '')
      else if (s.kind === 'director_reply') {
        out.push('**AI Director** (what the fan saw)', '')
        if (s.reply) out.push(s.reply, '')
        for (const g of s.suggestions) {
          const adds = g.adds.map((a) => `${a.label}${a.qty > 1 ? ` ×${a.qty}` : ''}`).join(', ')
          const removes = g.removes.map((r) => r.label).join(', ')
          out.push(`- Suggestion: **${g.title}**. Adds ${adds || 'nothing'}${removes ? `; removes ${removes}` : ''}. ${g.deltaCents >= 0 ? '+' : '−'}${usd(Math.abs(g.deltaCents))} → ${usd(g.newTotalCents)}${g.askFirst.length ? `. Ask first: ${g.askFirst.map((a) => a.limit).join(', ')}` : ''}`)
        }
        if (s.customRequest) out.push(`- Custom request offered: "${s.customRequest.text}". ${s.customRequest.offer}`)
        if (s.clarifyingQuestion) out.push(`- Question: ${s.clarifyingQuestion}`)
        for (const x of s.notOffered) out.push(`- ${x.heading}: ${x.body}`)
        if (s.footer) out.push('', `_${s.footer}_`)
        const gen = s.provenance.calls.filter((c) => c.purpose === 'generation')
        out.push('', `<sub>${gen.map((c) => `${c.answeredModel} via ${c.host}, ${c.inputTokens}+${c.outputTokens} tokens, $${c.costUsd}`).join(' · ')}; attempts ${s.provenance.attempts}; fallback ${s.provenance.fallbackUsed ? 'YES' : 'no'}; with classifier: $${s.provenance.calls.reduce((t, c) => t + (c.costUsd ?? 0), 0).toFixed(6)}</sub>`, '')
      } else if (s.kind === 'director_unavailable') {
        const gen = s.provenance.calls.filter((c) => c.purpose === 'generation')
        out.push(`**AI Director: unavailable** (HTTP ${s.httpStatus}, ${s.error}${s.reason ? `, reason ${s.reason}` : ''}). The model answered ${gen.length} time(s) (${gen.map((c) => `${c.answeredModel} via ${c.host}`).join(', ')}); the server's checks rejected both answers, so the fan saw the unavailable state.`, '')
      } else if (s.kind === 'fan_action') {
        const what = s.action === 'edit' ? `changed ${s.fields.join(', ')} on their own screen${s.customRequest ? ` (custom request: "${s.customRequest}")` : ''}` : `${s.action === 'accept' ? 'accepted' : 'declined'} suggestion ${s.suggestion + 1}`
        out.push(`*Fan ${what}: ${s.httpStatus === 200 ? 'OK' : `refused by the server (${s.refused})`}. Total now ${usd(s.totalCentsAfter)}.*`, '')
      } else if (s.kind === 'script') {
        const sc = s.script
        out.push(`### Shooting script (creator only)`, '', `**${s.label}**`, '', `Prompt ${s.promptVersion}. Style: ${Object.values(s.style).join('; ')}.`, '')
        out.push('Assumptions:', ...s.assumptions.map((a) => `- ${a}`), '')
        out.push(`#### ${sc.title} (${sc.runtimeSeconds} s)`, '', `- Setting: ${sc.setup.setting}`, `- Wardrobe: ${sc.setup.wardrobe}`, `- Camera: ${sc.setup.camera}`, `- Props: ${sc.setup.props.join(', ') || 'none'}`, '')
        for (const b of sc.beats) {
          out.push(`**${b.startSecond} s** · _${b.camera}_`, '', b.action, '')
          for (const l of b.lines) out.push(`> **${l.speaker}${l.verbatimFromFan ? ' (fan\'s words)' : ''}:** ${l.text}`, '')
        }
        out.push('Production notes:', ...sc.productionNotes.map((x) => `- ${x}`), '')
        const ck = s.checks
        out.push(`Automated checks: contract ${ck.contract.length ? ck.contract.join('; ') : 'passed'}; hard-list rules ${ck.rulesHardList ? `HIT ${ck.rulesHardList.key}` : 'clear'}; classifier ${ck.classifier.verdict?.key ?? 'clear'}.`, '')
        if (s.review.length) out.push('Manual scope review (not AI output):', ...s.review.map((r) => `- **${r.severity}**${r.beat != null ? ` (beat ${r.beat} s)` : ''}: ${r.text}`), '')
        const c = s.provenance.calls.find((x) => x.purpose === 'generation')
        out.push(`<sub>${c.answeredModel} via ${c.host}, ${c.inputTokens}+${c.outputTokens} tokens, $${c.costUsd}, ${c.startedAt} → ${c.finishedAt}</sub>`, '')
      }
    }
    out.push(`**Final Scene Card:** ${f.final.quote.minutes} min, ${usd(f.final.quote.total)}. ${f.final.quote.lines.map((l) => `${l.label} ${usd(l.amount)}`).join(' · ')}`, '', '---', '')
  }
  return out.join('\n')
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest.cases).map(([k, v]) => [k, { files: Object.keys(v.rawRecordFiles).length, responses: v.openRouterResponses.length, primaryOnly: v.allGenerationsByPrimaryModel, fallback: v.fallbackUsed, cost: v.totalCostUsd, fixture: v.fixtureSha256.slice(0, 16) }]))))
