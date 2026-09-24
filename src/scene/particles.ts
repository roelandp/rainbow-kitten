import * as THREE from 'three'

export const RAINBOW = [0xff4d5e, 0xff9a3c, 0xffd93d, 0x6bd66b, 0x4da6ff, 0x9b6bff, 0xff7ac8]
const SPARKLE = [0xfff3b0, 0xffffff, 0xffd93d, 0xffc2e2, 0xbfe6ff]

/** Raw sRGB components; the shader writes them straight to the screen. */
function rgb(hex: number): { r: number; g: number; b: number } {
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 }
}

interface P {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  size: number
  spin: number
  angle: number
  r: number
  g: number
  b: number
  shape: number
  gravity: number
}

/** One draw call for all stars and confetti. Shape 0 = star, 1 = confetti strip. */
export class Particles {
  readonly points: THREE.Points
  private ps: P[] = []
  private geo: THREE.BufferGeometry
  private pos: Float32Array
  private col: Float32Array
  private alpha: Float32Array
  private size: Float32Array
  private ang: Float32Array
  private shape: Float32Array

  constructor(private max = 700) {
    this.geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(max * 3)
    this.col = new Float32Array(max * 3)
    this.alpha = new Float32Array(max)
    this.size = new Float32Array(max)
    this.ang = new Float32Array(max)
    this.shape = new Float32Array(max)
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3))
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1))
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1))
    this.geo.setAttribute('angle', new THREE.BufferAttribute(this.ang, 1))
    this.geo.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { scale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float alpha;
        attribute float size;
        attribute float angle;
        attribute float shape;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vAngle;
        varying float vShape;
        void main() {
          vColor = color; vAlpha = alpha; vAngle = angle; vShape = shape;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vAngle;
        varying float vShape;
        float starShape(vec2 p) {
          float a = atan(p.y, p.x);
          float r = length(p);
          float k = 0.55 + 0.45 * cos(5.0 * a);
          return smoothstep(0.02, -0.02, r - mix(0.22, 0.5, k));
        }
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vAngle), s = sin(vAngle);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
          float m;
          if (vShape < 0.5) {
            m = starShape(p);
          } else {
            vec2 q = abs(p) - vec2(0.42, 0.16);
            m = smoothstep(0.03, -0.03, max(q.x, q.y));
          }
          if (m * vAlpha < 0.02) discard;
          float shine = 1.0 + 0.35 * smoothstep(0.3, 0.0, length(p + vec2(0.1, 0.1)));
          gl_FragColor = vec4(vColor * shine, m * vAlpha);
        }`,
    })
    this.points = new THREE.Points(this.geo, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 20
  }

  setScale(pxPerUnit: number): void {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.scale.value = pxPerUnit
  }

  private add(p: Partial<P> & { x: number; y: number }): void {
    if (this.ps.length >= this.max) this.ps.shift()
    this.ps.push({
      z: 0.3,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      max: 1,
      size: 0.3,
      spin: 0,
      angle: Math.random() * 6.28,
      shape: 0,
      gravity: 0,
      r: 1,
      g: 1,
      b: 1,
      ...p,
    })
  }

  /** Little stars at a jump. More for a cross jump. */
  sparkle(x: number, y: number, n: number, rainbow = false, spread = 1): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = (0.8 + Math.random() * 1.8) * spread
      const hex = (rainbow ? RAINBOW : SPARKLE)[Math.floor(Math.random() * (rainbow ? RAINBOW.length : SPARKLE.length))]
      const c = rgb(hex)
      this.add({
        x,
        y,
        z: 0.4 + Math.random() * 0.4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp + 0.6,
        max: 0.7 + Math.random() * 0.6,
        size: 0.18 + Math.random() * 0.22,
        spin: (Math.random() - 0.5) * 6,
        r: c.r,
        g: c.g,
        b: c.b,
        gravity: -1.2,
      })
    }
  }

  /** Rainbow confetti and stars bursting up and drifting down. */
  confetti(x: number, y: number, n: number, width = 4): void {
    for (let i = 0; i < n; i++) {
      const c = rgb(RAINBOW[i % RAINBOW.length])
      const star = Math.random() < 0.3
      this.add({
        x: x + (Math.random() - 0.5) * width * 0.4,
        y,
        z: 0.2 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * width * 1.4,
        vy: 3 + Math.random() * 5,
        max: 2.4 + Math.random() * 1.6,
        size: star ? 0.28 + Math.random() * 0.2 : 0.22 + Math.random() * 0.14,
        spin: (Math.random() - 0.5) * 10,
        shape: star ? 0 : 1,
        r: c.r,
        g: c.g,
        b: c.b,
        gravity: -4.5,
      })
    }
  }

  update(dt: number): void {
    const ps = this.ps
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]
      p.life += dt
      if (p.life >= p.max) {
        ps.splice(i, 1)
        continue
      }
      p.vy += p.gravity * dt
      if (p.shape === 1) {
        // Confetti flutters: air drag and a little sway.
        p.vx *= 1 - 1.6 * dt
        p.vy = Math.max(p.vy, -1.6)
        p.x += Math.sin(p.life * 7 + p.angle) * 0.6 * dt
      } else {
        p.vx *= 1 - 2 * dt
        p.vy *= 1 - 2 * dt
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.angle += p.spin * dt
    }
    const n = ps.length
    for (let i = 0; i < n; i++) {
      const p = ps[i]
      this.pos[i * 3] = p.x
      this.pos[i * 3 + 1] = p.y
      this.pos[i * 3 + 2] = p.z
      this.col[i * 3] = p.r
      this.col[i * 3 + 1] = p.g
      this.col[i * 3 + 2] = p.b
      const t = p.life / p.max
      this.alpha[i] = t < 0.1 ? t / 0.1 : 1 - Math.max(0, (t - 0.6) / 0.4)
      this.size[i] = p.size * (p.shape === 0 ? 1 - t * 0.4 : 1)
      this.ang[i] = p.angle
      this.shape[i] = p.shape
    }
    this.geo.setDrawRange(0, n)
    for (const k of ['position', 'color', 'alpha', 'size', 'angle', 'shape']) {
      ;(this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true
    }
  }

  clear(): void {
    this.ps.length = 0
    this.geo.setDrawRange(0, 0)
  }
}
