import { clamp, ease } from './gridAppearance';
import { cubicProgress } from './gridMotion';

export type IntroClock = { phase: number; remainder: number };
export function advanceIntro(clock: IntroClock, seconds: number): IntroClock {
  const step = 1 / 60, count = (seconds + clock.remainder) / step;
  let phase = clock.phase;
  for (let i = 0; i < Math.floor(count); i++) {
    phase += step / 7;
    if (phase > 1) phase -= 1;
  }
  return { phase, remainder: (count - Math.floor(count)) * step };
}

const points = [[-1, -1], [-1, 0], [-1, 1], [-1, 1], [0, 1]] as const;
const weighted = (from: number, to: number, progress: number) => from * (1 - progress) + progress * to;
function rotation(progress: number) {
  if (progress <= .4) return -.1 * ease(progress / .4);
  if (progress <= .7) return weighted(-.1, 1.1, cubicProgress(.7, 1, (progress - .4) / (.7 - .4)));
  return weighted(1.1, 1, cubicProgress(0, .3, (progress - .7) / (1 - .7)));
}

export function introMotion(phase: number) {
  const progress = clamp(phase / .3), row = clamp(progress / .9) * 4;
  const segment = Math.min(3, Math.floor(row)), fraction = ease(row - segment);
  const from = points[segment], to = points[segment + 1];
  const point = from.map((value, i) => weighted(value, to[i], fraction));
  const markers = [...points.slice(0, Math.floor(row) + 1), point];
  const trail = markers.filter((p, i, all) =>
    i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  const heading = row <= 2 ? weighted(Math.PI / 2, Math.PI / 2, rotation(row / 2))
    : row >= 3 ? 0 : Math.PI / 2 * (1 - rotation(row - 2));
  const check = clamp((progress - .9) / (1 - .9));
  return { point, trail, markers, heading, row, check };
}
