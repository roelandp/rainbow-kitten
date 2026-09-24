// Drawn-in-code stand-ins for missing assets. The game never blocks on a missing file.

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** Rounded kitten shape in black, orange and white, with ears and a tail. Paws at the left edge. */
export function placeholderCat(pose: string): HTMLCanvasElement {
  const [c, g] = canvas(256, 384)
  g.translate(128, 200)
  if (pose === 'jump') g.rotate(-0.35)
  const blob = (x: number, y: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
  }
  // tail
  g.strokeStyle = '#e8862f'
  g.lineWidth = 18
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(10, 90)
  g.quadraticCurveTo(40, 160, 5, 170)
  g.stroke()
  blob(0, 40, 62, 82, '#8a7f78')
  blob(-10, 50, 32, 55, '#fff8ef')
  blob(22, 10, 26, 30, '#1f1a1d')
  // ears
  g.fillStyle = '#1f1a1d'
  g.beginPath()
  g.moveTo(-58, -90)
  g.lineTo(-40, -150)
  g.lineTo(-14, -100)
  g.fill()
  g.fillStyle = '#e8862f'
  g.beginPath()
  g.moveTo(14, -100)
  g.lineTo(44, -150)
  g.lineTo(58, -88)
  g.fill()
  blob(0, -70, 66, 56, '#e8862f')
  g.fillStyle = '#1f1a1d'
  g.beginPath()
  g.ellipse(-22, -70, 44, 54, 0, Math.PI * 0.5, Math.PI * 1.5)
  g.fill()
  blob(0, -52, 30, 26, '#fff8ef')
  const happy = pose === 'happy' || pose === 'confetti' || pose === 'sleep'
  if (happy) {
    g.strokeStyle = '#2a1c14'
    g.lineWidth = 5
    for (const x of [-26, 26]) {
      g.beginPath()
      g.arc(x, -76, 10, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
    }
  } else {
    for (const x of [-26, 26]) {
      blob(x, -76, 13, pose === 'surprised' ? 16 : 13, '#5a3418')
      blob(x + 4, -81, 4, 4, '#fff')
    }
  }
  blob(0, -58, 6, 4, '#f29aa8')
  // paws on the wall side
  for (const y of [-10, 40, 90]) blob(-60, y, 16, 13, '#fff8ef')
  return c
}

export function placeholderItem(id: string): HTMLCanvasElement {
  const [c, g] = canvas(256, 256)
  g.translate(128, 128)
  switch (id) {
    case 'cape':
      g.fillStyle = '#e24b4b'
      g.beginPath()
      g.moveTo(-100, -80)
      g.quadraticCurveTo(40, -60, 110, 60)
      g.lineTo(20, 90)
      g.quadraticCurveTo(-40, 0, -100, -60)
      g.fill()
      g.fillStyle = '#ffd24a'
      star(g, 20, 10, 22)
      break
    case 'mouse-toy':
      g.fillStyle = '#9a9aa2'
      g.beginPath()
      g.ellipse(0, 20, 80, 50, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#f2a0b0'
      g.beginPath()
      g.arc(-40, -30, 22, 0, Math.PI * 2)
      g.fill()
      break
    case 'crown':
      g.fillStyle = '#f2c230'
      g.beginPath()
      g.moveTo(-100, 70)
      g.lineTo(-100, -40)
      g.lineTo(-50, 10)
      g.lineTo(0, -70)
      g.lineTo(50, 10)
      g.lineTo(100, -40)
      g.lineTo(100, 70)
      g.fill()
      break
    case 'party-hat': {
      const cols = ['#e24b4b', '#f29a3a', '#f2d23a', '#4a8ae2', '#9a5ae2']
      g.save()
      g.beginPath()
      g.moveTo(0, -110)
      g.lineTo(80, 110)
      g.lineTo(-80, 110)
      g.clip()
      cols.forEach((col, i) => {
        g.fillStyle = col
        g.fillRect(-100, -110 + i * 44, 200, 44)
      })
      g.restore()
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(0, -110, 18, 0, Math.PI * 2)
      g.fill()
      break
    }
    default:
      g.fillStyle = '#f28ab8'
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(-100, -60)
      g.lineTo(-100, 60)
      g.closePath()
      g.moveTo(0, 0)
      g.lineTo(100, -60)
      g.lineTo(100, 60)
      g.closePath()
      g.fill()
  }
  return c
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
}

/** Procedural wall textures: stripes, planks, bricks, clouds, metal. */
export function placeholderTexture(kind: string): HTMLCanvasElement {
  const [c, g] = canvas(256, 256)
  const noise = (a: number) => {
    const img = g.getImageData(0, 0, 256, 256)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * a
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    g.putImageData(img, 0, 0)
  }
  switch (kind) {
    case 'wallpaper': {
      const cols = ['#f7d9c4', '#f4b8b0', '#fbe8a6', '#bfe3dc']
      for (let i = 0; i < 8; i++) {
        g.fillStyle = cols[i % 4]
        g.fillRect(i * 32, 0, 32, 256)
      }
      break
    }
    case 'wood':
      for (let i = 0; i < 4; i++) {
        g.fillStyle = ['#c9803e', '#b8702f', '#d08a48', '#bf7736'][i]
        g.fillRect(i * 64, 0, 62, 256)
        g.fillStyle = '#6b3b18'
        g.fillRect(i * 64 + 62, 0, 2, 256)
      }
      noise(18)
      break
    case 'brick':
      g.fillStyle = '#d9d2c8'
      g.fillRect(0, 0, 256, 256)
      for (let r = 0; r < 8; r++)
        for (let k = -1; k < 5; k++) {
          g.fillStyle = ['#d0643c', '#c85a34', '#d86e44'][(r + k + 3) % 3]
          g.fillRect(k * 64 + (r % 2) * 32 + 3, r * 32 + 3, 58, 26)
        }
      noise(14)
      break
    case 'cloud':
      g.fillStyle = '#cfe4f7'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.4})`
        g.beginPath()
        const x = Math.random() * 256
        const y = Math.random() * 256
        const r = 20 + Math.random() * 30
        for (const [dx, dy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
          g.moveTo(x + dx + r, y + dy)
          g.arc(x + dx, y + dy, r, 0, Math.PI * 2)
        }
        g.fill()
      }
      break
    default:
      g.fillStyle = '#d7dadf'
      g.fillRect(0, 0, 256, 256)
      g.strokeStyle = '#a9adb5'
      g.lineWidth = 3
      g.strokeRect(4, 4, 120, 120)
      g.strokeRect(132, 4, 120, 120)
      g.strokeRect(4, 132, 248, 120)
      g.fillStyle = '#9aa0a8'
      for (const [x, y] of [[14, 14], [114, 14], [142, 114], [242, 114], [14, 242], [242, 242]]) {
        g.beginPath()
        g.arc(x, y, 4, 0, Math.PI * 2)
        g.fill()
      }
  }
  return c
}

const ZONE_GRADIENTS: Record<string, [string, string]> = {
  title: ['#fbe3c4', '#e9b7d9'],
  woonkamer: ['#f3d2a8', '#b78d6c'],
  zolder: ['#6d4a3a', '#2f2330'],
  dak: ['#f39a6b', '#5a3c8c'],
  wolken: ['#8cc4f2', '#2d4a9a'],
  ruimte: ['#1b1847', '#050418'],
}

export function placeholderBackground(id: string): HTMLCanvasElement {
  const [c, g] = canvas(270, 480)
  const [a, b] = ZONE_GRADIENTS[id] ?? ZONE_GRADIENTS.title
  const grad = g.createLinearGradient(0, 0, 0, 480)
  grad.addColorStop(0, a)
  grad.addColorStop(1, b)
  g.fillStyle = grad
  g.fillRect(0, 0, 270, 480)
  if (id === 'ruimte' || id === 'wolken' || id === 'dak') {
    g.fillStyle = 'rgba(255,255,255,0.8)'
    for (let i = 0; i < 80; i++) g.fillRect(Math.random() * 270, Math.random() * 480, 1.5, 1.5)
  }
  return c
}
