import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { GridRun, GridState } from './types.js';

export const GRID_STEP_MS = 200;
const SETTLING_SECONDS = 10;

export type GridPlaybackFrame = Readonly<{
  phase: 'idle' | 'running' | 'finished';
  logicalIndex: number;
  sourceRow?: number | null;
  previous: GridState | null;
  current: GridState;
  visualElapsedMs: number;
}>;

type Playback = {
  frame: GridPlaybackFrame;
  scheduleIndex: number;
  run: GridRun | null;
  remainder: number;
  visualElapsed: number;
};

type Options = { initial: GridState; active: boolean; stepMs?: number; onResult: (run: GridRun) => void };

function fresh(initial: GridState, run: GridRun | null = null): Playback {
  return { run, scheduleIndex: 0, remainder: 0, visualElapsed: 0, frame: {
    phase: run ? 'running' : 'idle', logicalIndex: 0, previous: null,
    current: run?.states[0] ?? initial, visualElapsedMs: 0,
    ...(run?.schedule ? { sourceRow: run.schedule[0].rowIndex } : {}),
  } };
}

function advance(model: Playback, delta: number, stepSeconds: number): Playback {
  let frame = model.frame;
  let scheduleIndex = model.scheduleIndex;
  let remainder = model.remainder;
  let visualElapsed = model.visualElapsed + delta;
  if (frame.phase === 'running' && model.run) {
    const elapsed = delta + remainder;
    const steps = Math.floor(Math.min(6400, elapsed / stepSeconds));
    remainder = elapsed - steps * stepSeconds;
    if (steps > 0) {
      const states = model.run.states;
      const schedule = model.run.schedule;
      const last = (schedule?.length ?? states.length) - 1;
      scheduleIndex = Math.min(scheduleIndex + steps, last);
      const logicalIndex = schedule?.[scheduleIndex].stateIndex ?? scheduleIndex;
      const previousIndex = schedule?.[scheduleIndex - 1].stateIndex ?? logicalIndex - 1;
      frame = { ...frame, logicalIndex, previous: states[previousIndex],
        current: states[logicalIndex], phase: scheduleIndex === last ? 'finished' : 'running',
        ...(schedule ? { sourceRow: schedule[scheduleIndex].rowIndex } : {}) };
      visualElapsed = 0;
    }
  }
  return { ...model, scheduleIndex, remainder, visualElapsed,
    frame: { ...frame, visualElapsedMs: visualElapsed * 1000 } };
}

/** Retain this hook per asset. Inactive scenes suspend; Stop resets playback. */
export function useGridPlayback({ initial, active, stepMs = GRID_STEP_MS, onResult }: Options) {
  if (!Number.isFinite(stepMs) || stepMs <= 0) throw new Error('Invalid grid step duration');
  const initialRef = useRef(initial);
  const model = useRef(fresh(initialRef.current));
  const [frame, setFrame] = useState(model.current.frame);
  const mounted = useRef(false);
  const generation = useRef(0);
  const request = useRef<number | null>(null);
  const previousTime = useRef<number | null>(null);
  const resultCallback = useRef(onResult);

  const cancel = useCallback(() => {
    generation.current += 1;
    if (request.current !== null) cancelAnimationFrame(request.current);
    request.current = null;
    previousTime.current = null;
  }, []);

  const start = useCallback((run: GridRun): boolean => {
    if (!mounted.current || run.status === 'not-ready' || run.states.length < 2) return false;
    cancel();
    model.current = fresh(initialRef.current, run);
    setFrame(model.current.frame);
    return true;
  }, [cancel]);

  const stop = useCallback(() => {
    cancel();
    model.current = fresh(initialRef.current);
    if (mounted.current) setFrame(model.current.frame);
  }, [cancel]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);

  // Schedule after commit so a result handler can stop, hide or unmount first.
  useLayoutEffect(() => {
    resultCallback.current = onResult;
    if (!active) { cancel(); return; }
    const current = model.current;
    if (request.current !== null || current.frame.phase === 'idle'
      || (current.frame.phase === 'finished' && current.visualElapsed >= SETTLING_SECONDS)) return;
    const token = generation.current;
    previousTime.current ??= Date.now();
    const handle = requestAnimationFrame(() => {
      if (!mounted.current || token !== generation.current || request.current !== handle) return;
      request.current = null;
      const now = Date.now();
      const next = advance(model.current, (now - previousTime.current!) / 1000, stepMs / 1000);
      const completed = model.current.frame.phase === 'running' && next.frame.phase === 'finished';
      previousTime.current = now;
      model.current = next;
      setFrame(next.frame);
      if (completed && next.run) resultCallback.current(next.run);
    });
    request.current = handle;
  });

  return { frame, start, stop };
}
