// Where items sit on Katja. Pure math, shared by the scene, the start screen and the asset pipeline.
import type { ItemId } from '../game/rules'

export interface Anchor {
  /** Position as a fraction of the pose image (0..1, from top left). */
  x: number
  y: number
  /** Rotation in degrees (clockwise). */
  rot: number
  /** Head width as a fraction of the pose image width. */
  scale: number
}

export interface PoseAnchors {
  head: Anchor
  neck: Anchor
  back: Anchor
}

export interface PoseMeta {
  w: number
  h: number
  /** Column where the paws touch the wall, fraction of the width. */
  wallContact: number
  anchors?: PoseAnchors
}

export interface ItemMeta {
  w: number
  h: number
  pivot: [number, number]
}

export interface SpriteMeta {
  poses: Record<string, PoseMeta>
  items: Partial<Record<ItemId, ItemMeta>>
}

export interface ItemFit {
  anchor: keyof PoseAnchors
  /** Item width relative to the head width. */
  width: number
  /** Extra rotation in degrees. */
  rot: number
  /** Offset relative to the head width, in the rotated anchor frame. */
  dx: number
  dy: number
  /** Draw order: negative is behind Katja. */
  z: number
}

export const ITEM_FIT: Record<ItemId, ItemFit> = {
  cape: { anchor: 'neck', width: 1.15, rot: 0, dx: 0.05, dy: 0, z: -1 },
  bow: { anchor: 'neck', width: 0.5, rot: 0, dx: 0, dy: 0, z: 1 },
  'mouse-toy': { anchor: 'back', width: 0.66, rot: 0, dx: 0, dy: 0.04, z: 2 },
  crown: { anchor: 'head', width: 0.6, rot: 0, dx: 0, dy: 0.06, z: 3 },
  // On top of the crown, a bit crooked.
  'party-hat': { anchor: 'head', width: 0.42, rot: 16, dx: 0.06, dy: -0.26, z: 4 },
}

export interface Placement {
  id: ItemId
  /** Centre of the item, fraction of the pose image. */
  cx: number
  cy: number
  /** Item width as a fraction of the pose image width. */
  w: number
  /** Item height as a fraction of the pose image height. */
  h: number
  rot: number
  z: number
}

/** Computes where each worn item goes on a pose. Returns nothing for poses without anchors. */
export function itemPlacements(meta: SpriteMeta, pose: string, items: ItemId[]): Placement[] {
  const pm = meta.poses[pose]
  if (!pm || !pm.anchors) return []
  const out: Placement[] = []
  for (const id of items) {
    const im = meta.items[id]
    const fit = ITEM_FIT[id]
    if (!im) continue
    const a = pm.anchors[fit.anchor]
    const headPx = a.scale * pm.w
    const wPx = fit.width * headPx
    const hPx = (wPx * im.h) / im.w
    const rot = a.rot + fit.rot
    const r = (rot * Math.PI) / 180
    const cos = Math.cos(r)
    const sin = Math.sin(r)
    // Offset in the anchor frame, then rotate into the image frame.
    const ox = fit.dx * headPx
    const oy = fit.dy * headPx
    // Move the item's pivot onto the anchor: centre = anchor + offset - (pivot - 0.5) * size, rotated.
    const px = (0.5 - im.pivot[0]) * wPx
    const py = (0.5 - im.pivot[1]) * hPx
    const lx = ox + px
    const ly = oy + py
    const cxPx = a.x * pm.w + lx * cos - ly * sin
    const cyPx = a.y * pm.h + lx * sin + ly * cos
    out.push({ id, cx: cxPx / pm.w, cy: cyPx / pm.h, w: wPx / pm.w, h: hPx / pm.h, rot, z: fit.z })
  }
  return out
}
