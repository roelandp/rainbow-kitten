import type { Screen } from '../app'
import { audio } from '../audio/audio'
import { unlockSpeech } from '../audio/speech'
import type { Direction } from '../engine/types'
import { DAY_GOAL } from '../game/rules'
import { formatTime, h, ICONS, onTap } from './dom'
import { katjaDom } from './katjaDom'

const SLEEP_AFTER_MS = 20 * 60 * 60 * 1000

export function directionSwitch(value: Direction, onChange: (d: Direction) => void): HTMLElement {
  const opt = (d: Direction, label: string) => {
    const b = h('button.seg', { type: 'button', 'aria-pressed': String(value === d) }, label)
    onTap(b, () => {
      if (value === d) return
      value = d
      wrap.querySelectorAll('.seg').forEach((x) => x.setAttribute('aria-pressed', 'false'))
      b.setAttribute('aria-pressed', 'true')
      audio.tap()
      onChange(d)
    })
    return b
  }
  const wrap = h('div.direction', { role: 'group', 'aria-label': 'Richting' }, opt('nl-en', 'Nederlands → Engels'), opt('en-nl', 'Engels → Nederlands'))
  return wrap
}

export const menuScreen: Screen = (app, root) => {
  const s = app.session
  const p = s.profile
  audio.setMusic('music2')

  const asleep = p.lastRoundAt !== null && Date.now() - p.lastRoundAt > SLEEP_AFTER_MS
  const worn = p.worn.filter((id) => p.found.includes(id))

  const stage = h('div.menu-katja')
  const bubble = h('div.menu-bubble')
  const setKatja = (pose: string) => {
    stage.replaceChildren(katjaDom(pose, pose === 'beg' ? worn : [], `pose-${pose}`))
  }
  if (asleep) {
    setKatja('sleep')
    bubble.textContent = 'Katja heeft geslapen. Tik om haar wakker te maken.'
    let woken = false
    onTap(stage, () => {
      if (woken) return
      woken = true
      setKatja('wake')
      bubble.textContent = 'Goedemorgen, Katja!'
      void audio.catSound('meow')
      // Waking her counts as seeing her today, so she doesn't fall asleep again right away.
      p.lastRoundAt = Date.now() - SLEEP_AFTER_MS + 60 * 60 * 1000
      s.persist()
      setTimeout(() => {
        setKatja('beg')
        bubble.textContent = ''
        bubble.hidden = true
      }, 1300)
    })
  } else {
    setKatja('beg')
    bubble.hidden = true
  }

  const today = s.roundsToday()
  const paws = h('div.paws', { 'aria-label': `Vandaag ${today} van ${DAY_GOAL} rondes` })
  for (let i = 0; i < Math.max(DAY_GOAL, today); i++) {
    paws.append(h('span.paw', { class: i < today ? 'done' : '', html: ICONS.paw }))
  }

  const stat = (value: string, label: string) => h('div.stat', {}, h('b', {}, value), h('span', {}, label))
  const stats = h(
    'div.stats',
    {},
    stat(String(p.height), 'sprongen hoog'),
    stat(p.bestRoundMs ? formatTime(p.bestRoundMs) : '–', 'ronderecord'),
    stat(String(s.daysPlayed()), s.daysPlayed() === 1 ? 'dag gespeeld' : 'dagen gespeeld'),
  )

  const play = h('button.btn.btn-play', { type: 'button' }, 'Speel')
  onTap(play, () => {
    audio.unlock()
    unlockSpeech()
    app.go('game')
  })
  const small = (label: string, to: 'woordkaart' | 'verzameling' | 'instellingen') => {
    const b = h('button.btn.btn-small', { type: 'button' }, label)
    onTap(b, () => {
      audio.tap()
      app.go(to)
    })
    return b
  }

  root.append(
    h(
      'div.screen.menu',
      {},
      h('div.menu-bg', { style: "background-image:url('./bg/title.webp'), linear-gradient(#fbe3c4, #e9b7d9)" }),
      h(
        'div.menu-top',
        {},
        h('h1.title', {}, h('span.t1', {}, 'Rainbow'), h('span.t2', {}, 'Kitten')),
        paws,
        h('div.paws-label', {}, today >= DAY_GOAL ? 'Dagdoel gehaald!' : `Vandaag: ${today} van ${DAY_GOAL} rondes`),
      ),
      h('div.menu-stage', {}, bubble, stage),
      h(
        'div.menu-panel',
        {},
        stats,
        directionSwitch(s.direction, (d) => {
          p.settings.direction = d
          s.reload()
          s.persist()
        }),
        play,
        h('div.menu-row', {}, small('Woordkaart', 'woordkaart'), small('Verzameling', 'verzameling'), small('Instellingen', 'instellingen')),
        h('div.version', {}, `versie ${__COMMIT__}`),
      ),
    ),
  )
}
