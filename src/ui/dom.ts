type Attrs = Record<string, string | number | boolean | undefined | null | EventListener>

/** Tiny element builder: h('button.big', { onclick }, 'Speel'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split('.')
  const el = document.createElement(name as K)
  if (classes.length) el.className = classes.join(' ')
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener)
    } else if (k === 'class') {
      el.className += (el.className ? ' ' : '') + String(v)
    } else if (k === 'html') {
      el.innerHTML = String(v)
    } else if (v === true) {
      el.setAttribute(k, '')
    } else {
      el.setAttribute(k, String(v))
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(c)
  }
  return el
}

/** Fires on pointerdown for snappy taps, and ignores the click that follows. */
export function onTap(el: HTMLElement, fn: (e: Event) => void): void {
  let handledAt = 0
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    handledAt = performance.now()
    fn(e)
  })
  el.addEventListener('click', (e) => {
    if (performance.now() - handledAt < 700) return
    fn(e)
  })
}

export function formatTime(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export const ICONS = {
  speaker:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h3l5-4v14l-5-4H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 2.5 11h2.5v9h5v-6h4v6h5v-9h2.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  paw: '<svg viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="42" rx="14" ry="12"/><ellipse cx="14" cy="26" rx="6" ry="8"/><ellipse cx="25" cy="15" rx="6" ry="8"/><ellipse cx="39" cy="15" rx="6" ry="8"/><ellipse cx="50" cy="26" rx="6" ry="8"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
}
