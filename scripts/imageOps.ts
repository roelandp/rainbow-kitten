// Pixel helpers for the asset pipeline. Plain RGBA buffers, no DOM.
import sharp, { type Sharp } from 'sharp'

export interface Img {
  w: number
  h: number
  /** RGBA, 4 bytes per pixel. */
  d: Uint8ClampedArray
}

export async function load(path: string): Promise<Img> {
  const { data, info } = await sharp(path).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}

export function toSharp(img: Img): Sharp {
  return sharp(Buffer.from(img.d.buffer, img.d.byteOffset, img.d.length), {
    raw: { width: img.w, height: img.h, channels: 4 },
  })
}

export async function resize(img: Img, w: number, h: number): Promise<Img> {
  // Premultiply-safe resize: sharp handles alpha premultiplication for raw RGBA input.
  const { data, info } = await toSharp(img).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}

export function crop(img: Img, x: number, y: number, w: number, h: number): Img {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const sx = x + xx
      const sy = y + yy
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue
      const si = (sy * img.w + sx) * 4
      const di = (yy * w + xx) * 4
      out[di] = img.d[si]
      out[di + 1] = img.d[si + 1]
      out[di + 2] = img.d[si + 2]
      out[di + 3] = img.d[si + 3]
    }
  }
  return { w, h, d: out }
}

/** Shift an image horizontally, filling with transparency. */
export function shiftX(img: Img, dx: number): Img {
  return crop(img, -dx, 0, img.w, img.h)
}

export interface KeyOptions {
  /** Greenness (G - max(R,B)) at or below this stays fully opaque. */
  lo: number
  /** Greenness at or above this is fully transparent. */
  hi: number
}

/**
 * Chroma key for the Gemini green (around rgb(46,218,68), with gradients).
 * Alpha from greenness, then aggressive despill: G is clamped to max(R,B) everywhere,
 * which removes the green cast from white and orange fur edges.
 */
export function keyGreen(img: Img, opt: KeyOptions = { lo: 38, hi: 105 }): Img {
  const d = new Uint8ClampedArray(img.d)
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const m = Math.max(r, b)
    const greenness = g - m
    let a = 1
    if (greenness >= opt.hi) a = 0
    else if (greenness > opt.lo) a = (opt.hi - greenness) / (opt.hi - opt.lo)
    if (g > m) {
      // Despill. Put the removed green back as neutral brightness so white fur stays white, not pink.
      const spill = g - m
      const lift = a < 1 ? 0 : spill * 0.3
      d[i] = Math.min(255, r + lift)
      d[i + 1] = m + lift
      d[i + 2] = Math.min(255, b + lift)
    }
    d[i + 3] = Math.round(a * 255 * (img.d[i + 3] / 255))
  }
  return { w: img.w, h: img.h, d }
}

/** Blur the alpha channel with a small box kernel (feather). */
export function featherAlpha(img: Img, radius = 1): Img {
  const { w, h } = img
  const a = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) a[i] = img.d[i * 4 + 3]
  const tmp = new Float32Array(w * h)
  // horizontal
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      let n = 0
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k
        if (xx < 0 || xx >= w) continue
        s += a[y * w + xx]
        n++
      }
      tmp[y * w + x] = s / n
    }
  }
  const d = new Uint8ClampedArray(img.d)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      let n = 0
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k
        if (yy < 0 || yy >= h) continue
        s += tmp[yy * w + x]
        n++
      }
      // Only soften edges, never make opaque pixels more transparent than a 1px feather.
      d[(y * w + x) * 4 + 3] = Math.min(img.d[(y * w + x) * 4 + 3], s / n + 40)
    }
  }
  return { w, h, d }
}

/** Shrink the alpha mask by one pixel where it borders transparency (kills the last green fringe). */
export function erodeEdge(img: Img, amount = 0.55): Img {
  const { w, h } = img
  const d = new Uint8ClampedArray(img.d)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4 + 3
      if (img.d[i] === 0) continue
      let mn = 255
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mn = Math.min(mn, img.d[((y + dy) * w + x + dx) * 4 + 3])
      if (mn < 128) d[i] = Math.round(img.d[i] * (1 - amount) + mn * amount)
    }
  }
  return { w, h, d }
}

