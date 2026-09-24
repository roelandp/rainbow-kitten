import { describe, expect, it } from 'vitest'
import data from '../src/content/words.json'

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
