import { describe, expect, it } from 'vitest'
import { pickDistractors, answerText } from '../src/engine/distractors'
import { WordEngine } from '../src/engine/engine'
import {
  inSafetyMode,
  newPickerState,
  pickNext,
  recordResult,
  startRound,
  MAX_NEW_PER_ROUND,
} from '../src/engine/picker'
import { seededRng } from '../src/engine/rng'
import { applyAnswer, applyIntroduced, computeStatus } from '../src/engine/status'
import { emptyStats, ItemStats, pairKeyOf, StatsMap, Theme } from '../src/engine/types'

const theme: Theme = {
  id: 't',
  title: 'Test',
  words: [
    ['moeder', 'mother'],
    ['vader', 'father'],
    ['zus', 'sister'],
    ['broer', 'brother'],
    ['oma', 'grandma'],
    ['opa', 'grandpa'],
    ['tante', 'aunt'],
    ['oom', 'uncle'],
    ['neef', 'cousin'],
    ['ouders', 'parents'],
    ['baby', 'baby'],
    ['familie', 'family'],
  ].map(([nl, en]) => ({ id: en, nl, en, image: null })),
}

function stat(p: Partial<ItemStats>): ItemStats {
  return { ...emptyStats(), ...p }
}

describe('status transitions', () => {
  it('starts as nieuw', () => {
    expect(computeStatus(emptyStats())).toBe('nieuw')
  })

  it('wrong always resets to oefenen', () => {
    let s = stat({ seen: 10, correct: 10, streakFast: 5, fastDays: ['a', 'b'], rtEma: 2000, recent: [true, true], status: 'geautomatiseerd' })
    s = applyAnswer(s, false, 1000, 'c', 1)
    expect(s.status).toBe('oefenen')
    expect(s.streakFast).toBe(0)
  })

  it('slow average stays oefenen', () => {
    let s = emptyStats()
    for (let i = 0; i < 4; i++) s = applyAnswer(s, true, 8000, 'd1', i)
    expect(s.rtEma).toBeGreaterThan(6000)
    expect(s.status).toBe('oefenen')
  })

  it('becomes snel with rtEma between 4 and 6 sec and last two correct', () => {
    let s = emptyStats()
    s = applyAnswer(s, true, 5000, 'd1', 1)
    expect(s.status).toBe('oefenen')
    s = applyAnswer(s, true, 5000, 'd1', 2)
    expect(s.status).toBe('snel')
  })

  it('rtEma uses alpha 0.4 on correct answers only', () => {
    let s = applyAnswer(emptyStats(), true, 5000, 'd', 1)
    s = applyAnswer(s, false, 100, 'd', 2)
    expect(s.rtEma).toBe(5000)
    s = applyAnswer(s, true, 3000, 'd', 3)
    expect(s.rtEma).toBeCloseTo(0.4 * 3000 + 0.6 * 5000)
  })

  it('geautomatiseerd needs 3 fast in a row on 2 different days', () => {
    let s = emptyStats()
    s = applyAnswer(s, true, 2000, 'day1', 1)
    s = applyAnswer(s, true, 2000, 'day1', 2)
    s = applyAnswer(s, true, 2000, 'day1', 3)
    expect(s.streakFast).toBe(3)
    expect(s.status).toBe('snel')
    s = applyAnswer(s, true, 2000, 'day2', 4)
    expect(s.status).toBe('geautomatiseerd')
  })

  it('a slow correct answer breaks the fast streak', () => {
    let s = emptyStats()
    s = applyAnswer(s, true, 2000, 'day1', 1)
    s = applyAnswer(s, true, 2000, 'day2', 2)
    s = applyAnswer(s, true, 4500, 'day2', 3)
    expect(s.streakFast).toBe(0)
  })

  it('learn card makes a word oefenen', () => {
    expect(applyIntroduced(emptyStats(), 1).status).toBe('oefenen')
  })
})

function allKnown(): StatsMap {
  const m: StatsMap = {}
  for (const w of theme.words) m[`${w.id}:nl-en`] = stat({ seen: 5, correct: 5, rtEma: 3000, recent: [true, true], status: 'snel', lastSeen: 0 })
  return m
}

