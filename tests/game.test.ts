import { describe, expect, it } from 'vitest'
import { seededRng } from '../src/engine/rng'
import { addToTheme, parseImport } from '../src/game/importWords'
import {
  dayKey,
  finaleIsConfetti,
  ITEM_AT,
  planRound,
  RoundCounter,
  ROUND_JUMPS,
  zoneAt,
  zoneBlend,
} from '../src/game/rules'

describe('round', () => {
  it('wrong answers do not count as a jump', () => {
    const r = new RoundCounter(planRound(seededRng(1)))
    r.correct()
    r.wrong()
    r.wrong()
    r.correct()
    expect(r.jumps).toBe(2)
  })

  it('cross jump every 3 to 5 jumps', () => {
    for (let seed = 1; seed < 200; seed++) {
      const plan = planRound(seededRng(seed))
      const cross = [...plan.cross].sort((a, b) => a - b)
      expect(cross[0]).toBeGreaterThanOrEqual(3)
      expect(cross[0]).toBeLessThanOrEqual(5)
      for (let i = 1; i < cross.length; i++) {
        const gap = cross[i] - cross[i - 1]
        expect(gap).toBeGreaterThanOrEqual(3)
        expect(gap).toBeLessThanOrEqual(5)
      }
      // Sides flip exactly at cross jumps.
      for (let j = 1; j < ROUND_JUMPS; j++) {
        expect(plan.side[j] !== plan.side[j - 1]).toBe(plan.cross.has(j))
      }
    }
  })

  it('items unlock at 5, 10, 15, 20, 25 and the finale at 30', () => {
    const r = new RoundCounter(planRound(seededRng(4)))
    const got: Record<number, string> = {}
    let finale = 0
    for (let i = 0; i < 40; i++) {
      const e = r.correct()
      if (!e) break
      if (e.item) got[e.jumps] = e.item
      if (e.kind === 'finale') finale = e.jumps
    }
    expect(got).toEqual({ 5: 'cape', 10: 'mouse-toy', 15: 'crown', 20: 'party-hat', 25: 'bow' })
    expect(ITEM_AT[30]).toBeUndefined()
    expect(finale).toBe(30)
    expect(r.done).toBe(true)
    expect(r.correct()).toBeNull()
  })

  it('confetti only from the 2nd round of the day', () => {
    expect(finaleIsConfetti(0)).toBe(false)
    expect(finaleIsConfetti(1)).toBe(true)
    expect(finaleIsConfetti(4)).toBe(true)
  })

  it('day changes at local midnight', () => {
    expect(dayKey(new Date(2026, 8, 24, 23, 59, 59))).toBe('2026-09-24')
    expect(dayKey(new Date(2026, 8, 25, 0, 0, 1))).toBe('2026-09-25')
  })
})

describe('height and zones', () => {
  it('zone borders', () => {
    expect(zoneAt(0).id).toBe('woonkamer')
    expect(zoneAt(59).id).toBe('woonkamer')
    expect(zoneAt(60).id).toBe('zolder')
    expect(zoneAt(179).id).toBe('zolder')
    expect(zoneAt(180).id).toBe('dak')
    expect(zoneAt(360).id).toBe('wolken')
    expect(zoneAt(599).id).toBe('wolken')
    expect(zoneAt(600).id).toBe('ruimte')
    expect(zoneAt(100000).id).toBe('ruimte')
  })

  it('height is cumulative over rounds', () => {
    let height = 0
    for (let round = 0; round < 3; round++) {
      const r = new RoundCounter(planRound(seededRng(round)))
      while (!r.done) r.correct()
      height += r.jumps
    }
    expect(height).toBe(90)
    expect(zoneAt(height).id).toBe('zolder')
  })

  it('crossfade over 5 jumps', () => {
    expect(zoneBlend(60)).toEqual({ from: 0, to: 1, mix: 0 })
    expect(zoneBlend(62).mix).toBeCloseTo(0.4)
    expect(zoneBlend(65)).toEqual({ from: 1, to: 1, mix: 1 })
  })
})

describe('import', () => {
  it('parses nl;en lines', () => {
    const p = parseImport('moeder;mother\n\n  vader ; father \nkapot\n;x\nzus;sister')
    expect(p).toEqual([
      { nl: 'moeder', en: 'mother' },
      { nl: 'vader', en: 'father' },
      { nl: 'zus', en: 'sister' },
    ])
  })

  it('adds to a theme without duplicates and with unique ids', () => {
    const t = { id: 'x', title: 'X', words: [{ id: 'mother', nl: 'moeder', en: 'mother', image: null }] }
    const n = addToTheme(t, parseImport('moeder;mother\nmama;mother\nhond;dog'))
    expect(n).toBe(2)
    expect(t.words.map((w) => w.id)).toEqual(['mother', 'mother-2', 'dog'])
  })
})
