import { Theme, Word } from '../engine/types'

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'woord'
  )
}

/** Parses `nl;en` lines. Empty lines and lines without both parts are skipped. */
export function parseImport(text: string): { nl: string; en: string }[] {
  const out: { nl: string; en: string }[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const i = line.indexOf(';')
    if (i < 0) continue
    const nl = line.slice(0, i).trim()
    const en = line.slice(i + 1).trim()
    if (nl && en) out.push({ nl, en })
  }
  return out
}

/** Adds parsed words to a theme. Words already present (same en and nl) are skipped. Returns added count. */
export function addToTheme(theme: Theme, pairs: { nl: string; en: string }[]): number {
  let added = 0
  const ids = new Set(theme.words.map((w) => w.id))
  for (const p of pairs) {
    const dup = theme.words.some(
      (w) => w.en.toLowerCase() === p.en.toLowerCase() && w.nl.toLowerCase() === p.nl.toLowerCase(),
    )
    if (dup) continue
    let id = slug(p.en)
    let n = 2
    while (ids.has(id)) id = `${slug(p.en)}-${n++}`
    ids.add(id)
    const w: Word = { id, nl: p.nl, en: p.en, image: null }
    theme.words.push(w)
    added++
  }
  return added
}

export function newTheme(title: string, existingIds: string[]): Theme {
  let id = slug(title)
  let n = 2
  while (existingIds.includes(id)) id = `${slug(title)}-${n++}`
  return { id, title: title.trim() || 'Mijn woorden', words: [] }
}
