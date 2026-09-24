// Item anchor points per pose, set by looking at each keyed pose (see debug/anchors.png).
// x, y: fraction of the pose image. rot: degrees. scale: head width / image width.
import type { ItemId } from '../src/game/rules'
import type { PoseAnchors } from '../src/scene/itemLayout'

export const ANCHORS: Record<string, PoseAnchors | undefined> = {
  // Side view facing the wall on the left, head turned to the viewer and tilted about 15 degrees.
  // The back is the right edge of the body, so the mouse sits there sideways (rot 90).
  hang: {
    head: { x: 0.565, y: 0.125, rot: 15, scale: 0.46 },
    neck: { x: 0.47, y: 0.37, rot: 12, scale: 0.46 },
    back: { x: 0.615, y: 0.5, rot: 90, scale: 0.46 },
  },
  // Stretched diagonally up-left; back is the upper right edge of the body.
  jump: {
    head: { x: 0.57, y: 0.075, rot: 15, scale: 0.48 },
    neck: { x: 0.6, y: 0.275, rot: 15, scale: 0.48 },
    back: { x: 0.735, y: 0.43, rot: 58, scale: 0.48 },
  },
  // Front view: no back visible, the mouse sits on her shoulder.
  beg: {
    head: { x: 0.49, y: 0.055, rot: 0, scale: 0.88 },
    neck: { x: 0.5, y: 0.45, rot: 0, scale: 0.88 },
    back: { x: 0.8, y: 0.54, rot: 8, scale: 0.55 },
  },
  confetti: {
    head: { x: 0.6, y: 0.14, rot: 14, scale: 0.55 },
    neck: { x: 0.53, y: 0.43, rot: 10, scale: 0.55 },
    back: { x: 0.7, y: 0.52, rot: 10, scale: 0.45 },
  },
}
// surprised and happy are edits of hang with the exact same body.
ANCHORS.surprised = ANCHORS.hang
ANCHORS.happy = ANCHORS.hang

/** The point of each item image that sits on the anchor (fraction of the item image). */
export const ITEM_PIVOTS: Record<ItemId, { pivot: [number, number] }> = {
  cape: { pivot: [0.08, 0.12] },
  bow: { pivot: [0.5, 0.5] },
  'mouse-toy': { pivot: [0.5, 0.95] },
  crown: { pivot: [0.5, 0.9] },
  'party-hat': { pivot: [0.5, 0.95] },
}
