import { mixColor } from '../interactives/gridAppearance';
import type { GridPage } from './types';
type Explanation = NonNullable<GridPage['explanation']>;

export function explanationRowFactor(explanation: Explanation, position: number, row: number) {
  if (explanation.rowSegments) {
    const group = Math.min(Math.floor(position), explanation.rowSegments.length - 1);
    const { from, to } = explanation.rowSegments[group];
    const t = position - group;
    return from[row] * (1 - t) + to[row] * t;
  }
  if (explanation.rowEmphasis) {
    const endpoints = explanation.rowEmphasis;
    const group = Math.min(Math.floor(position), endpoints.length - 2);
    const t = position - group;
    return endpoints[group][row] * (1 - t) + endpoints[group + 1][row] * t;
  }
  const first = row < explanation.steps[1].end;
  return position < 1 ? first ? 1 : 1 - position
    : first ? 2 - position : position - 1;
}

export function explanationPaint(factor: number, normal: readonly [number, number, number]) {
  return mixColor([0, 0, 0], normal, factor).replace(')', ` / ${.3 + .7 * factor})`);
}
