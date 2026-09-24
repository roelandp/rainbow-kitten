import type { Direction, StatsMap, Theme } from '../engine/types'
import type { ItemId } from '../game/rules'

export const STORAGE_KEY = 'rainbowkitten.v1'
export const SCHEMA_VERSION = 1

export interface Settings {
  direction: Direction
  themeId: string
  sound: boolean
  music: boolean
  catSounds: boolean
}

export interface Profile {
  settings: Settings
  /** Stats per theme id, then per item key (`wordId:dir`). */
  stats: Record<string, StatsMap>
  /** Themes added through import, and words imported into built-in themes. */
  customThemes: Theme[]
  extraWords: Record<string, Theme['words']>
  /** Cumulative height in jumps. */
  height: number
  roundsByDay: Record<string, number>
  bestRoundMs: number | null
  lastRoundAt: number | null
  totalRounds: number
  found: ItemId[]
  worn: ItemId[]
}

export interface SaveData {
  schemaVersion: number
  activeProfile: string
  profiles: Record<string, Profile>
}

export function defaultProfile(): Profile {
  return {
    settings: { direction: 'nl-en', themeId: 'family-tree', sound: true, music: true, catSounds: true },
    stats: {},
    customThemes: [],
    extraWords: {},
    height: 0,
    roundsByDay: {},
    bestRoundMs: null,
    lastRoundAt: null,
    totalRounds: 0,
    found: [],
    worn: [],
  }
}

export function defaultSave(): SaveData {
  return { schemaVersion: SCHEMA_VERSION, activeProfile: 'wyne', profiles: { wyne: defaultProfile() } }
}

/** Brings any stored blob up to the current schema. Unknown or broken data starts fresh. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave()
  const data = raw as Partial<SaveData>
  if (typeof data.schemaVersion !== 'number' || !data.profiles) return defaultSave()
  // Version 1 is current. Future versions add steps here.
  const out: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    activeProfile: data.activeProfile ?? 'wyne',
    profiles: {},
  }
  for (const [id, p] of Object.entries(data.profiles)) {
    const base = defaultProfile()
    out.profiles[id] = { ...base, ...p, settings: { ...base.settings, ...(p?.settings ?? {}) } }
  }
  if (!out.profiles[out.activeProfile]) out.profiles[out.activeProfile] = defaultProfile()
  return out
}

export function load(storage: Pick<Storage, 'getItem'> | null = safeStorage()): SaveData {
  try {
    const s = storage?.getItem(STORAGE_KEY)
    return migrate(s ? JSON.parse(s) : null)
  } catch {
    return defaultSave()
  }
}

export function save(data: SaveData, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked: the game keeps working for this session.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
