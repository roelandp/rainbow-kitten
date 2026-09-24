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

export function speak(text: string): void {
  if (typeof speechSynthesis === 'undefined') return
  if (!voice) pickVoice()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(speakable(text))
  u.lang = voice?.lang ?? 'en-GB'
  if (voice) u.voice = voice
  u.rate = 0.85
  u.onstart = () => listeners.forEach((f) => f(true))
  const end = () => listeners.forEach((f) => f(false))
  u.onend = end
  u.onerror = end
  listeners.forEach((f) => f(true))
  speechSynthesis.speak(u)
  // Some browsers never fire onend; make sure the music comes back up.
  setTimeout(end, 2500 + text.length * 90)
}
