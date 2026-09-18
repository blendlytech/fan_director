import type { Env } from '../types'
import { aiConfig } from './config'

/**
 * The scheduled clean-up (doc 11 §5.6 item 24):
 *
 * - raw AI conversation text (the fan's messages, the model's output and the
 *   served reply) is deleted once it passes `expires_at` (30 days by default);
 * - requests left pending by a crashed turn become 'failed', which frees the
 *   draft's one in-flight slot.
 *
 * ai_request, ai_call and ai_suggestion hold no fan wording and stay. Safety-
 * case evidence lives in its own append-only table and is never touched here.
 */
export async function purgeExpired(env: Env, now: Date): Promise<{ purged: number; abandoned: number }> {
  const at = now.toISOString()
  const staleBefore = new Date(now.getTime() - aiConfig(env).staleRequestMs).toISOString()
  const [purged, abandoned] = await env.DB.batch([
    env.DB.prepare('DELETE FROM ai_turn_content WHERE expires_at <= ?').bind(at),
    env.DB.prepare(
      `UPDATE ai_request SET status = 'failed', outcome = 'abandoned', finished_at = ? WHERE status = 'pending' AND created_at < ?`,
    ).bind(at, staleBefore),
  ])
  return { purged: purged.meta.changes ?? 0, abandoned: abandoned.meta.changes ?? 0 }
}
