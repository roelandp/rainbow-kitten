import './style.css'
import { App } from './app'
import { audio } from './audio/audio'
import { initSpeech } from './audio/speech'
import { gameScreen } from './ui/game'
import { instellingenScreen } from './ui/instellingen'
import { loadSpriteMeta } from './ui/katjaDom'
import { menuScreen } from './ui/menu'
import { verzamelingScreen } from './ui/verzameling'
import { woordkaartScreen } from './ui/woordkaart'

/**
 * iOS standalone PWA: WebKit leaves the status bar out of innerHeight/100dvh, which leaves a gap
 * at the bottom. Fill the physical screen there (same fix as Kit Nugget), innerHeight elsewhere.
 */
function syncAppHeight(mount: HTMLElement): void {
  const nav = navigator as Navigator & { standalone?: boolean }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = Boolean(nav.standalone) || window.matchMedia('(display-mode: standalone)').matches
  const update = () => {
    let h = window.innerHeight
    if (isIOS && isStandalone) {
      const landscape = window.innerWidth > window.innerHeight
      h = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height)
      h = Math.max(h, window.innerHeight)
    }
    mount.style.height = `${h}px`
    document.documentElement.style.setProperty('--app-h', `${h}px`)
  }
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => setTimeout(update, 250))
}

/** Always run the newest deploy: fresh service worker, and a version check when the app comes back. */
function keepFresh(app: App): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      const check = async () => {
        void reg.update().catch(() => undefined)
        try {
          const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
          if (!r.ok) return
          const v = (await r.json()) as { commit: string }
          if (v.commit && v.commit !== __COMMIT__) applyUpdate()
        } catch {
          /* offline: keep playing */
        }
      }
      void check()
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void check()
      })
      window.addEventListener('focus', () => void check())
    })
    .catch(() => undefined)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) applyUpdate()
  })
  function applyUpdate(): void {
    // Never interrupt a round: reload right away on other screens, else when back at the start.
    if (app.current === 'game') app.updatePending = true
    else location.reload()
  }
}

async function boot(): Promise<void> {
  const mount = document.getElementById('app')
  if (!mount) return
  syncAppHeight(mount)
  document.addEventListener('gesturestart', (e) => e.preventDefault())
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false })
  audio.install()
  initSpeech()
  await loadSpriteMeta()
  const app = new App(mount)
  app.register('menu', menuScreen)
  app.register('game', gameScreen)
  app.register('woordkaart', woordkaartScreen)
  app.register('verzameling', verzamelingScreen)
  app.register('instellingen', instellingenScreen)
  app.go('menu')
  document.getElementById('splash')?.classList.add('gone')
  setTimeout(() => document.getElementById('splash')?.remove(), 400)
  keepFresh(app)
  ;(window as unknown as { __rk: App }).__rk = app
}

void boot()
