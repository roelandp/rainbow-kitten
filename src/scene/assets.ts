import * as THREE from 'three'
import { ITEM_ORDER, ItemId, ZONES } from '../game/rules'
import { placeholderBackground, placeholderCat, placeholderItem, placeholderTexture } from './fallbacks'
import type { SpriteMeta } from './itemLayout'

export const POSES = ['hang', 'surprised', 'happy', 'jump', 'sleep', 'wake', 'beg', 'confetti'] as const
export type Pose = (typeof POSES)[number]
export const BG_IDS = ['title', ...ZONES.map((z) => z.id)]

export interface SceneAssets {
  meta: SpriteMeta
  poses: Record<Pose, THREE.Texture>
  items: Record<ItemId, THREE.Texture>
  walls: Record<string, THREE.Texture>
  bgs: Record<string, THREE.Texture>
  /** Which assets fell back to a drawn stand-in. */
  fallbacks: string[]
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

const DEFAULT_META: SpriteMeta = { poses: {}, items: {} }

export async function loadSceneAssets(): Promise<SceneAssets> {
  const fallbacks: string[] = []
  let meta = DEFAULT_META
  try {
    const r = await fetch('./sprites/sprites.json')
    if (r.ok) meta = (await r.json()) as SpriteMeta
    else fallbacks.push('sprites.json')
  } catch {
    fallbacks.push('sprites.json')
  }

  const tex = (src: TexImageSource | HTMLCanvasElement, srgb = true) => {
    const t = new THREE.Texture(src as HTMLImageElement)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 4
    t.needsUpdate = true
    return t
  }

  const poses = {} as Record<Pose, THREE.Texture>
  const items = {} as Record<ItemId, THREE.Texture>
  const walls: Record<string, THREE.Texture> = {}
  const bgs: Record<string, THREE.Texture> = {}

  await Promise.all([
    ...POSES.map(async (p) => {
      const img = await loadImage(`./sprites/${p}.webp`)
      if (!img) {
        fallbacks.push(`sprite ${p}`)
        const c = placeholderCat(p)
        meta.poses[p] = meta.poses[p] ?? { w: c.width, h: c.height, wallContact: 0.1 }
      }
      poses[p] = tex(img ?? placeholderCat(p))
    }),
    ...ITEM_ORDER.map(async (id) => {
      const img = await loadImage(`./items/${id}.webp`)
      if (!img) {
        fallbacks.push(`item ${id}`)
        meta.items[id] = meta.items[id] ?? { w: 256, h: 256, pivot: [0.5, 0.8] }
      }
      items[id] = tex(img ?? placeholderItem(id))
    }),
    ...ZONES.map(async (z) => {
      const img = await loadImage(`./textures/wall-${z.texture}.webp`)
      if (!img) fallbacks.push(`texture ${z.texture}`)
      const t = tex(img ?? placeholderTexture(z.texture), false)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      walls[z.texture] = t
    }),
    ...BG_IDS.map(async (id) => {
      const img = await loadImage(`./bg/${id}.webp`)
      if (!img) fallbacks.push(`bg ${id}`)
      const t = tex(img ?? placeholderBackground(id))
      t.wrapT = THREE.MirroredRepeatWrapping
      bgs[id] = t
    }),
  ])
  return { meta, poses, items, walls, bgs, fallbacks }
}
