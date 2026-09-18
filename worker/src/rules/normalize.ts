/**
 * Text normalization for the hard-list rules layer (doc 11 §5.3.3). Rules
 * match the normalized form, so evasions like "T33N", "t e e n", "teeeen" or
 * look-alike letters from other alphabets read the same as the plain word.
 */

/** Look-alike letters from other scripts, mapped to the Latin letter they imitate. */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  і: 'i', ї: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', һ: 'h', ԛ: 'q', ԝ: 'w',
  // Greek
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
}

/** Digit and symbol substitutions, applied only inside words that also contain letters. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' }

/** Tokens that mix digits and letters legitimately: ordinals, "4k", "1080p", "16yo", "3pm". */
const KEEP_TOKEN = /^\d+(?:st|nd|rd|th|k|p|am|pm|s|x|yo|yrs?|min|mins|m|h|hr|hrs|d|ft|cm|kg|lbs?)$/

export interface NormalizedText {
  /** Lowercased, confusables mapped, accents removed; punctuation and symbols kept (for money, links, contacts). */
  raw: string
  /** Words only: apostrophes removed ("she's" → "shes"), leetspeak undone, spaced-out letters joined, long letter runs shortened. */
  norm: string
}

export function normalize(input: string): NormalizedText {
  const raw = input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[​-‍⁠﻿­]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x00-\x7f]/g, (ch) => CONFUSABLES[ch] ?? ch)
    .replace(/[‘’ʼ`´]/g, "'")

  const tokens = raw
    .replace(/'/g, '')
    .split(/\s+/)
    .map((token) => {
      const bare = token.replace(/^[^a-z0-9@$!]+|[^a-z0-9@$!]+$/g, '')
      if (/[a-z]/.test(bare) && /[0-9@$!]/.test(bare) && !KEEP_TOKEN.test(bare)) {
        return bare.replace(/[0-9@$!]/g, (ch) => LEET[ch] ?? ch)
      }
      return token
    })

  let norm = tokens
    .join(' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  // "t e e n" → "teen": four or more single characters separated by spaces.
  norm = norm.replace(/\b[a-z0-9](?: [a-z0-9]){3,}\b/g, (run) => run.replace(/ /g, ''))
  // "teeeen" → "teen": three or more of the same letter become two.
  norm = norm.replace(/([a-z])\1{2,}/g, '$1$1')

  return { raw, norm }
}
