import type { Env } from '../types'

/**
 * The Director's usage limits (doc 10 §6, doc 11 §8 Phase 3) as configuration.
 * Environment values override the defaults; anything unreadable falls back
 * to the safe side (no ceiling means no AI calls at all).
 */
export interface AiConfig {
  /** Environment ceiling in micro-dollars; 0 means no call can be reserved. */
  globalCeilingMicroUsd: number
  creatorCeilingMicroUsd: number
  retentionDays: number
  turnsPerDraft: number
  maxMessageChars: number
  fanTurnsPerHour: number
  creatorTurnsPerHour: number
  /** A pending request older than this is treated as failed. */
  staleRequestMs: number
}

export const AI_DEFAULTS = {
  retentionDays: 30,
  turnsPerDraft: 20,
  maxMessageChars: 2_000,
  fanTurnsPerHour: 30,
  creatorTurnsPerHour: 300,
  staleRequestMs: 120_000,
} as const

function nonNegInt(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback
  const n = Number(value.trim())
  return Number.isSafeInteger(n) ? n : fallback
}

export function aiConfig(env: Env): AiConfig {
  const globalCeilingMicroUsd = nonNegInt(env.AI_BUDGET_CEILING_MICROUSD, 0)
  return {
    globalCeilingMicroUsd,
    creatorCeilingMicroUsd: nonNegInt(env.AI_CREATOR_CEILING_MICROUSD, globalCeilingMicroUsd),
    retentionDays: Math.max(1, nonNegInt(env.AI_RAW_RETENTION_DAYS, AI_DEFAULTS.retentionDays)),
    turnsPerDraft: AI_DEFAULTS.turnsPerDraft,
    maxMessageChars: AI_DEFAULTS.maxMessageChars,
    fanTurnsPerHour: nonNegInt(env.AI_FAN_TURNS_PER_HOUR, AI_DEFAULTS.fanTurnsPerHour),
    creatorTurnsPerHour: nonNegInt(env.AI_CREATOR_TURNS_PER_HOUR, AI_DEFAULTS.creatorTurnsPerHour),
    staleRequestMs: AI_DEFAULTS.staleRequestMs,
  }
}
