import { describe, expect, it } from 'vitest'
import { seededRng } from '../src/engine/rng'
import { GameSession } from '../src/game/session'
import { defaultSave, load, migrate, save, STORAGE_KEY } from '../src/storage/storage'

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('storage', () => {
  it('broken or missing data starts fresh with the wyne profile', () => {
    expect(migrate(null).profiles.wyne).toBeDefined()
    expect(migrate({ hello: 1 }).activeProfile).toBe('wyne')
    const st = memory()
    st.setItem(STORAGE_KEY, '{not json')
    expect(load(st).schemaVersion).toBe(1)
  })

  it('fills in new fields for older saves', () => {
    const d = migrate({ schemaVersion: 1, activeProfile: 'wyne', profiles: { wyne: { height: 42, settings: { direction: 'en-nl' } } } })
    expect(d.profiles.wyne.height).toBe(42)
    expect(d.profiles.wyne.settings.direction).toBe('en-nl')
    expect(d.profiles.wyne.settings.music).toBe(true)
    expect(d.profiles.wyne.found).toEqual([])
  })

  it('round trips', () => {
    const st = memory()
    const d = defaultSave()
    d.profiles.wyne.height = 7
    save(d, st)
    expect(load(st).profiles.wyne.height).toBe(7)
  })
})

describe('session', () => {
  it('a full round: height grows by 30, items found, confetti on the 2nd round of the day', () => {
    let now = new Date(2026, 8, 24, 16, 0).getTime()
    const s = new GameSession(defaultSave(), seededRng(1), () => now)
    s.persist = () => undefined
    for (let round = 0; round < 2; round++) {
      s.startRound()
      let guard = 0
      while (!s.roundDone && guard++ < 500) {
        const t = s.nextTurn()
        if (t.kind === 'learn') s.learned(t)
        else s.answer(t, t.word, 2500)
        now += 3000
      }
      const r = s.finishRound()
      expect(r.jumps).toBe(30)
      expect(r.confetti).toBe(round === 1)
    }
    expect(s.profile.height).toBe(60)
    expect(s.profile.found).toEqual(['cape', 'mouse-toy', 'crown', 'party-hat', 'bow'])
    // Next day: first round is not confetti again.
    now = new Date(2026, 8, 25, 0, 0, 5).getTime()
    s.startRound()
    while (!s.roundDone) {
      const t = s.nextTurn()
      if (t.kind === 'learn') s.learned(t)
      else s.answer(t, t.word, 2500)
    }
    expect(s.finishRound().confetti).toBe(false)
  })

  it('a wrong answer does not make a jump', () => {
    const s = new GameSession(defaultSave(), seededRng(2), () => 0)
    s.persist = () => undefined
    s.startRound()
    let t = s.nextTurn()
    while (t.kind === 'learn') {
      s.learned(t)
      t = s.nextTurn()
    }
    const wrong = s.theme.words.find((w) => w.id !== t.word.id)!
    const res = s.answer(t, wrong, 1000)
    expect(res.correct).toBe(false)
    expect(res.jump).toBeNull()
    expect(s.round!.jumps).toBe(0)
  })
})
