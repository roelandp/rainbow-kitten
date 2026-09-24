import type { ItemId } from '../game/rules'
import { placeholderCat } from '../scene/fallbacks'
import { itemPlacements, SpriteMeta } from '../scene/itemLayout'
import { h } from './dom'

let meta: SpriteMeta = { poses: {}, items: {} }

export async function loadSpriteMeta(): Promise<SpriteMeta> {
  try {
    const r = await fetch('./sprites/sprites.json')
    if (r.ok) meta = (await r.json()) as SpriteMeta
  } catch {
    /* fallback: no items on the start screen */
  }
  return meta
}

export function spriteMeta(): SpriteMeta {
  return meta
}

/** Katja as stacked images with her items, for the start screen and the collection. */
export function katjaDom(pose: string, worn: ItemId[], cls = ''): HTMLElement {
  const pm = meta.poses[pose]
  const aspect = pm ? pm.w / pm.h : 0.6
  const box = h('div.katja-dom', { class: cls, style: `aspect-ratio:${aspect}` })
  const placements = itemPlacements(meta, pose, worn).sort((a, b) => a.z - b.z)
  const layer = (id: ItemId) => {
    const pl = placements.find((p) => p.id === id)!
    return h('img.katja-item', {
      src: `./items/${id}.webp`,
      alt: '',
      draggable: 'false',
      style:
        `left:${(pl.cx - pl.w / 2) * 100}%;top:${(pl.cy - pl.h / 2) * 100}%;` +
        `width:${pl.w * 100}%;height:${pl.h * 100}%;transform:rotate(${pl.rot}deg)`,
    })
  }
  for (const pl of placements.filter((p) => p.z < 0)) box.append(layer(pl.id))
  const img = h('img.katja-body', { src: `./sprites/${pose}.webp`, alt: 'Katja', draggable: 'false' })
  img.onerror = () => {
    const c = placeholderCat(pose)
    c.className = 'katja-body'
    img.replaceWith(c)
  }
  box.append(img)
  for (const pl of placements.filter((p) => p.z >= 0)) box.append(layer(pl.id))
  return box
}
