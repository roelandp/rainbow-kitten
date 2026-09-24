// Asset pipeline: recognise, name, key, cut, scale and export everything in visuals/.
// Run with `npm run assets`. Never writes to visuals/.
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp, { type OverlayOptions, type Sharp } from 'sharp'
import { ITEM_ORDER, ItemId } from '../src/game/rules'
import { itemPlacements, SpriteMeta } from '../src/scene/itemLayout'
import {
  components,
  crop,
  erase,
  erodeEdge,
  featherAlpha,
  Img,
  keepComponents,
  keyGreen,
  leftmostColumn,
  load,
  resize,
  shiftX,
  toSharp,
  trim,
} from './imageOps'
import { ANCHORS, ITEM_PIVOTS } from './anchors'

const ROOT = resolve(import.meta.dirname, '..')
const VIS = join(ROOT, 'visuals')
const PUB = join(ROOT, 'public')
const DEBUG = join(ROOT, 'debug')
const MAX_SPRITE_H = 768

for (const d of ['sprites', 'items', 'bg', 'textures', 'misc', 'audio'].map((d) => join(PUB, d)).concat(DEBUG)) {
  mkdirSync(d, { recursive: true })
}

// ---------- 1. Recognise and name ----------
// Each target lists filename hints (checked in order) based on looking at every file in visuals/.
type Target = { name: string; hints: RegExp[]; optional?: boolean }
const TARGETS: Target[] = [
  { name: 'poster', hints: [/poster/i] },
  { name: 'sheet', hints: [/character.?sheet|sheet/i] },
  { name: 'katja', hints: [/^katja\.(jpe?g|png|heic)$/i], optional: true },
  // hang-good has a clean green background; hang-vague-bg has a scene painted over the tail.
  { name: 'hang', hints: [/hang.*good/i, /^hang(?!.*vague)/i, /hang/i] },
  { name: 'surprised', hints: [/surprise/i] },
  { name: 'happy', hints: [/happy/i] },
  { name: 'jump', hints: [/jump/i] },
  { name: 'sleep', hints: [/^sleep\.|sleep(?!.*wake)/i] },
  { name: 'wake', hints: [/wake/i], optional: true },
  { name: 'beg', hints: [/beg/i] },
  // confetti-clean has no stray heads; confetti.jpeg is the fallback (needs CONFETTI_ERASE).
  { name: 'confetti', hints: [/confetti.*clean/i, /confetti/i] },
  { name: 'items-sheet', hints: [/items?/i] },
  { name: 'textures-sheet', hints: [/texture/i] },
  { name: 'icon', hints: [/app.?icon|icon/i] },
  { name: 'bg-title', hints: [/^scene1\./i, /title/i], optional: true },
  { name: 'bg-woonkamer', hints: [/liv\s*ing|woonkamer/i], optional: true },
  { name: 'bg-zolder', hints: [/attic|zolder/i], optional: true },
  { name: 'bg-dak', hints: [/outside\s*roof|roof|dak/i], optional: true },
  { name: 'bg-wolken', hints: [/more\s*outside|cloud|wolken/i], optional: true },
  { name: 'bg-ruimte', hints: [/stars|space|ruimte/i], optional: true },
  { name: 'purr', hints: [/purr/i], optional: true },
  { name: 'meow', hints: [/meow.*#1|meow/i], optional: true },
  { name: 'meow2', hints: [/meow.*#2/i], optional: true },
  { name: 'music1', hints: [/loop.*#1/i], optional: true },
  { name: 'music2', hints: [/loop.*#3|loop.*#2/i], optional: true },
]

const files = readdirSync(VIS).filter((f) => !f.startsWith('.'))
const used = new Set<string>()
const src: Record<string, string> = {}
for (const t of TARGETS) {
  let found: string | undefined
  for (const h of t.hints) {
    found = files.find((f) => !used.has(f) && h.test(f))
    if (found) break
  }
  if (found) {
    used.add(found)
    src[t.name] = join(VIS, found)
  }
}
const report: string[] = []
for (const t of TARGETS) report.push(`${src[t.name] ? 'ok      ' : t.optional ? 'optional' : 'MISSING '} ${t.name.padEnd(15)} ${src[t.name] ? src[t.name].slice(VIS.length + 1) : '-'}`)
for (const f of files) if (!used.has(f)) report.push(`unused   ${f}`)
console.log(report.join('\n'))

async function writeWebp(img: Img, path: string, quality = 90): Promise<void> {
  await toSharp(img).webp({ quality, alphaQuality: 100, effort: 5 }).toFile(path)
}

function fitHeight(img: Img, maxH: number): [number, number] {
  if (img.h <= maxH) return [img.w, img.h]
  return [Math.round((img.w * maxH) / img.h), maxH]
}

function keyed(img: Img): Img {
  return erodeEdge(featherAlpha(keyGreen(img), 1), 0.5)
}

// ---------- 2 + 3. Sprites ----------
const meta: SpriteMeta = { poses: {}, items: {} }
const spriteImgs: Record<string, Img> = {}

/** Keep the largest component and anything big enough to be part of Katja. */
function mainOnly(img: Img, minFrac = 0.004): Img {
  const { comps } = components(img)
  const big = Math.max(...comps.map((c) => c.area))
  return keepComponents(img, (c) => c.area >= Math.max(big * minFrac, 400))
}

async function hangGroup(): Promise<void> {
  const names = ['hang', 'surprised', 'happy'].filter((n) => src[n])
  if (names.length === 0) return
  const raw: Record<string, Img> = {}
  for (const n of names) raw[n] = await load(src[n])
  // Same canvas for all three: the largest source.
  const W = Math.max(...names.map((n) => raw[n].w))
  const H = Math.max(...names.map((n) => raw[n].h))
  const imgs: Record<string, Img> = {}
  for (const n of names) {
    let img = raw[n].w === W && raw[n].h === H ? raw[n] : await resize(raw[n], W, H)
    img = mainOnly(keyed(img))
    imgs[n] = img
  }
  const ref = leftmostColumn(imgs[names[0]])
  const cols: Record<string, number> = {}
  for (const n of names) {
    const col = leftmostColumn(imgs[n])
    cols[n] = col
    if (Math.abs(col - ref) > 2) {
      console.log(`  ${n}: wall column ${col} vs ${ref}, shifting ${ref - col}px`)
      imgs[n] = shiftX(imgs[n], ref - col)
    }
  }
  const [w, h] = fitHeight(imgs[names[0]], MAX_SPRITE_H)
  for (const n of names) {
    const out = await resize(imgs[n], w, h)
    spriteImgs[n] = out
    const wall = leftmostColumn(out)
    meta.poses[n] = { w, h, wallContact: wall / w, anchors: ANCHORS[n] }
    await writeWebp(out, join(PUB, 'sprites', `${n}.webp`))
    console.log(`  ${n}: ${w}x${h}, wallContact ${(wall / w).toFixed(4)} (src col ${cols[n]})`)
  }
}

interface SpriteJob {
  name: string
  erase?: [number, number, number, number][]
  /** Keep small separate pieces too (confetti). */
  keepSmall?: boolean
  minFrac?: number
}
const SPRITES: SpriteJob[] = [
  // jump has a faded ghost kitten at the bottom left: keep only big parts.
  { name: 'jump', minFrac: 0.05 },
  { name: 'sleep' },
  { name: 'wake' },
  { name: 'beg' },
  // The confetti image has three stray heads from the character sheet at the top left.
  { name: 'confetti', keepSmall: true, erase: /clean/.test(src.confetti ?? '') ? [] : CONFETTI_ERASE() },
]

function CONFETTI_ERASE(): [number, number, number, number][] {
  // Found by looking at the top of confetti.jpeg on a grid: three heads above and behind Katja's head.
  return [
    [0, 0, 1, 0.182],
    [0.472, 0.182, 0.708, 0.233],
    [0.66, 0.182, 1, 0.237],
    [0.825, 0.237, 1, 0.332],
    [0, 0.182, 0.3, 0.21],
  ]
}

async function sprite(job: SpriteJob): Promise<void> {
  if (!src[job.name]) return
  let img = await load(src[job.name])
  for (const r of job.erase ?? []) img = erase(img, r)
  img = keyed(img)
  img = job.keepSmall ? keepComponents(img, (c) => c.area >= 150) : mainOnly(img, job.minFrac)
  img = trim(img, 4)
  const [w, h] = fitHeight(img, MAX_SPRITE_H)
  const out = await resize(img, w, h)
  spriteImgs[job.name] = out
  meta.poses[job.name] = { w, h, wallContact: leftmostColumn(out) / w, anchors: ANCHORS[job.name] }
  await writeWebp(out, join(PUB, 'sprites', `${job.name}.webp`))
  console.log(`  ${job.name}: ${w}x${h}`)
}

// ---------- Items ----------
// Where each item sits on the sheet (fractions). The sheet came out as 2 columns x 3 rows,
// with a spare second mouse in the middle left that is not used.
const ITEM_CELLS: Record<ItemId, [number, number]> = {
  cape: [0.3, 0.17],
  'mouse-toy': [0.72, 0.17],
  crown: [0.72, 0.5],
  'party-hat': [0.3, 0.8],
  bow: [0.72, 0.8],
}
const itemImgs: Partial<Record<ItemId, Img>> = {}

async function items(): Promise<void> {
  if (!src['items-sheet']) return
  const sheet = keyed(await load(src['items-sheet']))
  const { comps } = components(sheet)
  const big = comps.filter((c) => c.area > sheet.w * sheet.h * 0.004)
  console.log(`  items-sheet: ${big.length} objects`)
  for (const id of ITEM_ORDER) {
    const [fx, fy] = ITEM_CELLS[id]
    const best = big
      .map((c) => ({ c, d: Math.hypot(c.cx / sheet.w - fx, c.cy / sheet.h - fy) }))
      .sort((a, b) => a.d - b.d)[0]
    if (!best) continue
    const c = best.c
    const pad = 12
    let img = crop(sheet, c.x0 - pad, c.y0 - pad, c.x1 - c.x0 + 1 + 2 * pad, c.y1 - c.y0 + 1 + 2 * pad)
    img = mainOnly(img, 0.02)
    img = trim(img, 4)
    const [w, h] = fitHeight(img, 512)
    const out = await resize(img, w, h)
    itemImgs[id] = out
    meta.items[id] = { w, h, pivot: ITEM_PIVOTS[id].pivot }
    await writeWebp(out, join(PUB, 'items', `${id}.webp`))
    await toSharp(out).png().toFile(join(DEBUG, `item-${id}.png`))
    console.log(`  ${id}: ${w}x${h} from (${Math.round(c.cx)},${Math.round(c.cy)})`)
  }
}

// ---------- Textures ----------
const TEXTURE_ORDER = ['wallpaper', 'wood', 'brick', 'cloud', 'metal']

async function textures(): Promise<void> {
  if (!src['textures-sheet']) return
  const img = await load(src['textures-sheet'])
  // Mask of non-white pixels, then the five biggest regions are the swatches.
  const mask: Img = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d.length) }
  for (let i = 0; i < img.d.length; i += 4) {
    const white = img.d[i] > 232 && img.d[i + 1] > 232 && img.d[i + 2] > 232
    mask.d[i + 3] = white ? 0 : 255
  }
  const { comps } = components(mask)
  const swatches = comps
    .filter((c) => c.area > img.w * img.h * 0.03)
    .sort((a, b) => b.area - a.area)
    .slice(0, 5)
    .sort((a, b) => (Math.abs(a.cy - b.cy) > img.h * 0.2 ? a.cy - b.cy : a.cx - b.cx))
  console.log(`  textures-sheet: ${swatches.length} swatches`)
  for (let i = 0; i < swatches.length; i++) {
    const c = swatches[i]
    const inset = 6
    const size = Math.min(c.x1 - c.x0, c.y1 - c.y0) + 1 - 2 * inset
    const sw = crop(img, c.x0 + inset, c.y0 + inset, size, size)
    for (let p = 3; p < sw.d.length; p += 4) sw.d[p] = 255
    const name = TEXTURE_ORDER[i]
    const seamless = edgeMismatch(sw) < 18
    let tile: Sharp
    if (seamless) {
      tile = toSharp(sw).resize(512, 512)
    } else {
      // Mirror tiling: a 2x2 of the swatch and its mirrors always wraps without a seam.
      const half = await toSharp(sw).resize(256, 256).png().toBuffer()
      const fl = await sharp(half).flop().toBuffer()
      const fp = await sharp(half).flip().toBuffer()
      const both = await sharp(half).flip().flop().toBuffer()
      tile = sharp({ create: { width: 512, height: 512, channels: 4, background: '#000' } }).composite([
        { input: half, left: 0, top: 0 },
        { input: fl, left: 256, top: 0 },
        { input: fp, left: 0, top: 256 },
        { input: both, left: 256, top: 256 },
      ])
    }
    const buf = await tile.webp({ quality: 85 }).toBuffer()
    writeFileSync(join(PUB, 'textures', `wall-${name}.webp`), buf)
    await sharp(buf).png().toFile(join(DEBUG, `texture-${name}.png`))
    console.log(`  wall-${name}: ${seamless ? 'tiles as is' : 'mirror tiled'} (edge diff ${edgeMismatch(sw).toFixed(1)})`)
  }
}

/** Mean colour difference between opposite edges; low means it tiles without a seam. */
function edgeMismatch(img: Img): number {
  let s = 0
  let n = 0
  const px = (x: number, y: number) => (y * img.w + x) * 4
  for (let y = 0; y < img.h; y++) {
    const a = px(0, y)
    const b = px(img.w - 1, y)
    for (let k = 0; k < 3; k++) s += Math.abs(img.d[a + k] - img.d[b + k])
    n += 3
  }
  for (let x = 0; x < img.w; x++) {
    const a = px(x, 0)
    const b = px(x, img.h - 1)
    for (let k = 0; k < 3; k++) s += Math.abs(img.d[a + k] - img.d[b + k])
    n += 3
  }
  return s / n
}

// ---------- Backgrounds, icon, audio ----------
async function backgrounds(): Promise<void> {
  for (const n of ['bg-title', 'bg-woonkamer', 'bg-zolder', 'bg-dak', 'bg-wolken', 'bg-ruimte']) {
    if (!src[n]) {
      console.log(`  ${n}: missing, the game uses a colour gradient`)
      continue
    }
    await sharp(src[n]).rotate().resize(1080, 1920, { fit: 'inside' }).webp({ quality: 80 }).toFile(join(PUB, 'bg', `${n.slice(3)}.webp`))
    console.log(`  ${n}`)
  }
}

async function icon(): Promise<void> {
  if (!src.icon) return
  for (const [size, name] of [
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
    [180, 'apple-touch-icon.png'],
  ] as const) {
    await sharp(src.icon).rotate().resize(size, size, { fit: 'cover' }).png().toFile(join(PUB, 'misc', name))
  }
  await sharp(src.icon).rotate().resize(64, 64).png().toFile(join(PUB, 'favicon.png'))
  if (src.poster) await sharp(src.poster).rotate().resize(600).webp({ quality: 82 }).toFile(join(PUB, 'misc', 'poster.webp'))
  console.log('  icon 192, 512, 180, favicon')
}

function audio(): void {
  for (const n of ['purr', 'meow', 'meow2', 'music1', 'music2']) {
    if (!src[n]) continue
    copyFileSync(src[n], join(PUB, 'audio', `${n}.mp3`))
    console.log(`  ${n}.mp3`)
  }
}

// ---------- Debug sheets ----------
async function keyingSheet(): Promise<void> {
  const names = Object.keys(spriteImgs)
  const tile = 300
  const bgs = ['#1b1430', '#f4ecdc']
  const comps: OverlayOptions[] = []
  for (let i = 0; i < names.length; i++) {
    const img = spriteImgs[names[i]]
    const scale = Math.min(tile / img.w, tile / img.h)
    const buf = await toSharp(img).resize(Math.round(img.w * scale), Math.round(img.h * scale)).png().toBuffer()
    for (let r = 0; r < 2; r++) comps.push({ input: buf, left: i * tile, top: r * tile })
  }
  const allItems = ITEM_ORDER.filter((id) => itemImgs[id])
  for (let i = 0; i < allItems.length; i++) {
    const img = itemImgs[allItems[i]]!
    const scale = Math.min(tile / img.w, tile / img.h) * 0.8
    const buf = await toSharp(img).resize(Math.round(img.w * scale), Math.round(img.h * scale)).png().toBuffer()
    for (let r = 0; r < 2; r++) comps.push({ input: buf, left: i * tile, top: (2 + r) * tile })
  }
  const width = Math.max(names.length, allItems.length) * tile
  const bgRects: OverlayOptions[] = []
  for (let r = 0; r < 4; r++) {
    bgRects.push({
      input: await sharp({ create: { width, height: tile, channels: 4, background: bgs[r % 2] } }).png().toBuffer(),
      left: 0,
      top: r * tile,
    })
  }
  await sharp({ create: { width, height: tile * 4, channels: 4, background: '#000' } })
    .composite([...bgRects, ...comps])
    .png()
    .toFile(join(DEBUG, 'keying.png'))
  console.log('  debug/keying.png')
}

async function anchorsSheet(): Promise<void> {
  const poses = Object.keys(meta.poses).filter((p) => meta.poses[p].anchors)
  const cell = 520
  const layers: OverlayOptions[] = []
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i]
    const pm = meta.poses[p]
    // Leave room around the pose: items may stick out above the head and behind the back.
    const scale = Math.min((cell - 20) / (pm.w * 1.5), (cell - 20) / (pm.h * 1.3))
    const ox = i * cell + Math.round((cell - pm.w * scale) / 2)
    const oy = Math.round(cell - 10 - pm.h * scale)
    const place = itemPlacements(meta, p, ITEM_ORDER)
    const draw = async (id: ItemId) => {
      const pl = place.find((x) => x.id === id)
      const img = itemImgs[id]
      if (!pl || !img) return
      const w = Math.max(2, Math.round(pl.w * pm.w * scale))
      const h = Math.max(2, Math.round((w * img.h) / img.w))
      const buf = await toSharp(img).resize(w, h).rotate(pl.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
      const m = await sharp(buf).metadata()
      layers.push({ input: buf, left: Math.round(ox + pl.cx * pm.w * scale - m.width! / 2), top: Math.round(oy + pl.cy * pm.h * scale - m.height! / 2) })
    }
    const order = [...place].sort((a, b) => a.z - b.z)
    for (const pl of order.filter((x) => x.z < 0)) await draw(pl.id)
    layers.push({ input: await toSharp(spriteImgs[p]).resize(Math.round(pm.w * scale), Math.round(pm.h * scale)).png().toBuffer(), left: ox, top: oy })
    for (const pl of order.filter((x) => x.z >= 0)) await draw(pl.id)
    // anchor dots
    const a = pm.anchors!
    for (const [k, col] of [['head', '#ff3b3b'], ['neck', '#3bb0ff'], ['back', '#ffd400']] as const) {
      const pt = a[k]
      const dot = await sharp({ create: { width: 10, height: 10, channels: 4, background: col } }).png().toBuffer()
      layers.push({ input: dot, left: Math.round(ox + pt.x * pm.w * scale - 5), top: Math.round(oy + pt.y * pm.h * scale - 5) })
    }
  }
  await sharp({ create: { width: Math.max(1, poses.length) * cell, height: cell, channels: 4, background: '#3a2b52' } })
    .composite(layers)
    .png()
    .toFile(join(DEBUG, 'anchors.png'))
  console.log('  debug/anchors.png')
}

// ---------- Run ----------
async function main(): Promise<void> {
  const only = process.argv[2]
  console.log('\nsprites')
  await hangGroup()
  for (const j of SPRITES) await sprite(j)
  console.log('\nitems')
  await items()
  if (only !== 'sprites') {
    console.log('\ntextures')
    await textures()
    console.log('\nbackgrounds')
    await backgrounds()
    console.log('\nicon')
    await icon()
    console.log('\naudio')
    audio()
  }
  writeFileSync(join(PUB, 'sprites', 'sprites.json'), JSON.stringify(meta, null, 2) + '\n')
  console.log('\ndebug')
  await keyingSheet()
  await anchorsSheet()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
