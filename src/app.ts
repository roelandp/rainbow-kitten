import { audio } from './audio/audio'
import { seededRng } from './engine/rng'
import { GameSession } from './game/session'
import type { SceneAssets } from './scene/assets'
import type { ClimbScene } from './scene/climbScene'
import { load } from './storage/storage'

export type ScreenName = 'menu' | 'game' | 'woordkaart' | 'verzameling' | 'instellingen'

/** A screen renders into the root element and returns a cleanup function. */
export type Screen = (app: App, root: HTMLElement) => (() => void) | void

export class App {
  readonly session: GameSession
  private screens = new Map<ScreenName, Screen>()
  private cleanup: (() => void) | null = null
  current: ScreenName | null = null
  /** Scene and its assets survive screen changes (loading WebGL twice is slow on iPhone). */
  scene: ClimbScene | null = null
  sceneAssets: SceneAssets | null = null
  /** Set when a newer deploy was found; applied when back on the start screen. */
  updatePending = false

  constructor(readonly root: HTMLElement) {
    this.session = new GameSession(load(), seededRng((Date.now() ^ (Math.random() * 1e9)) >>> 0))
    this.applyAudioSettings()
  }

  register(name: ScreenName, screen: Screen): void {
    this.screens.set(name, screen)
  }

  go(name: ScreenName): void {
    if (name === 'menu' && this.updatePending) {
      location.reload()
      return
    }
    this.cleanup?.()
    this.cleanup = null
    this.root.replaceChildren()
    this.root.dataset.screen = name
    this.current = name
    const screen = this.screens.get(name)
    if (!screen) return
    this.cleanup = screen(this, this.root) ?? null
  }

  applyAudioSettings(): void {
    const s = this.session.profile.settings
    audio.setOptions({ sound: s.sound, music: s.music, catSounds: s.catSounds })
  }
}
