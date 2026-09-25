import { describe, expect, it } from 'vitest'
import data from '../src/content/words.json'
import { seededRng } from '../src/engine/rng'
import { pickDistractors } from '../src/engine/distractors'
import { allThemes } from '../src/game/session'
import { defaultProfile } from '../src/storage/storage'

describe('words.json', () => {
  it('has the two lists from school with unique ids per theme', () => {
    expect(data.themes.map((t) => t.id)).toEqual(['family-tree', 'korte-zinnen'])
    expect(data.themes[0].words).toHaveLength(33)
    expect(data.themes[1].words).toHaveLength(22)
    for (const t of data.themes) {
      const ids = t.words.map((w) => w.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const w of t.words) {
        expect(w.nl.length).toBeGreaterThan(0)
        expect(w.en.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('mixed theme', () => {
  it('holds both lists, and options come from the same list', () => {
    const [mixed] = allThemes(defaultProfile())
    expect(mixed.id).toBe('alles')
    expect(mixed.words).toHaveLength(55)
    expect(new Set(mixed.words.map((w) => w.id)).size).toBe(55)
    const rng = seededRng(4)
    for (const w of mixed.words) {
      for (const d of pickDistractors(w, mixed.words, 'nl-en', 'snel', rng)) expect(d.group).toBe(w.group)
    }
  })
})
