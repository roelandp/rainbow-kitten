import type { App, Screen } from '../app'
import { audio } from '../audio/audio'
import { speak } from '../audio/speech'
import { answerText, promptText } from '../engine/distractors'
import type { Turn } from '../engine/engine'
import type { Word } from '../engine/types'
import { ROUND_JUMPS, Zone } from '../game/rules'
import type { RoundResult } from '../game/session'
import { loadSceneAssets } from '../scene/assets'
import { ClimbScene } from '../scene/climbScene'
import { formatTime, h, ICONS, onTap } from './dom'

const ZONE_TEXT: Record<string, string> = {
  woonkamer: 'Katja is in de woonkamer!',
  zolder: 'Katja is op de zolder!',
  dak: 'Katja is op het dak!',
  wolken: 'Katja is in de wolken!',
  ruimte: 'Katja is in de ruimte!',
}

/** Font size class for long words and sentences. */
function sizeClass(text: string): string {
  if (text.length > 26) return 'len-xl'
  if (text.length > 16) return 'len-l'
  if (text.length > 10) return 'len-m'
  return ''
}

async function ensureScene(app: App, container: HTMLElement): Promise<ClimbScene> {
  if (!app.sceneAssets) app.sceneAssets = await loadSceneAssets()
  if (!app.scene) app.scene = new ClimbScene(container, app.sceneAssets)
  else app.scene.attach(container)
  return app.scene
}

