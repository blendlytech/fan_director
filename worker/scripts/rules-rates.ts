// Prints the rules layer's block and allow rates on the §5.3.3 test sets, per
// key, for the gate report. Run from worker/: node scripts/rules-rates.ts
import { HARD_LIST_KEYS } from '../../shared/domain/hardList.ts'
import { checkText, checkTexts, RULESET_VERSION } from '../src/rules/check.ts'
import { MUST_ALLOW, MUST_BLOCK } from '../test/fixtures/hardlist.ts'

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`

console.log(`Ruleset ${RULESET_VERSION}`)
let caught = 0
for (const key of HARD_LIST_KEYS) {
  const cases = MUST_BLOCK.filter((c) => c.key === key)
  const hits = cases.filter((c) => (c.messages ? checkTexts(c.messages) : checkText(c.text!)).hardList?.key === key).length
  caught += hits
  console.log(`  ${key.padEnd(22)} ${hits}/${cases.length}`)
}
const allowed = MUST_ALLOW.filter((t) => checkText(t).hardList === null).length
console.log(`Must-block: ${caught}/${MUST_BLOCK.length} blocked under the right key (${pct(caught, MUST_BLOCK.length)})`)
console.log(`Must-allow: ${allowed}/${MUST_ALLOW.length} allowed (${pct(allowed, MUST_ALLOW.length)}); false blocks: ${MUST_ALLOW.length - allowed}`)
