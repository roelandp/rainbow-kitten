export type Direction = 'nl-en' | 'en-nl'

export type Status = 'nieuw' | 'oefenen' | 'snel' | 'geautomatiseerd'

export interface Word {
  id: string
  nl: string
  en: string
  image: string | null
}

export interface Theme {
  id: string
  title: string
  words: Word[]
}

export interface ItemStats {
  seen: number
  correct: number
  wrong: number
  /** Exponential moving average of reaction time in ms, correct answers only. */
  rtEma: number | null
  streakFast: number
  /** Local day keys (YYYY-MM-DD) with at least one fast correct answer. */
  fastDays: string[]
  lastSeen: number
  /** Most recent results, newest last, max 4. */
  recent: boolean[]
  status: Status
}

export type StatsMap = Record<string, ItemStats>

export const FAST_MS = 4000
export const SLOW_MS = 6000
export const RT_ALPHA = 0.4

export function itemKey(wordId: string, dir: Direction): string {
  return `${wordId}:${dir}`
}

export function pairKeyOf(key: string): string {
  const i = key.lastIndexOf(':')
  return i < 0 ? key : key.slice(0, i)
}

export function otherDirection(dir: Direction): Direction {
  return dir === 'nl-en' ? 'en-nl' : 'nl-en'
}

export function emptyStats(): ItemStats {
  return {
    seen: 0,
    correct: 0,
    wrong: 0,
    rtEma: null,
    streakFast: 0,
    fastDays: [],
    lastSeen: 0,
    recent: [],
    status: 'nieuw',
  }
}
