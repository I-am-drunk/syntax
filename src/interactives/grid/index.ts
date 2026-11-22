import type { Cell, Command, Cursor, GoalMode, GridFailure, GridMap, GridRun, GridState, MapResult } from './types.js';
export type { Cell, Command, Cursor, GoalMode, GridFailure, GridMap, GridRun, GridState, MapResult } from './types.js';

const headings: Readonly<Record<string, number>> = { '>': 0, '^': 1, '<': 2, v: 3, V: 3 };
const directions: readonly Cell[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const isCommand = (value: unknown): value is Command =>
  value === 'forward' || value === 'left' || value === 'right' || value === 'deliver';

/** Only the observed map alphabet is supported. Coordinates increase upward. */
export function parseMap(text: string): MapResult {
  const rows = text.trim().split(/\r?\n/).map(row => row.trim());
  const width = rows[0].length;
  if (!width || rows.some(row => row.length !== width)) {
    return { ok: false, error: 'A grid must contain nonempty rows of equal width.' };
  }
  let start: Cursor | undefined;
  const goals: Cell[] = [];
  for (let row = 0; row < rows.length; row += 1) {
    for (let x = 0; x < width; x += 1) {
      const symbol = rows[row][x];
      const position = { x, y: rows.length - row - 1 };
      if (symbol === 'X') goals.push(position);
      else if (Object.hasOwn(headings, symbol)) {
        if (start) return { ok: false, error: 'A grid must have exactly one starting cursor.' };
        start = { position, heading: headings[symbol] };
      } else if (symbol !== '.') {
        return { ok: false, error: `Unsupported grid symbol ${JSON.stringify(symbol)} at row ${row + 1}, column ${x + 1}.` };
      }
    }
  }
  if (!start) return { ok: false, error: 'A grid must have exactly one starting cursor.' };
  if (!goals.length) return { ok: false, error: 'A grid must have at least one delivery goal.' };
  return { ok: true, map: { width, height: rows.length, start, goals } };
}

/** Both starting over and replaying begin with no visited cells. */
export function initialState(map: GridMap): GridState {
  return { position: { ...map.start.position }, heading: map.start.heading, visited: [], failure: null };
}

export function isReady(program: readonly (Command | null)[]): program is readonly Command[] {
  return program.length > 0 && Array.from(program).every(isCommand);
}

/** A command changes state before bounds checking, matching the reference. */
export function step(map: GridMap, state: GridState, command: Command): GridState {
  if (!isCommand(command)) throw new TypeError(`Unsupported grid command: ${String(command)}`);
  if (state.failure) return state;
  const position = { ...state.position };
  const visited = state.visited.map(cell => ({ ...cell }));
  let delivered = state.delivered?.map(cell => ({ ...cell }));
  let failure: GridFailure | null = null;
  let heading = state.heading;
  if (command === 'forward') {
    const direction = directions[((heading % 4) + 4) % 4];
    visited.unshift({ ...state.position });
    position.x += direction.x;
    position.y += direction.y;
  } else if (command === 'deliver') {
    if (!map.goals.some(goal => sameCell(goal, position))) failure = 'wrong-delivery';
    else if (delivered?.some(cell => sameCell(cell, position))) failure = 'duplicate-delivery';
    else delivered = [...(delivered ?? []), { ...position }];
  } else heading += command === 'left' ? 1 : -1;
  const outside = position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height;
  return { position, heading, visited, ...(delivered ? { delivered } : {}),
    failure: outside ? 'out-of-bounds' : failure };
}

/** The source checks three copies of the first repeating history prefix. */
function repeatedPrefix<T>(history: readonly T[], equal: (a: T, b: T) => boolean) {
  const next = history.slice(1).findIndex(value => equal(history[0], value));
  if (next < 0) return false;
  const period = next + 1;
  return history.length >= 3 * period && history.slice(0, 2 * period)
    .every((value, index) => equal(value, history[index + period]));
}

/** Goals are graded only after the entire program finishes safely. */
export function run(map: GridMap, program: readonly (Command | null)[], goals: GoalMode = 'visited-goals'): GridRun {
  for (const command of program) {
    if (command !== null && !isCommand(command)) {
      throw new TypeError(`Unsupported grid command: ${String(command)}`);
    }
  }
  let state = initialState(map);
  const states: GridState[] = [state];
  if (!isReady(program)) return { status: 'not-ready', states };
  for (const command of program) {
    state = step(map, state, command);
    states.push(state);
    if (goals === 'delivered-goals' && state.failure !== 'out-of-bounds') {
      const poses = states.slice().reverse();
      const loop = repeatedPrefix(poses, (a, b) => sameCell(a.position, b.position) && a.heading === b.heading)
        || repeatedPrefix([state.position, ...state.visited], sameCell);
      if (loop) { state = { ...state, failure: 'infinite-loop' }; states[states.length - 1] = state; }
    }
    if (state.failure) return { status: state.failure, states };
  }
  const visited = map.goals.every(goal => sameCell(goal, state.position)
    || state.visited.some(cell => sameCell(goal, cell)));
  if (goals === 'delivered-goals') {
    const delivered = map.goals.every(goal => state.delivered?.some(cell => sameCell(goal, cell)));
    return delivered ? { status: 'correct', states } : { status: 'incorrect', states,
      reason: visited ? 'visited-without-delivery' : 'missing-deliveries' };
  }
  return { status: visited ? 'correct' : 'incorrect', states };
}

/** The authored fixed loops enter once, then repeat only their body commands. */
export function runRepeated(map: GridMap, body: readonly (Command | null)[], count: 3 | 4 | 5,
  goals: GoalMode = 'delivered-goals'): GridRun {
  if (count !== 3 && count !== 4 && count !== 5) throw new TypeError('Unsupported fixed repeat count');
  const program = isReady(body) ? Array.from({ length: count }, () => body).flat() : body;
  const result = run(map, program, goals);
  if (result.status === 'not-ready') return result;
  const executed = result.states.length - 1;
  return { ...result, schedule: [
    { stateIndex: 0, rowIndex: 0, iteration: 0 },
    { stateIndex: 0, rowIndex: 1, iteration: 0 },
    ...Array.from({ length: executed }, (_, index) => {
      const stateIndex = index + 1, terminal = stateIndex === executed;
      return { stateIndex, rowIndex: terminal ? null : stateIndex % body.length + 1,
        iteration: Math.floor((terminal ? index : stateIndex) / body.length) };
    }),
  ] };
}
