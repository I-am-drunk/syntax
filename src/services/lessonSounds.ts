import { assetUrl } from '../mpm2d/assetUrl';
import { Howl, Howler } from 'howler';

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
] as const;

export type LessonSound =
  | (typeof mp3Cues)[number]
  | 'course-complete'
  | 'xp-tally-1'
  | 'xp-tally-2'
  | 'xp-tally-3'
  | 'xp-tally-4'
  | 'xp-tally-5'
  | 'xp-tally-final'
  | 'grid-snap';

const cueToFile = (cue: LessonSound): string => {
  if (cue === 'grid-snap') return 'toggle-on';
  if (cue === 'course-complete') return 'lesson-complete';
  if (cue.startsWith('xp-tally')) return 'lightweight-choice';
  return cue;
};

const source = (file: string) => assetUrl(`/assets/sounds/${file}.mp3`);
const howlCache = new Map<string, Howl>();
let preloaded = false;

function getHowl(file: string): Howl {
  let h = howlCache.get(file);
  if (!h) {
    h = new Howl({
      src: [source(file)],
      preload: true,
      html5: false,
      volume: 1,
      pool: file === 'toggle-on' ? 10 : 5,
      onloaderror: () => {
        howlCache.delete(file);
      },
    });
    howlCache.set(file, h);
  }
  return h;
}

export function preloadLessonSounds() {
  if (preloaded) return;
  preloaded = true;
  for (const cue of mp3Cues) {
    try {
      getHowl(cue);
    } catch {
      /* Missing audio device must not prevent the lesson from opening. */
    }
  }
}

export function playLessonSound(cue: LessonSound) {
  try {
    const h = getHowl(cueToFile(cue));
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().then(() => h.play()).catch(() => {});
      return;
    }
    h.play();
  } catch {
    /* Sound failure does not cancel a lesson action. */
  }
}
