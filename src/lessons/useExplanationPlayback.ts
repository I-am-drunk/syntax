import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { GridState } from '../interactives/grid';
import type { GridPlaybackFrame } from '../interactives/grid/useGridPlayback';
import type { GridPage } from './types';

export const EXPLANATION_STEP_MS = 600;
type Steps = NonNullable<GridPage['explanation']>['steps'];

export function explanationFrame(states: readonly GridState[], steps: Steps, position: number,
  durationMs = EXPLANATION_STEP_MS) {
  const group = Math.min(Math.floor(position), steps.length - 2);
  const start = steps[group].end, end = steps[group + 1].end;
  const command = start + (end - start) * (position - group);
  const index = Math.ceil(command), fraction = index === 0 ? 0 : command - index + 1;
  const stepMs = durationMs / (end - start);
  const frame: GridPlaybackFrame = {
    phase: fraction > 0 && fraction < 1 ? 'running' : 'finished',
    logicalIndex: index, previous: index > 0 ? states[index - 1] : null,
    current: states[index], visualElapsedMs: fraction * stepMs,
  };
  return { frame, stepMs };
}

/** Each mounted question retains its own position; hidden viewers do not tick. */
export function useExplanationPlayback(count: number, active: boolean, durationMs = EXPLANATION_STEP_MS,
  fixedStepMs?: number) {
  const model = useRef({ position: 0, destination: 0, remainder: 0 });
  const enabled = useRef(false);
  const [position, setPosition] = useState(0);
  const [destination, setDestination] = useState(0);
  useLayoutEffect(() => {
    enabled.current = active;
    return () => { enabled.current = false; };
  }, [active]);
  const move = useCallback((offset: -1 | 1) => {
    if (!enabled.current) return;
    const next = Math.max(0, Math.min(count - 1, model.current.destination + offset));
    model.current.destination = next;
    setDestination(next);
  }, [count]);
  useLayoutEffect(() => {
    if (!active || model.current.position === destination) return;
    let live = true, request = 0, previous = performance.now();
    const tick = (now: number) => {
      if (!live) return;
      const current = model.current;
      const elapsed = Math.max(0, now - previous);
      previous = now;
      const stepSeconds = fixedStepMs ? fixedStepMs / 1000 : 0;
      const total = elapsed / 1000 + current.remainder;
      const ticks = stepSeconds ? Math.floor(total / stepSeconds) : 1;
      current.remainder = stepSeconds ? total - ticks * stepSeconds : 0;
      const delta = stepSeconds ? stepSeconds / (durationMs / 1000) : elapsed / durationMs;
      for (let i = 0; i < ticks; i++) {
        const distance = current.destination - current.position;
        current.position = delta >= Math.abs(distance) ? current.destination
          : current.position + Math.sign(distance) * delta;
      }
      setPosition(current.position);
      if (current.position !== current.destination) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(request); };
  }, [active, destination, durationMs, fixedStepMs]);
  return { position, destination, index: Math.floor(position), move };
}
