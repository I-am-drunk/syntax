import type { GridRun } from './grid';
import type { GridPlaybackFrame } from './grid/useGridPlayback';
import { cubicProgress } from './gridMotion';

type Color = readonly [number, number, number];
export const colors = {
  blue: [69, 109, 255], gray: [153, 153, 153], trail: [102, 102, 102],
  green: [21, 180, 65], yellow: [247, 195, 37], black: [0, 0, 0],
  white: [255, 255, 255], success: [234, 250, 238], warning: [253, 243, 211],
  successText: [0, 155, 43], warningText: [183, 137, 0],
} as const;
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const ease = (value: number) => cubicProgress(0.4, 0.3, clamp(value));
const linear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const encoded = (value: number) => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
export function mixColor(from: Color, to: Color, amount: number): string {
  const channels = from.map((value, index) => {
    const mixed = linear(value / 255) * (1 - amount) + amount * linear(to[index] / 255);
    return Math.round(encoded(mixed) * 10000) / 100 + '%';
  });
  return `rgb(${channels.join(' ')})`;
}

// Outcome color begins when the final interpolation snaps, not at the callback.
export function gridAppearance(frame: GridPlaybackFrame, result: GridRun | null, stepMs = 200) {
  const finished = frame.phase === 'finished' && result !== null;
  const correct = finished && result.status === 'correct';
  const collision = finished && result.status === 'out-of-bounds';
  const fatal = collision || (finished && ['wrong-delivery', 'duplicate-delivery', 'infinite-loop'].includes(result.status));
  const settled = frame.visualElapsedMs / stepMs > 0.99999;
  const amount = finished && settled ? clamp(frame.visualElapsedMs / (correct ? 500 : 330)) : 0;
  const time = correct && settled ? frame.visualElapsedMs : 0;
  const tinted = finished && settled;
  return {
    correct, collision, fatal, amount, time,
    backdropOpacity: tinted ? 0.5 : 1,
    signOpacity: 1 - ease(amount),
    counterOpacity: correct || fatal ? 1 - ease(amount) : 1,
    messageOpacity: ease(amount),
    hud: mixColor(colors.white, correct ? colors.success : colors.warning, amount),
    text: mixColor(colors.black, correct ? colors.successText : colors.warningText, amount),
    goal: mixColor(colors.blue, correct ? colors.green : fatal ? colors.gray : colors.yellow, ease(amount)),
    cursor: mixColor(colors.blue, fatal ? colors.yellow : colors.gray, ease(amount)),
    trail: mixColor(colors.trail, colors.gray, ease(amount)),
    visited: mixColor(colors.black, colors.gray, ease(amount)),
  };
}

export function collisionOffset(fraction: number) {
  const points = [[0, 0, 0], [0.3, -7, 0], [0.5, 3, 0], [0.7, 0, 0], [0.8, 0, 2], [0.9, 0, -2], [1, 0, 0]];
  const index = points.findIndex(point => point[0] >= fraction);
  if (index <= 0) return { x: 0, y: 0 };
  const [t, x, y] = points[index], [previous, px, py] = points[index - 1];
  const progress = clamp((fraction - previous) / (t - previous));
  const eased = index === 1 ? ease(progress) : index === 2 ? cubicProgress(0.7, 1, progress)
    : index === 3 ? cubicProgress(0, 0.3, progress) : progress;
  return { x: px * (1 - eased) + x * eased, y: py * (1 - eased) + y * eased };
}
