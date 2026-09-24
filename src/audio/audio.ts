// WebAudio: synth effects, Katja samples and the music loop. Every sound has a synth fallback.
import { onSpeaking } from './speech'

type SampleName = 'purr' | 'meow' | 'meow2' | 'music1' | 'music2'

class AudioEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private cat!: GainNode
  private music!: GainNode
  private buffers = new Map<SampleName, AudioBuffer>()
  private loading = new Map<SampleName, Promise<AudioBuffer | null>>()
  private musicSrc: AudioBufferSourceNode | null = null
  private musicTrack: SampleName | null = null
  private wantMusic: SampleName | null = null
  soundOn = true
  musicOn = true
  catOn = true
  private ducked = false

  /** Wire the unlock to the first gestures (iOS needs a real tap). */
  install(): void {
    const unlock = () => this.unlock()
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) void this.ctx.suspend()
      else void this.ctx.resume()
    })
    onSpeaking((s) => this.duck(s))
  }

  unlock(): void {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'playback'
    } catch {
      /* not supported */
    }
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.sfx = this.gain(0.55)
      this.cat = this.gain(0.9)
      this.music = this.gain(0)
      // A silent buffer makes iOS treat the context as started by the user.
      const b = this.ctx.createBuffer(1, 1, 22050)
      const s = this.ctx.createBufferSource()
      s.buffer = b
      s.connect(this.master)
      s.start()
      for (const n of ['purr', 'meow', 'meow2'] as SampleName[]) void this.load(n)
    }
    if (this.ctx.state !== 'running') void this.ctx.resume()
    if (this.wantMusic && !this.musicSrc) void this.playMusic(this.wantMusic)
  }

  private gain(v: number): GainNode {
    const g = this.ctx!.createGain()
    g.gain.value = v
    g.connect(this.master)
    return g
  }

  private load(name: SampleName): Promise<AudioBuffer | null> {
    const have = this.buffers.get(name)
    if (have) return Promise.resolve(have)
    let p = this.loading.get(name)
    if (!p) {
      p = fetch(`./audio/${name}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => this.ctx!.decodeAudioData(ab))
        .then((buf) => {
          this.buffers.set(name, buf)
          return buf
        })
        .catch(() => null)
      this.loading.set(name, p)
    }
    return p
  }

  // ---------- music ----------

  setMusic(track: SampleName | null): void {
    this.wantMusic = track
    if (!this.ctx) return
    if (!track || !this.musicOn) {
      this.stopMusic()
      return
    }
    if (this.musicTrack === track && this.musicSrc) return
    void this.playMusic(track)
  }

  private async playMusic(track: SampleName): Promise<void> {
    if (!this.ctx || !this.musicOn) return
    const buf = await this.load(track)
    if (!buf || this.wantMusic !== track) return
    this.stopMusic()
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    // MP3 files have a bit of padding at both ends; loop over the audible part only.
    const [a, b] = audibleRange(buf)
    src.loopStart = a
    src.loopEnd = b
    src.connect(this.music)
    src.start(0, a)
    this.musicSrc = src
    this.musicTrack = track
    this.applyMusicGain(1.2)
  }

  private stopMusic(): void {
    if (this.musicSrc) {
      try {
        this.musicSrc.stop()
      } catch {
        /* already stopped */
      }
      this.musicSrc.disconnect()
    }
    this.musicSrc = null
    this.musicTrack = null
  }

  private applyMusicGain(ramp = 0.25): void {
    if (!this.ctx) return
    const target = this.musicOn ? (this.ducked ? 0.07 : 0.28) : 0
    const g = this.music.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(target, this.ctx.currentTime + ramp)
  }

  duck(on: boolean): void {
    this.ducked = on
    this.applyMusicGain(on ? 0.12 : 0.6)
  }

  setOptions(o: { sound: boolean; music: boolean; catSounds: boolean }): void {
    this.soundOn = o.sound
    this.catOn = o.catSounds
    const musicChanged = this.musicOn !== o.music
    this.musicOn = o.music
    if (musicChanged) {
      if (o.music && this.wantMusic) void this.playMusic(this.wantMusic)
      if (!o.music) this.stopMusic()
    }
    this.applyMusicGain()
  }

  // ---------- Katja ----------

  async catSound(name: 'purr' | 'meow'): Promise<void> {
    if (!this.ctx || !this.catOn) return
    const pick: SampleName = name === 'meow' && Math.random() < 0.5 ? 'meow2' : name
    const buf = (await this.load(pick)) ?? (await this.load(name))
    if (!buf) {
      if (name === 'meow') this.synthMeow()
      return
    }
    const s = this.ctx.createBufferSource()
    s.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = name === 'purr' ? 0.7 : 0.9
    s.connect(g).connect(this.cat)
    s.start()
  }

  private synthMeow(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(520, t)
    o.frequency.linearRampToValueAtTime(820, t + 0.15)
    o.frequency.linearRampToValueAtTime(480, t + 0.5)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 1200
    f.Q.value = 3
    const g = this.env(t, 0.3, 0.55)
    o.connect(f).connect(g).connect(this.cat)
    o.start(t)
    o.stop(t + 0.6)
  }

  // ---------- synth effects ----------

  private env(t: number, peak: number, dur: number, attack = 0.01): GainNode {
    const g = this.ctx!.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    return g
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType = 'sine', peak = 0.3, slideTo?: number): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.9)
    const g = this.env(t, peak, dur)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private ready(): boolean {
    return !!this.ctx && this.soundOn
  }

  /** Boing for a jump up the wall. */
  jump(): void {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    this.tone(260, t, 0.28, 'sine', 0.35, 620)
    this.tone(520, t + 0.02, 0.2, 'triangle', 0.08, 1100)
  }

  /** Higher boing plus a glitter for the jump to the other wall. */
  crossJump(): void {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    this.tone(330, t, 0.36, 'sine', 0.35, 900)
    this.glitter(t + 0.12, 6)
  }

  glitter(t = this.ctx?.currentTime ?? 0, n = 8): void {
    if (!this.ready()) return
    const notes = [1568, 1760, 2093, 2349, 2637, 3136]
    for (let i = 0; i < n; i++) this.tone(notes[(i * 3) % notes.length], t + i * 0.045, 0.18, 'sine', 0.07)
  }

  /** Soft questioning "hm?". */
  hm(): void {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    this.tone(220, t, 0.18, 'triangle', 0.16, 210)
    this.tone(210, t + 0.2, 0.26, 'triangle', 0.16, 300)
  }

  item(): void {
    if (!this.ready()) return
    this.glitter(this.ctx!.currentTime, 10)
  }

  /** Short tune when a round is done. */
  roundDone(): void {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    const seq = [523, 659, 784, 1047, 784, 1047]
    seq.forEach((f, i) => this.tone(f, t + i * 0.12, 0.22, 'triangle', 0.18))
  }

  /** Short happy fanfare for the confetti cat. */
  fanfare(): void {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    const seq: [number, number, number][] = [
      [523, 0, 0.14],
      [523, 0.14, 0.14],
      [523, 0.28, 0.14],
      [698, 0.42, 0.5],
      [880, 0.42, 0.5],
      [784, 0.95, 0.14],
      [880, 1.09, 0.14],
      [1047, 1.23, 0.7],
      [1319, 1.23, 0.7],
    ]
    for (const [f, dt, d] of seq) {
      this.tone(f, t + dt, d, 'square', 0.06)
      this.tone(f, t + dt, d, 'triangle', 0.14)
    }
    this.glitter(t + 1.3, 12)
  }

  /** Happy slide whistle down (never a fall). */
  slide(): void {
    if (!this.ready()) return
    const t = this.ctx!.currentTime
    this.tone(1200, t, 0.9, 'sine', 0.22, 300)
    this.tone(300, t + 0.9, 0.25, 'triangle', 0.16, 600)
  }

  tap(): void {
    if (!this.ready()) return
    this.tone(880, this.ctx!.currentTime, 0.06, 'sine', 0.08)
  }
}

/** Start and end (seconds) of the part of a buffer that is above a silence threshold. */
export function audibleRange(buf: AudioBuffer, thr = 0.003): [number, number] {
  const ch = buf.getChannelData(0)
  let a = 0
  while (a < ch.length && Math.abs(ch[a]) < thr) a++
  let b = ch.length - 1
  while (b > a && Math.abs(ch[b]) < thr) b--
  if (b - a < buf.sampleRate) return [0, buf.duration]
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate]
}

export const audio = new AudioEngine()
