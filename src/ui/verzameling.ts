import type { Screen } from '../app'
import { audio } from '../audio/audio'
import { ITEM_JUMP, ITEM_NAME, ITEM_ORDER } from '../game/rules'
import { h, onTap } from './dom'
import { katjaDom } from './katjaDom'
import { backButton } from './woordkaart'

export const verzamelingScreen: Screen = (app, root) => {
  const s = app.session
  const p = s.profile
  const preview = h('div.collection-katja')
  const shelf = h('div.shelf')

  const render = () => {
    const worn = p.worn.filter((id) => p.found.includes(id))
    preview.replaceChildren(katjaDom('beg', worn))
    shelf.replaceChildren(
      ...ITEM_ORDER.map((id) => {
        const found = p.found.includes(id)
        const on = worn.includes(id)
        const slot = h(
          'button.shelf-item',
          { type: 'button', class: `${found ? 'found' : 'locked'} ${on ? 'on' : ''}`, 'aria-pressed': found ? String(on) : undefined },
          h('img', { src: `./items/${id}.webp`, alt: '', draggable: 'false' }),
          h('span.shelf-name', {}, found ? ITEM_NAME[id] : `bij sprong ${ITEM_JUMP[id]}`),
          found ? h('span.shelf-toggle', {}, on ? 'aan' : 'uit') : null,
        )
        if (found) {
          onTap(slot, () => {
            p.worn = on ? p.worn.filter((x) => x !== id) : [...p.worn, id]
            s.persist()
            audio.tap()
            render()
          })
        }
        return slot
      }),
    )
  }
  render()

  root.append(
    h(
      'div.screen.page.collection',
      {},
      h('header.page-head', {}, backButton(() => app.go('menu')), h('h2', {}, 'Verzameling')),
      h(
        'div.page-body',
        {},
        preview,
        h('p.hint', {}, p.found.length ? 'Tik op een ding om het aan of uit te doen.' : 'Klim hoog! Bij sprong 5 ligt het eerste cadeautje.'),
        shelf,
      ),
    ),
  )
}