export const gameScreen: Screen = (app, root) => {
  const s = app.session
  const dir = s.direction
  audio.setMusic('music1')

  const sceneBox = h('div.game-scene')
  const counterNum = h('b', {}, '0')
  const counter = h('div.counter', { 'aria-live': 'polite' }, counterNum, h('span', {}, `/${ROUND_JUMPS}`))
  const home = h('button.icon-btn.home', { type: 'button', 'aria-label': 'Naar het begin', html: ICONS.home })
  const toast = h('div.toast', { hidden: true })
  const loading = h('div.loading', {}, 'Katja maakt zich klaar...')
  sceneBox.append(loading, counter, home, toast)

  const card = h('div.card')
  const options = h('div.options')
  const panel = h('div.game-panel', {}, card, options)
  root.append(h('div.screen.game', {}, sceneBox, panel))

  let scene: ClimbScene | null = null
  let alive = true
  let turn: Turn | null = null
  let shownAt = 0
  let state: 'idle' | 'question' | 'retap' | 'learn' | 'done' = 'idle'
  let lastPurr = 0
  let learnSpeech: Promise<void> = Promise.resolve()
  const timers: number[] = []
  const later = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(() => alive && fn(), ms))
  }

  onTap(home, () => {
    audio.tap()
    app.go('menu')
  })

  const ro = new ResizeObserver(() => scene?.resize())
  ro.observe(sceneBox)

  const showToast = (text: string, ms = 1800) => {
    toast.textContent = text
    toast.hidden = false
    toast.classList.remove('show')
    void toast.offsetWidth
    toast.classList.add('show')
    if (ms > 0) later(ms, () => (toast.hidden = true))
  }

  /** Next turn after `ms`, but never while the answer is still being read out (max 5 sec). */
  const nextAfter = (ms: number, speech: Promise<void>) => {
    const cap = new Promise<void>((r) => setTimeout(r, 5000))
    const min = new Promise<void>((r) => setTimeout(r, ms))
    void Promise.all([min, Promise.race([speech, cap])]).then(() => {
      if (alive) nextTurn()
    })
  }

  const speakerBtn = (text: string) => {
    const b = h('button.icon-btn.speak', { type: 'button', 'aria-label': 'Nog een keer horen', html: ICONS.speaker })
    onTap(b, () => speak(text))
    return b
  }

  // ---------- turns ----------

  const nextTurn = () => {
    if (!alive) return
    turn = s.nextTurn()
    // Read by the automated play-through check (scripts/check.mjs).
    ;(window as unknown as { __rkTurn: Turn }).__rkTurn = turn
    if (turn.kind === 'learn') showLearn(turn)
    else showQuestion(turn)
  }

  const showQuestion = (t: Turn) => {
    state = 'question'
    const prompt = promptText(t.word, dir)
    card.className = 'card'
    card.replaceChildren(
      h('div.prompt', { class: sizeClass(prompt), lang: dir === 'nl-en' ? 'nl' : 'en' }, prompt),
      ...(dir === 'en-nl' ? [speakerBtn(t.word.en)] : []),
    )
    options.className = 'options'
    options.replaceChildren(
      ...t.options.map((w) => {
        const text = answerText(w, dir)
        const b = h('button.opt', { type: 'button', class: sizeClass(text), lang: dir === 'nl-en' ? 'en' : 'nl' }, text)
        b.dataset.id = w.id
        onTap(b, () => onAnswer(w, b))
        return b
      }),
    )
    if (dir === 'en-nl') speak(t.word.en)
    shownAt = performance.now()
  }

  const showLearn = (t: Turn) => {
    state = 'learn'
    card.className = 'card learn'
    card.replaceChildren(
      h('div.learn-label', {}, 'Nieuw woord'),
      h('div.learn-pair', {}, h('div.learn-nl', { class: sizeClass(t.word.nl), lang: 'nl' }, t.word.nl), h('div.learn-en', { class: sizeClass(t.word.en), lang: 'en' }, t.word.en)),
      speakerBtn(t.word.en),
    )
    const text = answerText(t.word, dir)
    const b = h('button.opt.learn-btn', { type: 'button', class: sizeClass(text) }, text)
    options.className = 'options single'
    options.replaceChildren(h('div.learn-hint', {}, 'Tik op het woord'), b)
    onTap(b, () => {
      if (state !== 'learn') return
      state = 'idle'
      b.classList.add('good')
      audio.tap()
      s.learned(t)
      nextAfter(450, learnSpeech)
    })
    learnSpeech = speak(t.word.en)
    void scene?.handle({ type: 'happy' })
    if (Date.now() - lastPurr > 8000) {
      lastPurr = Date.now()
      void audio.catSound('purr')
    }
  }

  const onAnswer = (w: Word, btn: HTMLButtonElement) => {
    if (!turn) return
    if (state === 'retap') {
      if (w.id !== turn.word.id) {
        btn.classList.remove('nudge')
        void btn.offsetWidth
        btn.classList.add('nudge')
        return
      }
      state = 'idle'
      btn.classList.remove('showme')
      btn.classList.add('good')
      nextAfter(650, dir === 'nl-en' ? speak(turn.word.en) : Promise.resolve())
      return
    }
    if (state !== 'question') return
    state = 'idle'
    const rt = performance.now() - shownAt
    const res = s.answer(turn, w, rt)
    if (!res.correct) {
      state = 'retap'
      audio.hm()
      void scene?.handle({ type: 'stay' })
      btn.classList.add('dim')
      for (const b of options.querySelectorAll<HTMLButtonElement>('.opt')) {
        if (b.dataset.id === turn.word.id) b.classList.add('showme')
        else b.classList.add('dim')
      }
      speak(turn.word.en)
      return
    }
    btn.classList.add('good')
    const spoken = dir === 'nl-en' ? speak(turn.word.en) : Promise.resolve()
    const jump = res.jump
    if (!jump || !scene) {
      nextAfter(600, spoken)
      return
    }
    counterNum.textContent = String(jump.jumps)
    counter.classList.remove('bump')
    void counter.offsetWidth
    counter.classList.add('bump')
    if (jump.kind === 'finale') {
      void finale()
      return
    }
    if (jump.kind === 'crossJump') audio.crossJump()
    else audio.jump()
    void scene.handle({ type: jump.kind, happy: res.fast })
    if (res.fast && Date.now() - lastPurr > 12000) {
      lastPurr = Date.now()
      later(420, () => void audio.catSound('purr'))
    }
    if (jump.item) {
      const id = jump.item
      void scene.handle({ type: 'itemReached', id })
      later(500, () => {
        audio.item()
        void audio.catSound('purr')
      })
    }
    if (res.zoneChanged) zoneChanged(res.zoneChanged)
    nextAfter(jump.item ? 1300 : 650, spoken)
  }

  const zoneChanged = (z: Zone) => {
    void scene?.handle({ type: 'zoneChanged', id: z.id })
    later(500, () => showToast(ZONE_TEXT[z.id] ?? z.title))
  }

  // ---------- finale and result ----------

  const finale = async () => {
    if (!scene) return
    state = 'done'
    const result = s.finishRound()
    card.replaceChildren(h('div.prompt.cheer', {}, 'Hoera!'))
    options.replaceChildren()
    audio.jump()
    const done = scene.handle({ type: 'finale', confetti: result.confetti })
    if (result.confetti) {
      later(900, () => {
        audio.fanfare()
        void audio.catSound('meow')
      })
    } else {
      later(900, () => audio.roundDone())
    }
    await done
    if (!alive) return
    if (result.confetti) {
      showToast('Katja is de confettikat!', 1500)
      await new Promise((r) => later(1400, () => r(null)))
      audio.slide()
      await scene.leapAway()
      if (!alive) return
      showToast(result.roundOfDay === 2 ? 'Katja is moe en tevreden. Morgen weer!' : 'Wat een confettikat! Katja is moe en tevreden.', 0)
    } else {
      showToast('Nog 1 ronde voor de confettikat!', 0)
    }
    later(900, () => showResult(result))
  }

  const showResult = (r: RoundResult) => {
    const words = r.attention.map((w) => {
      const b = h('button.attn', { type: 'button' }, h('span.nl', {}, w.nl), h('span.en', {}, w.en), h('span.ic', { html: ICONS.speaker }))
      onTap(b, () => speak(w.en))
      return b
    })
    const again = h('button.btn.btn-play', { type: 'button' }, 'Nog een ronde')
    onTap(again, () => {
      toast.hidden = true
      startRound()
    })
    const stop = h('button.btn.btn-small', { type: 'button' }, 'Naar het begin')
    onTap(stop, () => app.go('menu'))
    card.className = 'card result'
    card.replaceChildren(
      h(
        'div.result-stats',
        {},
        h('div.stat', {}, h('b', {}, String(r.jumps)), h('span', {}, 'sprongen')),
        h('div.stat', {}, h('b', {}, formatTime(r.ms)), h('span', {}, 'tijd')),
        h('div.stat', { class: r.isRecord ? 'record' : '' }, h('b', {}, formatTime(r.bestMs)), h('span', {}, r.isRecord ? 'nieuw record!' : 'record')),
      ),
      ...(words.length ? [h('div.attn-title', {}, 'Deze woorden nog even oefenen:'), h('div.attn-list', {}, ...words)] : []),
    )
    options.className = 'options result-actions'
    options.replaceChildren(again, stop)
  }

  const startRound = () => {
    if (!scene) return
    const r = s.startRound()
    scene.prepareRound(r.startHeight, r.plan.side, r.itemsAt)
    counterNum.textContent = '0'
    nextTurn()
  }

  // Scene can take a moment the first time.
  void ensureScene(app, sceneBox).then((sc) => {
    if (!alive) return
    scene = sc
    loading.remove()
    sc.resize()
    sc.start()
    startRound()
  })

  return () => {
    alive = false
    for (const t of timers) clearTimeout(t)
    ro.disconnect()
    scene?.stop()
  }
}
