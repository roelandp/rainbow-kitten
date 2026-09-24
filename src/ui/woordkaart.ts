import type { Screen } from '../app'
import { audio } from '../audio/audio'
import { speak } from '../audio/speech'
import { Direction, emptyStats, itemKey, Status } from '../engine/types'
import { h, ICONS, onTap } from './dom'

export const STATUS_LABEL: Record<Status, string> = {
  nieuw: 'nieuw',
  oefenen: 'oefenen',
  snel: 'snel',
  geautomatiseerd: 'kan ik!',
}

export function backButton(onBack: () => void): HTMLElement {
  const b = h('button.icon-btn.back', { type: 'button', 'aria-label': 'Terug', html: ICONS.back })
  onTap(b, () => {
    audio.tap()
    onBack()
  })
  return b
}

export const woordkaartScreen: Screen = (app, root) => {
  const s = app.session
  const theme = s.theme
  let dir: Direction = s.direction
  const stats = s.profile.stats[theme.id] ?? {}

  const grid = h('div.word-grid')
  const detail = h('div.sheet', { hidden: true })

  const toggle = h('div.direction.small')
  const renderToggle = () => {
    toggle.replaceChildren(
      ...(['nl-en', 'en-nl'] as Direction[]).map((d) => {
        const b = h('button.seg', { type: 'button', 'aria-pressed': String(d === dir) }, d === 'nl-en' ? 'NL → EN' : 'EN → NL')
        onTap(b, () => {
          dir = d
          renderToggle()
          renderGrid()
        })
        return b
      }),
    )
  }

  const renderGrid = () => {
    grid.replaceChildren(
      ...theme.words.map((w) => {
        const st = stats[itemKey(w.id, dir)] ?? emptyStats()
        const tile = h(
          'button.word-tile',
          { type: 'button', class: `st-${st.status}` },
          h('span.w-main', {}, dir === 'nl-en' ? w.nl : w.en),
          h('span.w-sub', {}, dir === 'nl-en' ? w.en : w.nl),
        )
        onTap(tile, () => {
          speak(w.en)
          const rt = st.rtEma === null ? '–' : `${(st.rtEma / 1000).toFixed(1)} sec`
          const say = h('button.icon-btn.speak', { type: 'button', 'aria-label': 'Uitspraak', html: ICONS.speaker })
          onTap(say, () => speak(w.en))
          const close = h('button.btn.btn-small', { type: 'button' }, 'Sluiten')
          onTap(close, () => (detail.hidden = true))
          detail.replaceChildren(
            h(
              'div.sheet-card',
              {},
              h('div.d-nl', {}, w.nl),
              h('div.d-en', {}, w.en, say),
              h('div.d-status', { class: `st-${st.status}` }, STATUS_LABEL[st.status]),
              h(
                'div.d-stats',
                {},
                h('div', {}, h('b', {}, String(st.correct)), h('span', {}, 'goed')),
                h('div', {}, h('b', {}, String(st.wrong)), h('span', {}, 'fout')),
                h('div', {}, h('b', {}, rt), h('span', {}, 'gemiddelde tijd')),
              ),
              close,
            ),
          )
          detail.hidden = false
        })
        return tile
      }),
    )
  }
  onTap(detail, (e) => {
    if (e.target === detail) detail.hidden = true
  })

  renderToggle()
  renderGrid()
  const legend = h(
    'div.legend',
    {},
    ...(['nieuw', 'oefenen', 'snel', 'geautomatiseerd'] as Status[]).map((st) => h('span', { class: `st-${st}` }, STATUS_LABEL[st])),
  )
  root.append(
    h(
      'div.screen.page',
      {},
      h('header.page-head', {}, backButton(() => app.go('menu')), h('h2', {}, 'Woordkaart'), h('span.page-sub', {}, theme.title)),
      h('div.page-body', {}, toggle, legend, grid),
      detail,
    ),
  )
}
