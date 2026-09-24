import builtIn from '../content/words.json'
import { WordEngine, Turn } from '../engine/engine'
import { Rng } from '../engine/rng'
import { Direction, StatsMap, Theme, Word, pairKeyOf } from '../engine/types'
import { Profile, SaveData, save } from '../storage/storage'
import {
  dayKey,
  finaleIsConfetti,
  ITEM_AT,
  ItemId,
  JumpEvent,
  planRound,
  RoundCounter,
  RoundPlan,
  zoneAt,
  Zone,
} from './rules'

export function allThemes(p: Profile): Theme[] {
  const base = (builtIn as { themes: Theme[] }).themes.map((t) => ({
    ...t,
    words: [...t.words, ...(p.extraWords[t.id] ?? [])],
  }))
  return [...base, ...p.customThemes]
}

export interface AnswerResult {
  correct: boolean
  jump: JumpEvent | null
  zoneChanged: Zone | null
  /** Correct and fast (under 4 sec): Katja looks happy. */
  fast: boolean
}

export interface RoundResult {
  jumps: number
  ms: number
  bestMs: number
  isRecord: boolean
  confetti: boolean
  roundOfDay: number
  attention: Word[]
}

/** One play session. Owns the engine for the chosen theme and direction, and the running round. */
export class GameSession {
  engine: WordEngine
  round: RoundCounter | null = null
  plan: RoundPlan | null = null
  roundStartedAt = 0
  roundStartHeight = 0

  constructor(
    public data: SaveData,
    private rng: Rng,
    private now: () => number = Date.now,
  ) {
    this.engine = this.makeEngine()
  }

  get profile(): Profile {
    return this.data.profiles[this.data.activeProfile]
  }

  get themes(): Theme[] {
    return allThemes(this.profile)
  }

  get theme(): Theme {
    const ts = this.themes
    return ts.find((t) => t.id === this.profile.settings.themeId) ?? ts[0]
  }

  get direction(): Direction {
    return this.profile.settings.direction
  }

  private makeEngine(): WordEngine {
    const p = this.profile
    const theme = this.theme
    p.stats[theme.id] = p.stats[theme.id] ?? {}
    return new WordEngine(theme, p.settings.direction, p.stats[theme.id] as StatsMap, this.rng)
  }

  /** Call after changing theme or direction in the settings. */
  reload(): void {
    this.engine = this.makeEngine()
  }

  persist(): void {
    save(this.data)
  }

  today(): string {
    return dayKey(new Date(this.now()))
  }

  roundsToday(): number {
    return this.profile.roundsByDay[this.today()] ?? 0
  }

  startRound(): { plan: RoundPlan; startHeight: number; itemsAt: Record<number, ItemId> } {
    // Theme or words may have changed (import): rebuild the engine for a fresh round.
    const keepPicker = this.engine.theme.id === this.theme.id && this.engine.dir === this.direction
    if (!keepPicker) this.reload()
    else this.engine.theme = this.theme
    this.engine.startRound()
    this.plan = planRound(this.rng, 'left')
    this.round = new RoundCounter(this.plan)
    this.roundStartedAt = this.now()
    this.roundStartHeight = this.profile.height
    return { plan: this.plan, startHeight: this.profile.height, itemsAt: { ...ITEM_AT } }
  }

  nextTurn(): Turn {
    return this.engine.next(this.now())
  }

  learned(turn: Turn): void {
    this.engine.learned(turn.key, this.now())
    this.persist()
  }

  /** First tap on a question. Only this tap counts for the stats. */
  answer(turn: Turn, chosen: Word, rtMs: number): AnswerResult {
    const correct = chosen.id === turn.word.id
    this.engine.answer(turn.key, correct, rtMs, this.today(), this.now())
    let jump: JumpEvent | null = null
    let zoneChanged: Zone | null = null
    if (correct && this.round) {
      const before = zoneAt(this.profile.height)
      jump = this.round.correct()
      if (jump) {
        this.profile.height += 1
        const after = zoneAt(this.profile.height)
        if (after.id !== before.id) zoneChanged = after
        if (jump.item && !this.profile.found.includes(jump.item)) {
          this.profile.found.push(jump.item)
          // A newly found item is worn on the start screen right away.
          if (!this.profile.worn.includes(jump.item)) this.profile.worn.push(jump.item)
        }
      }
    }
    this.persist()
    return { correct, jump, zoneChanged, fast: correct && rtMs < 4000 }
  }

  get roundDone(): boolean {
    return !!this.round?.done
  }

  /** Books the finished round. */
  finishRound(): RoundResult {
    const p = this.profile
    const ms = this.now() - this.roundStartedAt
    const today = this.today()
    const before = p.roundsByDay[today] ?? 0
    const confetti = finaleIsConfetti(before)
    p.roundsByDay[today] = before + 1
    p.totalRounds += 1
    p.lastRoundAt = this.now()
    const isRecord = p.bestRoundMs === null || ms < p.bestRoundMs
    if (isRecord) p.bestRoundMs = ms
    this.persist()
    const attention = this.engine
      .needsAttention(3)
      .map((k) => this.engine.theme.words.find((w) => w.id === pairKeyOf(k)))
      .filter((w): w is Word => !!w)
    return {
      jumps: this.round?.jumps ?? 0,
      ms,
      bestMs: p.bestRoundMs ?? ms,
      isRecord,
      confetti,
      roundOfDay: before + 1,
      attention,
    }
  }

  daysPlayed(): number {
    return Object.keys(this.profile.roundsByDay).length
  }
}
