import { randInt, Rng } from '../engine/rng'

export const ROUND_JUMPS = 30
export const DAY_GOAL = 2

export type ItemId = 'cape' | 'mouse-toy' | 'crown' | 'party-hat' | 'bow'
export const ITEM_ORDER: ItemId[] = ['cape', 'mouse-toy', 'crown', 'party-hat', 'bow']
export const ITEM_AT: Record<number, ItemId> = { 5: 'cape', 10: 'mouse-toy', 15: 'crown', 20: 'party-hat', 25: 'bow' }
export const ITEM_JUMP: Record<ItemId, number> = { cape: 5, 'mouse-toy': 10, crown: 15, 'party-hat': 20, bow: 25 }
export const ITEM_NAME: Record<ItemId, string> = {
  cape: 'Cape',
  'mouse-toy': 'Speelgoedmuis',
  crown: 'Kroon',
  'party-hat': 'Feesthoed',
  bow: 'Strikje',
}

export type Side = 'left' | 'right'

export interface RoundPlan {
  /** side[j] = wall Katja hangs on after jump j (j = 0 is the start). side[30] is the finale. */
  side: Side[]
  /** Jumps that cross to the opposite wall. */
  cross: Set<number>
}

/** Plans the walls for a round: a cross jump every 3 to 5 jumps (random). The 30th jump is the finale. */
export function planRound(rng: Rng, startSide: Side = 'left'): RoundPlan {
  const side: Side[] = [startSide]
  const cross = new Set<number>()
  let next = randInt(rng, 3, 5)
  for (let j = 1; j <= ROUND_JUMPS; j++) {
    let s = side[j - 1]
    if (j < ROUND_JUMPS && j === next) {
      cross.add(j)
      s = s === 'left' ? 'right' : 'left'
      next = j + randInt(rng, 3, 5)
    }
    side.push(s)
  }
  return { side, cross }
}

export type JumpKind = 'jump' | 'crossJump' | 'finale'

export interface JumpEvent {
  kind: JumpKind
  /** Jumps this round after this one. */
  jumps: number
  side: Side
  item: ItemId | null
}

/** Counts jumps within a round. Only correct answers make a jump. */
export class RoundCounter {
  jumps = 0
  constructor(public plan: RoundPlan) {}

  get done(): boolean {
    return this.jumps >= ROUND_JUMPS
  }

  correct(): JumpEvent | null {
    if (this.done) return null
    this.jumps += 1
    const j = this.jumps
    const kind: JumpKind = j === ROUND_JUMPS ? 'finale' : this.plan.cross.has(j) ? 'crossJump' : 'jump'
    return { kind, jumps: j, side: this.plan.side[j], item: ITEM_AT[j] ?? null }
  }

  wrong(): null {
    return null
  }

  itemsSoFar(): ItemId[] {
    return ITEM_ORDER.filter((id) => ITEM_JUMP[id] <= this.jumps)
  }
}

/** Local calendar day, so the day changes at local midnight. */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Finale type for the round that is being finished. `roundsBefore` = rounds already finished today. */
export function finaleIsConfetti(roundsBefore: number): boolean {
  return roundsBefore >= 1
}

export interface Zone {
  id: 'woonkamer' | 'zolder' | 'dak' | 'wolken' | 'ruimte'
  title: string
  from: number
  to: number
  texture: string
}

export const ZONES: Zone[] = [
  { id: 'woonkamer', title: 'Woonkamer', from: 0, to: 60, texture: 'wallpaper' },
  { id: 'zolder', title: 'Zolder', from: 60, to: 180, texture: 'wood' },
  { id: 'dak', title: 'Dak', from: 180, to: 360, texture: 'brick' },
  { id: 'wolken', title: 'Wolken', from: 360, to: 600, texture: 'cloud' },
  { id: 'ruimte', title: 'Ruimte', from: 600, to: Infinity, texture: 'metal' },
]

export const ZONE_FADE = 5

export function zoneIndexAt(height: number): number {
  for (let i = ZONES.length - 1; i >= 0; i--) if (height >= ZONES[i].from) return i
  return 0
}

export function zoneAt(height: number): Zone {
  return ZONES[zoneIndexAt(height)]
}

/** Crossfade between zones over 5 jumps: previous zone index, current zone index, mix 0..1. */
export function zoneBlend(height: number): { from: number; to: number; mix: number } {
  const i = zoneIndexAt(height)
  if (i === 0) return { from: 0, to: 0, mix: 1 }
  const t = (height - ZONES[i].from) / ZONE_FADE
  return t >= 1 ? { from: i, to: i, mix: 1 } : { from: i - 1, to: i, mix: Math.max(0, t) }
}
