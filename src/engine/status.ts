import { FAST_MS, ItemStats, RT_ALPHA, SLOW_MS, Status } from './types'

export function computeStatus(s: ItemStats): Status {
  if (s.seen === 0) return 'nieuw'
  const last = s.recent[s.recent.length - 1]
  if (last === false) return 'oefenen'
  if (s.streakFast >= 3 && s.fastDays.length >= 2) return 'geautomatiseerd'
  if (s.rtEma === null || s.rtEma > SLOW_MS) return 'oefenen'
  const lastTwo = s.recent.slice(-2)
  if (lastTwo.length === 2 && lastTwo.every(Boolean)) return 'snel'
  return 'oefenen'
}

/** Returns a new stats object with the answer applied. */
export function applyAnswer(
  prev: ItemStats,
  correct: boolean,
  rtMs: number,
  dayKey: string,
  now: number,
): ItemStats {
  const s: ItemStats = { ...prev, fastDays: prev.fastDays.slice(), recent: prev.recent.slice() }
  s.seen += 1
  s.lastSeen = now
  s.recent.push(correct)
  if (s.recent.length > 4) s.recent.shift()
  if (correct) {
    s.correct += 1
    s.rtEma = s.rtEma === null ? rtMs : RT_ALPHA * rtMs + (1 - RT_ALPHA) * s.rtEma
    if (rtMs < FAST_MS) {
      s.streakFast += 1
      if (!s.fastDays.includes(dayKey)) s.fastDays.push(dayKey)
    } else {
      s.streakFast = 0
    }
  } else {
    s.wrong += 1
    s.streakFast = 0
  }
  s.status = correct ? computeStatus(s) : 'oefenen'
  return s
}

/** A word was shown on a learn card: it is no longer new, but still needs practice. */
export function applyIntroduced(prev: ItemStats, now: number): ItemStats {
  const s: ItemStats = { ...prev, fastDays: prev.fastDays.slice(), recent: prev.recent.slice() }
  s.seen = Math.max(1, s.seen)
  s.lastSeen = now
  s.status = computeStatus(s)
  return s
}

/** The same word in the other direction was answered wrong: a light nudge back. */
export function applyPartnerWrong(prev: ItemStats): ItemStats {
  if (prev.seen === 0) return prev
  const s: ItemStats = { ...prev, fastDays: prev.fastDays.slice(), recent: prev.recent.slice() }
  s.streakFast = Math.max(0, s.streakFast - 1)
  s.status = computeStatus(s)
  return s
}
