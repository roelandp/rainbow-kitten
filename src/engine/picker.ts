import { Rng, weightedPick } from './rng'
import { ItemStats, pairKeyOf } from './types'

export type TurnKind = 'question' | 'learn'

export interface PickResult {
  key: string
  kind: TurnKind
  /** Why this item was chosen; handy for tests and debugging. */
  reason: 'retry' | 'learn-return' | 'new' | 'weak' | 'strong' | 'safety' | 'fallback'
}

export interface PickerState {
  turn: number
  newThisRound: number
  /** How many new words (learn cards) a round may bring. Setting, default 15. */
  maxNew: number
  /** Turn of the last learn card, to spread new words over the round. */
  lastNewTurn: number
  retries: { key: string; wait: number }[]
  learnReturns: { key: string; due: number }[]
  /** Results of the last questions, newest last. */
  history: boolean[]
  lastPairKey: string | null
}

export const DEFAULT_NEW_PER_ROUND = 15
export const NEW_PER_ROUND_OPTIONS = [3, 5, 10, 15, 20]
/**
 * While the quota is not used up, a new word comes whenever no retry or learn return is due
 * (at most one every NEW_SPACING turns). The returns after 2 and 6 turns spread them out by themselves.
 */
export const NEW_SPACING = 1
export const RETRY_WAIT = 2
export const LEARN_RETURNS = [2, 6]
export const SAFETY_WINDOW = 8
export const SAFETY_RATIO = 0.75
export const WEAK_SHARE = 0.7

export function newPickerState(maxNew = DEFAULT_NEW_PER_ROUND): PickerState {
  return { turn: 0, newThisRound: 0, maxNew, lastNewTurn: -99, retries: [], learnReturns: [], history: [], lastPairKey: null }
}

function isWeak(s: ItemStats): boolean {
  return s.status === 'nieuw' || s.status === 'oefenen'
}

export function inSafetyMode(state: PickerState): boolean {
  if (state.history.length < SAFETY_WINDOW) return false
  const last = state.history.slice(-SAFETY_WINDOW)
  return last.filter(Boolean).length / last.length < SAFETY_RATIO
}

/**
 * Picks the next item. Mutates `state` (turn counter, queues, new count).
 * `keys` are the item keys of the current theme and direction.
 */
export function pickNext(
  state: PickerState,
  keys: string[],
  stats: (key: string) => ItemStats,
  rng: Rng,
  now: number,
): PickResult {
  state.turn += 1
  for (const r of state.retries) r.wait = Math.max(0, r.wait - 1)
  const notLast = (k: string) => pairKeyOf(k) !== state.lastPairKey
  const done = (res: PickResult): PickResult => {
    state.lastPairKey = pairKeyOf(res.key)
    return res
  }

  // 1. A word answered wrong comes back soon.
  const retry = state.retries.find((r) => r.wait === 0 && notLast(r.key))
  if (retry) {
    state.retries = state.retries.filter((r) => r !== retry)
    state.learnReturns = state.learnReturns.filter((l) => !(l.key === retry.key && l.due <= state.turn))
    return done({ key: retry.key, kind: 'question', reason: 'retry' })
  }

  // 2. A learn card that is due to return as a question.
  const ret = state.learnReturns
    .filter((l) => l.due <= state.turn && notLast(l.key))
    .sort((a, b) => a.due - b.due)[0]
  if (ret) {
    state.learnReturns = state.learnReturns.filter((l) => l !== ret)
    return done({ key: ret.key, kind: 'question', reason: 'learn-return' })
  }

  const candidates = keys.filter(notLast)
  const pool = candidates.length > 0 ? candidates : keys
  const safety = inSafetyMode(state)

  // 5. Safety net: only words that are already known.
  if (safety) {
    const known = pool.filter((k) => !isWeak(stats(k)))
    const practiced = pool.filter((k) => stats(k).correct > 0)
    const set = known.length > 0 ? known : practiced
    const pick = weightedPick(set, (k) => 1 + (now - stats(k).lastSeen) / 60000, rng)
    if (pick) return done({ key: pick, kind: 'question', reason: 'safety' })
  }

  const canLearnNew = !safety && state.newThisRound < state.maxNew
  const learnNew = (pick: string): PickResult => {
    state.newThisRound += 1
    state.lastNewTurn = state.turn
    for (const d of LEARN_RETURNS) state.learnReturns.push({ key: pick, due: state.turn + d })
    return done({ key: pick, kind: 'learn', reason: 'new' })
  }

  // New words are spread over the round: one every few turns until the quota is reached.
  const fresh = pool.filter((k) => stats(k).status === 'nieuw')
  if (canLearnNew && fresh.length > 0 && state.turn - state.lastNewTurn >= NEW_SPACING) {
    return learnNew(fresh[Math.floor(rng() * fresh.length)])
  }
  // New words only arrive through the spaced step above (or the fallback when nothing else can be asked).
  const weak = pool.filter((k) => stats(k).status === 'oefenen')
  const strong = pool.filter((k) => !isWeak(stats(k)))

  // 3. 70% weak words, 30% strong words.
  const wantWeak = rng() < WEAK_SHARE
  const order: ('weak' | 'strong')[] = wantWeak ? ['weak', 'strong'] : ['strong', 'weak']
  for (const kind of order) {
    if (kind === 'weak' && weak.length > 0) {
      // Prefer practicing words that are in play over new ones; new ones only when few are in play.
      const pick = weightedPick(
        weak,
        (k) => {
          const s = stats(k)
          if (s.status === 'nieuw') return 1.5
          return 1 + (s.rtEma ?? 6000) / 1000 + 2 * s.wrong
        },
        rng,
      )!
      if (stats(pick).status === 'nieuw') return learnNew(pick)
      return done({ key: pick, kind: 'question', reason: 'weak' })
    }
    if (kind === 'strong' && strong.length > 0) {
      const pick = weightedPick(strong, (k) => 1 + (now - stats(k).lastSeen) / 60000, rng)!
      return done({ key: pick, kind: 'question', reason: 'strong' })
    }
  }

  // Nothing fits (for example: all words new and the new quota is used up). Ask a seen word, else anything.
  const seen = pool.filter((k) => stats(k).seen > 0)
  const set = seen.length > 0 ? seen : pool
  const pick = set[Math.floor(rng() * set.length)]
  if (stats(pick).status === 'nieuw') return learnNew(pick)
  return done({ key: pick, kind: 'question', reason: 'fallback' })
}

/** Records the first answer to a question. */
export function recordResult(state: PickerState, key: string, correct: boolean): void {
  state.history.push(correct)
  if (state.history.length > 50) state.history.shift()
  if (!correct && !state.retries.some((r) => r.key === key)) {
    state.retries.push({ key, wait: RETRY_WAIT })
  }
}

/** Starts a new round: new-word quota resets, queues survive. */
export function startRound(state: PickerState): void {
  state.newThisRound = 0
}
