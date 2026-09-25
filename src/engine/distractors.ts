import { Rng, shuffle } from './rng'
import { Direction, Status, Word } from './types'

/** The text shown on an answer button for this word and direction. */
export function answerText(word: Word, dir: Direction): string {
  return dir === 'nl-en' ? word.en : word.nl
}

export function promptText(word: Word, dir: Direction): string {
  return dir === 'nl-en' ? word.nl : word.en
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function firstLetter(s: string): string {
  return norm(s).replace(/[^a-zà-ɏ]/g, '').charAt(0)
}

/**
 * Two wrong options from the same theme. Never equal to the answer.
 * While the word is still new or being practiced, prefer options with another first letter.
 */
export function pickDistractors(
  answer: Word,
  themeWords: Word[],
  dir: Direction,
  status: Status,
  rng: Rng,
  count = 2,
): Word[] {
  const target = norm(answerText(answer, dir))
  const seen = new Set<string>([target])
  const pool: Word[] = []
  // Mixed themes: words get word options, sentences get sentence options.
  const sameGroup = answer.group ? themeWords.filter((w) => w.group === answer.group) : themeWords
  const source = sameGroup.length >= count + 1 ? sameGroup : themeWords
  for (const w of shuffle(source, rng)) {
    if (w.id === answer.id) continue
    const t = norm(answerText(w, dir))
    if (seen.has(t)) continue
    seen.add(t)
    pool.push(w)
  }
  const preferOtherLetter = status === 'nieuw' || status === 'oefenen'
  if (preferOtherLetter) {
    const letter = firstLetter(answerText(answer, dir))
    const other = pool.filter((w) => firstLetter(answerText(w, dir)) !== letter)
    const same = pool.filter((w) => firstLetter(answerText(w, dir)) === letter)
    return [...other, ...same].slice(0, count)
  }
  return pool.slice(0, count)
}

/** Answer plus distractors in random order. */
export function buildOptions(
  answer: Word,
  themeWords: Word[],
  dir: Direction,
  status: Status,
  rng: Rng,
): Word[] {
  return shuffle([answer, ...pickDistractors(answer, themeWords, dir, status, rng)], rng)
}
