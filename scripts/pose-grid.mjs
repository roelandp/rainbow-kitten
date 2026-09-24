// Debug helper: pose sprites with a 5% grid, for placing item anchors. node scripts/pose-grid.mjs out.png hang jump
import sharp from 'sharp'
const [,, out, ...names] = process.argv
const tiles = []
for (const n of names) {
  const f = `public/sprites/${n}.webp`
  const m = await sharp(f).metadata()
  const W = m.width, H = m.height
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
  for (let i = 1; i < 20; i++) {
    const x = W * i / 20, y = H * i / 20, major = i % 2 === 0
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${major ? '#2040ff' : '#90a0ff'}" stroke-width="${major ? 1.2 : 0.6}" opacity="0.7"/>`
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${major ? '#2040ff' : '#90a0ff'}" stroke-width="${major ? 1.2 : 0.6}" opacity="0.7"/>`
    if (major) { svg += `<text x="${x + 2}" y="12" font-size="11" fill="#c00">${i * 5}</text><text x="2" y="${y - 2}" font-size="11" fill="#c00">${i * 5}</text>` }
  }
  svg += `<text x="4" y="${H - 6}" font-size="16" fill="#000">${n}</text></svg>`
  const buf = await sharp({ create: { width: W, height: H, channels: 4, background: '#f4ecdc' } })
    .composite([{ input: f }, { input: Buffer.from(svg) }]).png().toBuffer()
  tiles.push({ buf, W, H })
}
const W = tiles.reduce((a, t) => a + t.W, 0), H = Math.max(...tiles.map(t => t.H))
let x = 0
await sharp({ create: { width: W, height: H, channels: 4, background: '#fff' } })
  .composite(tiles.map(t => { const o = { input: t.buf, left: x, top: 0 }; x += t.W; return o })).png().toFile(out)