describe('picker', () => {
  const keys = theme.words.map((w) => `${w.id}:nl-en`)

  it('a wrong word comes back within 3 turns', () => {
    for (let seed = 1; seed < 40; seed++) {
      const rng = seededRng(seed)
      const stats = allKnown()
      const st = newPickerState()
      const first = pickNext(st, keys, (k) => stats[k], rng, 0)
      recordResult(st, first.key, false)
      stats[first.key] = stat({ ...stats[first.key], status: 'oefenen' })
      const next = [1, 2, 3].map(() => pickNext(st, keys, (k) => stats[k], rng, 0).key)
      expect(next).toContain(first.key)
    }
  })

  it('learn card returns as a question after 2 and after 6 turns', () => {
    const rng = seededRng(7)
    const stats: StatsMap = allKnown()
    stats['mother:nl-en'] = emptyStats()
    const st = newPickerState()
    let learnTurn = -1
    const log: { turn: number; key: string; kind: string; reason: string }[] = []
    for (let i = 0; i < 40 && learnTurn < 0; i++) {
      const r = pickNext(st, keys, (k) => stats[k] ?? emptyStats(), rng, 0)
      if (r.kind === 'learn') {
        learnTurn = st.turn
        stats[r.key] = applyIntroduced(stats[r.key], 0)
        // keep it weak but not answered, so it only comes back through the schedule or by chance
      }
    }
    expect(learnTurn).toBeGreaterThan(0)
    for (let i = 0; i < 8; i++) {
      const r = pickNext(st, keys, (k) => stats[k] ?? emptyStats(), rng, 0)
      log.push({ turn: st.turn, key: r.key, kind: r.kind, reason: r.reason })
    }
    const returns = log.filter((l) => l.reason === 'learn-return' && l.key === 'mother:nl-en').map((l) => l.turn - learnTurn)
    expect(returns).toEqual([2, 6])
  })

  it('at most 3 new words per round', () => {
    const rng = seededRng(3)
    const stats: StatsMap = {}
    const st = newPickerState()
    let learns = 0
    for (let i = 0; i < 60; i++) {
      const r = pickNext(st, keys, (k) => stats[k] ?? emptyStats(), rng, i)
      if (r.kind === 'learn') {
        learns++
        stats[r.key] = applyIntroduced(stats[r.key] ?? emptyStats(), i)
      } else {
        stats[r.key] = applyAnswer(stats[r.key] ?? emptyStats(), true, 5000, 'd', i)
        recordResult(st, r.key, true)
      }
    }
    expect(learns).toBe(MAX_NEW_PER_ROUND)
    startRound(st)
    let more = 0
    for (let i = 0; i < 60; i++) {
      const r = pickNext(st, keys, (k) => stats[k] ?? emptyStats(), rng, i)
      if (r.kind === 'learn') {
        more++
        stats[r.key] = applyIntroduced(stats[r.key] ?? emptyStats(), i)
      }
    }
    expect(more).toBe(MAX_NEW_PER_ROUND)
  })

  it('safety net below 75% over the last 8 only picks known words', () => {
    const rng = seededRng(11)
    const stats: StatsMap = {}
    keys.forEach((k, i) => {
      stats[k] =
        i < 4
          ? stat({ seen: 5, correct: 5, rtEma: 3000, recent: [true, true], status: 'snel' })
          : stat({ seen: 3, correct: 0, wrong: 3, recent: [false], status: 'oefenen' })
    })
    const st = newPickerState()
    for (let i = 0; i < 8; i++) st.history.push(i < 5)
    expect(inSafetyMode(st)).toBe(true)
    for (let i = 0; i < 30; i++) {
      const r = pickNext(st, keys, (k) => stats[k], rng, 0)
      expect(['snel', 'geautomatiseerd']).toContain(stats[r.key].status)
    }
    // Back above 75%: weak words return.
    for (let i = 0; i < 8; i++) st.history.push(true)
    expect(inSafetyMode(st)).toBe(false)
    const picks = Array.from({ length: 30 }, () => pickNext(st, keys, (k) => stats[k], rng, 0).key)
    expect(picks.some((k) => stats[k].status === 'oefenen')).toBe(true)
  })

  it('70/30 split between weak and strong words over 1000 picks', () => {
    const rng = seededRng(42)
    const stats: StatsMap = {}
    keys.forEach((k, i) => {
      stats[k] =
        i % 2 === 0
          ? stat({ seen: 5, correct: 5, rtEma: 3000, recent: [true, true], status: 'snel' })
          : stat({ seen: 3, correct: 2, wrong: 1, rtEma: 7000, recent: [true], status: 'oefenen' })
    })
    const st = newPickerState()
    let weak = 0
    for (let i = 0; i < 1000; i++) {
      const r = pickNext(st, keys, (k) => stats[k], rng, 0)
      if (stats[r.key].status === 'oefenen') weak++
    }
    expect(weak / 1000).toBeGreaterThan(0.65)
    expect(weak / 1000).toBeLessThan(0.75)
  })

  it('never the same word twice in a row', () => {
    const rng = seededRng(5)
    const stats: StatsMap = {}
    const st = newPickerState()
    let prev = ''
    for (let i = 0; i < 500; i++) {
      const r = pickNext(st, keys, (k) => stats[k] ?? emptyStats(), rng, i)
      expect(pairKeyOf(r.key)).not.toBe(prev)
      prev = pairKeyOf(r.key)
      const correct = rng() < 0.6
      if (r.kind === 'learn') stats[r.key] = applyIntroduced(stats[r.key] ?? emptyStats(), i)
      else {
        stats[r.key] = applyAnswer(stats[r.key] ?? emptyStats(), correct, 3000, 'd', i)
        recordResult(st, r.key, correct)
      }
      if (i % 40 === 0) startRound(st)
    }
  })
})

describe('distractors', () => {
  it('come from the same theme and never equal the answer', () => {
    const rng = seededRng(9)
    for (const w of theme.words) {
      for (const dir of ['nl-en', 'en-nl'] as const) {
        for (let i = 0; i < 20; i++) {
          const d = pickDistractors(w, theme.words, dir, 'snel', rng)
          expect(d).toHaveLength(2)
          for (const x of d) {
            expect(theme.words).toContain(x)
            expect(answerText(x, dir).toLowerCase()).not.toBe(answerText(w, dir).toLowerCase())
          }
          expect(d[0].id).not.toBe(d[1].id)
        }
      }
    }
  })

  it('prefer another first letter while practicing', () => {
    const rng = seededRng(2)
    const w = theme.words.find((x) => x.id === 'grandma')!
    for (let i = 0; i < 20; i++) {
      const d = pickDistractors(w, theme.words, 'nl-en', 'oefenen', rng)
      for (const x of d) expect(x.en[0]).not.toBe('g')
    }
  })

  it('engine builds 3 options with the answer in it', () => {
    const e = new WordEngine(theme, 'nl-en', allKnown(), seededRng(1))
    for (let i = 0; i < 50; i++) {
      const t = e.next(0)
      expect(t.options).toHaveLength(3)
      expect(t.options).toContain(t.word)
      e.answer(t.key, true, 2000, 'd', 0)
    }
  })
})
