// English pronunciation through SpeechSynthesis. Dutch words are never spoken.

let voice: SpeechSynthesisVoice | null = null
let unlocked = false
const listeners = new Set<(speaking: boolean) => void>()

function pickVoice(): void {
  if (typeof speechSynthesis === 'undefined') return
  const voices = speechSynthesis.getVoices()
  voice =
    voices.find((v) => v.lang.replace('_', '-') === 'en-GB' && /female|serena|kate|martha|daniel/i.test(v.name)) ??
    voices.find((v) => v.lang.replace('_', '-') === 'en-GB') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null
}

export function initSpeech(): void {
  if (typeof speechSynthesis === 'undefined') return
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

/** Call inside a tap handler once, so iOS allows speech later on. */
export function unlockSpeech(): void {
  if (unlocked || typeof speechSynthesis === 'undefined') return
  unlocked = true
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  speechSynthesis.speak(u)
}

/** Makes the text nicer to hear: "mum / mother" is read as "mum, mother", "…" is dropped. */
export function speakable(text: string): string {
  return text.replace(/\s*\/\s*/g, ', ').replace(/…|\.\.\./g, '').trim()
}

export function onSpeaking(fn: (speaking: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Last things that happened, for the voice test in the settings. */
export const speechLog: string[] = []
function log(msg: string): void {
  speechLog.push(msg)
  if (speechLog.length > 12) speechLog.shift()
}

export function voiceInfo(): string {
  if (typeof speechSynthesis === 'undefined') return 'Deze browser kan niet voorlezen.'
  const en = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en')).length
  return voice ? `Stem: ${voice.name} (${voice.lang}), ${en} Engelse stemmen` : `Geen Engelse stem gevonden (${en})`
}

/** Strong references: WebKit can garbage-collect an utterance mid-sentence and cut it off. */
const alive = new Set<SpeechSynthesisUtterance>()

/**
 * Speaks English. Resolves when done (or after a safety timeout), so callers can wait for a
 * whole sentence before the next word starts.
 */
export function speak(text: string): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve()
  if (!voice) pickVoice()
  // iOS sometimes drops an utterance spoken right after cancel(), so only cancel when needed.
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
  if (speechSynthesis.paused) speechSynthesis.resume()
  const words = speakable(text)
  return new Promise((resolve) => {
    let finished = false
    const end = () => {
      if (finished) return
      finished = true
      listeners.forEach((f) => f(false))
      resolve()
    }
    const say = (withVoice: boolean) => {
      const u = new SpeechSynthesisUtterance(words)
      u.lang = voice?.lang ?? 'en-GB'
      if (withVoice && voice) u.voice = voice
      u.rate = 0.85
      alive.add(u)
      u.onstart = () => {
        log('begonnen')
        listeners.forEach((f) => f(true))
      }
      u.onend = () => {
        log('klaar')
        alive.delete(u)
        end()
      }
      u.onerror = (e) => {
        alive.delete(u)
        // A chosen voice that is not installed fails on some iPads: try once more with only the language.
        const err = (e as SpeechSynthesisErrorEvent).error
        log(`fout: ${err}${withVoice ? '' : ' (zonder vaste stem)'}`)
        if (withVoice && err !== 'interrupted' && err !== 'canceled') say(false)
        else end()
      }
      speechSynthesis.speak(u)
    }
    listeners.forEach((f) => f(true))
    log(`start: "${words.slice(0, 30)}"`)
    say(true)
    // Some browsers never fire onend; never wait forever.
    setTimeout(end, 1500 + words.length * 110)
  })
}
