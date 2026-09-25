import type { Screen } from '../app'
import { audio } from '../audio/audio'
import { addToTheme, newTheme, parseImport } from '../game/importWords'
import { NEW_PER_ROUND_OPTIONS } from '../engine/picker'
import { allThemes, MIXED_THEME_ID } from '../game/session'
import { defaultProfile } from '../storage/storage'
import { h, onTap } from './dom'
import { directionSwitch } from './menu'
import { backButton } from './woordkaart'

function toggleRow(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
  const sw = h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(value), 'aria-label': label }, h('span'))
  onTap(sw, () => {
    value = !value
    sw.setAttribute('aria-checked', String(value))
    onChange(value)
  })
  return h('div.set-row', {}, h('span', {}, label), sw)
}

export const instellingenScreen: Screen = (app, root) => {
  const s = app.session
  const p = s.profile
  const body = h('div.page-body')

  const render = () => {
    const themes = s.themes
    const themeList = h(
      'div.theme-list',
      {},
      ...themes.map((t) => {
        const b = h('button.theme-btn', { type: 'button', 'aria-pressed': String(t.id === s.theme.id) }, h('b', {}, t.title), h('span', {}, `${t.words.length} woorden`))
        onTap(b, () => {
          p.settings.themeId = t.id
          s.reload()
          s.persist()
          audio.tap()
          render()
        })
        return b
      }),
    )

    // Import
    const area = h('textarea.import-text', { rows: 5, placeholder: 'moeder;mother\nvader;father', spellcheck: 'false', autocapitalize: 'off' }) as HTMLTextAreaElement
    const importable = themes.filter((t) => t.id !== MIXED_THEME_ID)
    const target = h('select.import-target', {}, ...importable.map((t) => h('option', { value: t.id }, t.title)), h('option', { value: '__new' }, 'Nieuw thema...')) as HTMLSelectElement
    target.value = importable.some((t) => t.id === s.theme.id) ? s.theme.id : importable[0]?.id ?? '__new'
    const newName = h('input.import-name', { type: 'text', placeholder: 'Naam van het nieuwe thema', hidden: true }) as HTMLInputElement
    target.addEventListener('change', () => (newName.hidden = target.value !== '__new'))
    const msg = h('div.import-msg')
    const add = h('button.btn.btn-small', { type: 'button' }, 'Toevoegen')
    onTap(add, () => {
      const pairs = parseImport(area.value)
      if (pairs.length === 0) {
        msg.textContent = 'Geen woorden gevonden. Schrijf per regel: nederlands;engels'
        return
      }
      let themeId = target.value
      let added = 0
      if (themeId === '__new') {
        const t = newTheme(newName.value || 'Mijn woorden', allThemes(p).map((x) => x.id))
        added = addToTheme(t, pairs)
        p.customThemes.push(t)
        themeId = t.id
      } else {
        const custom = p.customThemes.find((t) => t.id === themeId)
        if (custom) added = addToTheme(custom, pairs)
        else {
          // Built-in theme: keep the extra words separately so words.json stays the source.
          const full = themes.find((t) => t.id === themeId)!
          const before = full.words.length
          const copy = { ...full, words: full.words.slice() }
          added = addToTheme(copy, pairs)
          p.extraWords[themeId] = [...(p.extraWords[themeId] ?? []), ...copy.words.slice(before)]
        }
      }
      if (p.settings.themeId !== MIXED_THEME_ID) p.settings.themeId = themeId
      s.reload()
      s.persist()
      area.value = ''
      render()
      body.querySelector('.import-msg')!.textContent = `${added} ${added === 1 ? 'woord' : 'woorden'} toegevoegd.`
    })

    // Reset with an in-app confirmation (no browser dialogs).
    const reset = h('button.btn.btn-small.btn-quiet', { type: 'button' }, 'Voortgang wissen')
    const confirmBox = h('div.confirm', { hidden: true })
    onTap(reset, () => {
      const yes = h('button.btn.btn-small', { type: 'button' }, 'Ja, alles wissen')
      const no = h('button.btn.btn-small.btn-quiet', { type: 'button' }, 'Nee')
      onTap(yes, () => {
        const keep = { settings: p.settings, customThemes: p.customThemes, extraWords: p.extraWords }
        s.data.profiles[s.data.activeProfile] = { ...defaultProfile(), ...keep }
        s.reload()
        s.persist()
        app.go('menu')
      })
      onTap(no, () => (confirmBox.hidden = true))
      confirmBox.replaceChildren(h('p', {}, 'Alle sprongen, records, gevonden dingen en woordstatus worden gewist. Zeker weten?'), h('div.confirm-row', {}, no, yes))
      confirmBox.hidden = false
    })

    const soundChanged = () => {
      app.applyAudioSettings()
      s.persist()
    }

    body.replaceChildren(
      h('section.set', {}, h('h3', {}, 'Thema'), themeList),
      h(
        'section.set',
        {},
        h('h3', {}, 'Richting'),
        directionSwitch(p.settings.direction, (d) => {
          p.settings.direction = d
          s.reload()
          s.persist()
        }),
      ),
      h(
        'section.set',
        {},
        h('h3', {}, 'Nieuwe woorden per ronde'),
        h('p.hint', {}, 'Zoveel nieuwe woorden leert Katja per ronde. Bij 15 heb je na 4 rondes alles gezien.'),
        h(
          'div.choice-row',
          {},
          ...NEW_PER_ROUND_OPTIONS.map((n) => {
            const b = h('button.choice', { type: 'button', 'aria-pressed': String(p.settings.newPerRound === n) }, String(n))
            onTap(b, () => {
              p.settings.newPerRound = n
              s.engine.picker.maxNew = n
              s.persist()
              audio.tap()
              render()
            })
            return b
          }),
        ),
      ),
      h(
        'section.set',
        {},
        h('h3', {}, 'Geluid'),
        toggleRow('Geluidjes', p.settings.sound, (v) => {
          p.settings.sound = v
          soundChanged()
        }),
        toggleRow('Muziek', p.settings.music, (v) => {
          p.settings.music = v
          soundChanged()
        }),
        toggleRow('Katja-geluiden', p.settings.catSounds, (v) => {
          p.settings.catSounds = v
          soundChanged()
        }),
      ),
      h('section.set', {}, h('h3', {}, 'Woorden toevoegen'), h('p.hint', {}, 'Per regel: nederlands;engels'), area, h('div.import-row', {}, target, add), newName, msg),
      h('section.set', {}, h('h3', {}, 'Voortgang'), reset, confirmBox),
      h('div.version', {}, `Rainbow Kitten, versie ${__COMMIT__} (${new Date(__BUILT_AT__).toLocaleString('nl-NL')})`),
    )
  }
  render()

  root.append(h('div.screen.page', {}, h('header.page-head', {}, backButton(() => app.go('menu')), h('h2', {}, 'Instellingen')), body))
}
