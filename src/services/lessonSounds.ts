import { assetUrl } from '../mpm2d/assetUrl'
import { Howl, Howler } from 'howler'

const mp3Cues = [
  'drag-started',
  'drag-released',
  'highlight-node',
  'toggle-on',
  'toggle-off',
  'lightweight-choice',
  'correct',
  'hint',
  'continue',
  'incorrect',
  'lesson-complete',
  'skill-check-failed',
] as const

export type LessonSound =
  | (typeof mp3Cues)[number]
  | 'course-complete'
  | 'xp-tally-1'
  | 'xp-tally-2'
  | 'xp-tally-3'
  | 'xp-tally-4'
  | 'xp-tally-5'
  | 'xp-tally-final'
  | 'grid-snap'

const cueToFile = (cue: LessonSound): string => {
  if (cue === 'grid-snap') return 'toggle-on'
  if (cue === 'course-complete') return 'lesson-complete'
  if (cue.startsWith('xp-tally')) return 'lightweight-choice'
  return cue
}

const source = (file: string) => assetUrl(`/assets/sounds/${file}.mp3`)
const howlCache = new Map<string, Howl>()
const failedCooldownUntil = new Map<string, number>()
const FAILED_COOLDOWN_MS = 60_000
let preloaded = false
let resumePromise: Promise<void> | null = null
let pendingResumeCue: { file: string; requestedAt: number } | null = null

function getHowl(file: string): Howl | null {
  const cooldownUntil = failedCooldownUntil.get(file)
  if (cooldownUntil && Date.now() < cooldownUntil) {
    return null
  }
  let h = howlCache.get(file)
  if (!h) {
    h = new Howl({
      src: [source(file)],
      preload: true,
      html5: false,
      volume: 1,
      pool: file === 'toggle-on' ? 10 : 5,
      onloaderror: () => {
        howlCache.delete(file)
        failedCooldownUntil.set(file, Date.now() + FAILED_COOLDOWN_MS)
      },
    })
    howlCache.set(file, h)
  }
  return h
}

export function preloadLessonSounds() {
  if (preloaded) return
  preloaded = true
  for (const cue of mp3Cues) {
    try {
      getHowl(cue)
    } catch {
      /* Missing audio device must not prevent the lesson from opening. */
    }
  }
}

export function playLessonSound(cue: LessonSound) {
  try {
    const file = cueToFile(cue)
    const h = getHowl(file)
    if (!h) return
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      pendingResumeCue = { file, requestedAt: Date.now() }
      if (!resumePromise) {
        resumePromise = Howler.ctx
          .resume()
          .then(() => {
            const pending = pendingResumeCue
            pendingResumeCue = null
            if (pending && Date.now() - pending.requestedAt < 350) {
              getHowl(pending.file)?.play()
            }
          })
          .catch(() => {
            pendingResumeCue = null
          })
          .finally(() => {
            resumePromise = null
          })
      }
      return
    }
    h.play()
  } catch {
    /* Sound failure does not cancel a lesson action. */
  }
}
