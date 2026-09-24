import { buildOptions } from './distractors'
import { newPickerState, PickerState, pickNext, recordResult, startRound, TurnKind } from './picker'
import { Rng } from './rng'
import { applyAnswer, applyIntroduced, applyPartnerWrong } from './status'
import { Direction, emptyStats, ItemStats, itemKey, otherDirection, pairKeyOf, StatsMap, Theme, Word } from './types'

export interface Turn {
  key: string
  word: Word
  kind: TurnKind
  /** Answer options (includes the answer). One option on a learn card. */
  options: Word[]
}

/** Word engine for one theme. Stats are shared by reference with the caller (for saving). */
export class WordEngine {
  readonly picker: PickerState

  constructor(
    public theme: Theme,
    public dir: Direction,
    public stats: StatsMap,
    private rng: Rng,
    picker?: PickerState,
  ) {
    this.picker = picker ?? newPickerState()
  }

  get(key: string): ItemStats {
    return this.stats[key] ?? emptyStats()
  }

  keys(): string[] {
    return this.theme.words.map((w) => itemKey(w.id, this.dir))
  }

  wordOf(key: string): Word {
    const id = pairKeyOf(key)
    const w = this.theme.words.find((x) => x.id === id)
    if (!w) throw new Error(`unknown word ${id}`)
    return w
  }

  startRound(): void {
    startRound(this.picker)
  }

  next(now = Date.now()): Turn {
    const res = pickNext(this.picker, this.keys(), (k) => this.get(k), this.rng, now)
    const word = this.wordOf(res.key)
    const options =
      res.kind === 'learn'
        ? [word]
        : buildOptions(word, this.theme.words, this.dir, this.get(res.key).status, this.rng)
    return { key: res.key, word, kind: res.kind, options }
  }

  learned(key: string, now = Date.now()): void {
    this.stats[key] = applyIntroduced(this.get(key), now)
  }

  answer(key: string, correct: boolean, rtMs: number, dayKey: string, now = Date.now()): ItemStats {
    const s = applyAnswer(this.get(key), correct, rtMs, dayKey, now)
    this.stats[key] = s
    recordResult(this.picker, key, correct)
    if (!correct) {
      const partner = itemKey(pairKeyOf(key), otherDirection(this.dir))
      if (this.stats[partner]) this.stats[partner] = applyPartnerWrong(this.stats[partner])
    }
    return s
  }

  /** Seen words that need attention most, weakest first. */
  needsAttention(n: number, keys = this.keys()): string[] {
    const score = (k: string) => {
      const s = this.get(k)
      const statusW = { nieuw: 0, oefenen: 3, snel: 1, geautomatiseerd: 0 }[s.status]
      return statusW * 10 + s.wrong * 3 + (s.rtEma ?? 0) / 1000 - s.correct * 0.2
    }
    return keys
      .filter((k) => this.get(k).seen > 0)
      .sort((a, b) => score(b) - score(a))
      .slice(0, n)
  }
}
