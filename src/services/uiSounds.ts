import { assetUrl } from '../core/assetUrl'

export type UiSound = 'lightweight-choice' | 'toggle-on' | 'toggle-off'

const audioPool = new Map<UiSound, HTMLAudioElement>()
const failedCooldownUntil = new Map<UiSound, number>()
const FAILED_COOLDOWN_MS = 60_000

export function playUiSound(cue: UiSound) {
  if (typeof Audio === 'undefined') return
  const cooldownUntil = failedCooldownUntil.get(cue)
  if (cooldownUntil && Date.now() < cooldownUntil) return

  try {
    let base = audioPool.get(cue)
    if (!base) {
      base = new Audio(assetUrl(`/assets/sounds/${cue}.mp3`))
      base.preload = 'auto'
      base.addEventListener('error', () => {
        audioPool.delete(cue)
        failedCooldownUntil.set(cue, Date.now() + FAILED_COOLDOWN_MS)
      })
      audioPool.set(cue, base)
    }
    const instance = base.cloneNode(true) as HTMLAudioElement
    instance.volume = 0.85
    void instance.play().catch(() => {
      // Ignore autoplay restrictions or missing audio output device
    })
  } catch {
    // Audio playback is best-effort and must never disrupt UI actions
  }
}