export interface Component {
  id: number
  area: number
  x0: number
  y0: number
  x1: number
  y1: number
  cx: number
  cy: number
}

/** Connected components (8-connected) of pixels with alpha above `thr`. */
export function components(img: Img, thr = 128): { labels: Int32Array; comps: Component[] } {
  const { w, h } = img
  const labels = new Int32Array(w * h).fill(-1)
  const comps: Component[] = []
  const stack = new Int32Array(w * h)
  for (let p = 0; p < w * h; p++) {
    if (labels[p] !== -1 || img.d[p * 4 + 3] <= thr) continue
    const id = comps.length
    const c: Component = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0, cx: 0, cy: 0 }
    let sp = 0
    stack[sp++] = p
    labels[p] = id
    while (sp > 0) {
      const q = stack[--sp]
      const x = q % w
      const y = (q - x) / w
      c.area++
      c.cx += x
      c.cy += y
      if (x < c.x0) c.x0 = x
      if (y < c.y0) c.y0 = y
      if (x > c.x1) c.x1 = x
      if (y > c.y1) c.y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          const r = yy * w + xx
          if (labels[r] !== -1 || img.d[r * 4 + 3] <= thr) continue
          labels[r] = id
          stack[sp++] = r
        }
      }
    }
    c.cx /= c.area
    c.cy /= c.area
    comps.push(c)
  }
  return { labels, comps }
}

/**
 * Keep only pixels that belong to kept components, plus their soft edge
 * (low-alpha pixels within `grow` px of a kept pixel).
 */
export function keepComponents(img: Img, keep: (c: Component) => boolean, thr = 128, grow = 3): Img {
  const { labels, comps } = components(img, thr)
  const keepSet = new Set(comps.filter(keep).map((c) => c.id))
  const { w, h } = img
  const mask = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) if (labels[p] >= 0 && keepSet.has(labels[p])) mask[p] = 1
  // dilate mask to keep soft edges
  let cur = mask
  for (let g = 0; g < grow; g++) {
    const next = new Uint8Array(cur)
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x
        if (cur[p]) continue
        if (cur[p - 1] || cur[p + 1] || cur[p - w] || cur[p + w]) next[p] = 1
      }
    cur = next
  }
  const d = new Uint8ClampedArray(img.d)
  for (let p = 0; p < w * h; p++) if (!cur[p]) d[p * 4 + 3] = 0
  return { w, h, d }
}

/** Set a rectangle (fractions of the image) to transparent. */
export function erase(img: Img, rect: [number, number, number, number]): Img {
  const d = new Uint8ClampedArray(img.d)
  const [fx0, fy0, fx1, fy1] = rect
  const x0 = Math.round(fx0 * img.w)
  const y0 = Math.round(fy0 * img.h)
  const x1 = Math.round(fx1 * img.w)
  const y1 = Math.round(fy1 * img.h)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d[(y * img.w + x) * 4 + 3] = 0
  return { w: img.w, h: img.h, d }
}

/** Bounding box of pixels with alpha above thr. */
export function alphaBox(img: Img, thr = 8): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = img.w
  let y0 = img.h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      if (img.d[(y * img.w + x) * 4 + 3] <= thr) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  return { x0, y0, x1, y1 }
}

export function trim(img: Img, margin = 4): Img {
  const b = alphaBox(img)
  return crop(img, b.x0 - margin, b.y0 - margin, b.x1 - b.x0 + 1 + 2 * margin, b.y1 - b.y0 + 1 + 2 * margin)
}

/** Leftmost column with at least `minCount` opaque pixels (where the paws touch the wall). */
export function leftmostColumn(img: Img, thr = 160, minCount = 6): number {
  for (let x = 0; x < img.w; x++) {
    let n = 0
    for (let y = 0; y < img.h; y++) if (img.d[(y * img.w + x) * 4 + 3] > thr) n++
    if (n >= minCount) return x
  }
  return 0
}
