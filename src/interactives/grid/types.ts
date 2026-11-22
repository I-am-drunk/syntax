export type Command = 'forward' | 'left' | 'right' | 'deliver';
export type GoalMode = 'visited-goals' | 'delivered-goals';
export type GridFailure = 'out-of-bounds' | 'wrong-delivery' | 'duplicate-delivery' | 'infinite-loop';
export type Cell = Readonly<{ x: number; y: number }>;
export type Cursor = Readonly<{
  position: Cell;
  /** Unwrapped quarter turns: east = 0, north = 1. */
  heading: number;
}>;
export type GridMap = Readonly<{
  width: number;
  height: number;
  start: Cursor;
  goals: readonly Cell[];
}>;
export type GridState = Cursor & Readonly<{
  /** Previous forward positions, newest first; excludes current position. */
  visited: readonly Cell[];
  /** Successful explicit deliveries. Absent before the first delivery. */
  delivered?: readonly Cell[];
  failure: GridFailure | null;
}>;
export type MapResult = { ok: true; map: GridMap } | { ok: false; error: string };
export type GridRun = Readonly<{
  status: 'not-ready' | 'correct' | 'incorrect' | GridFailure;
  reason?: 'visited-without-delivery' | 'missing-deliveries';
  /** Initial state followed by one state per executed command. */
  states: readonly GridState[];
  /** Fixed-repeat playback steps. Header entry consumes time without a new pose. */
  schedule?: readonly Readonly<{
    stateIndex: number;
    rowIndex: number | null;
    iteration: number;
  }>[];
}>;
