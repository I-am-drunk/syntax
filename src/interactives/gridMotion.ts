const clamp = (value: number) => Math.max(0, Math.min(1, value));

// The reference solves the cubic's x coordinate by bisection to 0.0001.
export function cubicProgress(x1: number, x2: number, progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let low = 0, high = 1;
  for (;;) {
    const t = (low + high) / 2, u = 1 - t;
    const difference = x1 * u * u * t * 3 + x2 * u * t * t * 3 + t * t * t - progress;
    if (!difference || high - low < 0.0001) return u * t * t * 3 + t * t * t;
    if (difference > 0) high = t;
    else low = t;
  }
}

export const moveProgress = (fraction: number) => cubicProgress(0.4, 0.3, clamp(fraction / 0.8));
export function turnProgress(fraction: number): number {
  if (fraction <= 0) return 0;
  if (fraction <= 0.4) return -0.15 * cubicProgress(0.4, 0.3, clamp(fraction / 0.4));
  if (fraction <= 0.7) {
    const progress = cubicProgress(0.7, 1, (fraction - 0.4) / (0.7 - 0.4));
    return -0.15 * (1 - progress) + progress * 1.2;
  }
  return 1;
}
