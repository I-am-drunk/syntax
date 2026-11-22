import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { GridBoard } from './GridBoard';
import type { GridArtwork } from './GridBoard';
import { initialState, isReady, run, runRepeated } from './grid';
import type { Command, GoalMode, GridMap, GridRun } from './grid';
import { GRID_STEP_MS, useGridPlayback } from './grid/useGridPlayback';
import './gridView.css';

export type GridControls = { canCheck: boolean; canReset: boolean };
export type GridProblemHandle = { check(): boolean; startOver(): void; retry(): void };
type Props = {
  map: GridMap; bank: readonly Command[]; slotCount: number; artwork: GridArtwork;
  /** Row diagnostics, and the answer when grading is reference-program. */
  referenceProgram: readonly Command[];
  initialProgram?: readonly Command[];
  grading?: GoalMode | 'reference-program';
  stepMs?: number;
  repeatCount?: 3 | 4 | 5;
  active: boolean; onControls(controls: GridControls): void;
  onResult(result: GridRun): void;
  onSound?(cue: 'drag-started' | 'drag-released'): void;
};
type Source = { kind: 'bank' | 'line'; index: number };
type PlacedItem = Command | number | null;
type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };
type Move = { command: Command; source: Source; from: Box; to: Box };
type Gesture = {
  kind: 'pressed' | 'dragging'; source: Source; command: Command;
  start: Point; point: Point; box: Box; pointerId: number;
  targets: { source: Source; rect: Box }[];
};
type Settling = { kind: 'settling'; moves: Move[]; next: PlacedItem[]; started: boolean; destination: Source | null };
type Transient = Gesture | Settling | null;
const label = (command: Command, robot = false) => command === 'deliver' ? robot ? ['collect', 'gem'] : ['deliver', 'package']
  : command === 'forward' ? [robot ? 'move' : 'drive', 'forward'] : ['turn', command];
const key = (source: Source) => source.kind + '-' + source.index;
const equalSource = (a: Source, b: Source) => a.kind === b.kind && a.index === b.index;

function CommandLabel({ command, robot = false }: { command: Command; robot?: boolean }) {
  const [verb, direction] = label(command, robot);
  return <span className="grid-command-label"><strong>{verb}</strong><span>{direction}</span></span>;
}

function RowMark({ kind }: { kind: 'success' | 'match' | 'mismatch' }) {
  return <div className="grid-row-mark" data-kind={kind} aria-hidden="true">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path fill="white" d={kind === 'mismatch'
        ? 'M6 4.62069L2.37931 1L1 2.37931L4.62069 6L1 9.62069L2.37931 11L6 7.37931L9.62069 11L11 9.62069L7.37931 6L11 2.37931L9.62069 1L6 4.62069Z'
        : 'M12 3.00002L10.5882 1.58826L4.58824 7.58826L1.41176 4.41178L0 5.82354L4.58827 10.4117L12 3.00002Z'} />
    </svg>
  </div>;
}

function RepeatHeader({ count }: { count: number }) {
  return <div className="grid-repeat-header" aria-description={`repeat ${count} times`}>
    <div className="grid-repeat-face">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.5 3H13V9M13 9L10.5 6.5M13 9L15.5 6.5" stroke="currentColor" />
        <path d="M14 13L3.5 13L3.5 7M3.5 7L6 9.5M3.5 7L1 9.5" stroke="currentColor" />
      </svg>
      <strong>repeat</strong><span>{count}</span><span>times</span>
    </div>
  </div>;
}

function RunControl({ stop, onClick }: { stop: boolean; onClick(): void }) {
  return <div className="grid-run-controls"
    aria-description={stop ? 'Stop the running program' : 'Run the program'}>
    <button type="button" className="grid-run" onClick={onClick}>
      <span className="grid-run-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fill="currentColor" d={stop ? 'M15 15L1 15L1 1L15 1L15 15Z'
            : 'M3 0.233887L15.9437 8.00008L3 15.7663V0.233887Z'} />
        </svg>
      </span>
      <span>{stop ? 'Stop' : 'Run'}</span>
    </button>
  </div>;
}

export const GridProblem = forwardRef<GridProblemHandle, Props>(function GridProblem(props, ref) {
  const { map, bank, slotCount, artwork, referenceProgram, active, onControls, onResult, onSound } = props;
  const { initialProgram, grading = 'visited-goals', stepMs = GRID_STEP_MS, repeatCount } = props;
  const robot = artwork === 'robot';
  const preset = initialProgram !== undefined;
  if (initialProgram && (bank.length || initialProgram.length !== slotCount)) throw new Error('Invalid preset editor configuration');
  const initialOrder = (): PlacedItem[] => initialProgram?.map((_, index) => index) ?? Array(slotCount).fill(null);
  const commandFor = (item: PlacedItem): Command | null => typeof item === 'number' ? initialProgram![item] : item;
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [slots, setSlots] = useState<PlacedItem[]>(initialOrder);
  const slotsRef = useRef(slots);
  const program = () => slotsRef.current.map(commandFor);
  const changed = () => preset ? slotsRef.current.some((item, index) => item !== index) : slotsRef.current.some(Boolean);
  const evaluate = (): GridRun => {
    const commands = program(), goals = grading === 'delivered-goals' ? 'delivered-goals' : 'visited-goals';
    const value = repeatCount ? runRepeated(map, commands, repeatCount, goals) : run(map, commands, goals);
    if (grading !== 'reference-program' || value.status === 'not-ready' || value.states.at(-1)?.failure) return value;
    const correct = commands.length === referenceProgram.length && commands.every((command, index) => command === referenceProgram[index]);
    return { ...value, status: correct ? 'correct' : 'incorrect' };
  };
  const [presetLocked, setPresetLocked] = useState(false);
  const [transient, setTransient] = useState<Transient>(null);
  const transientRef = useRef<Transient>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const activeRef = useRef(active);
  const deferredCommit = useRef<(() => void) | null>(null);
  const running = useRef(false);
  const [result, setResult] = useState<GridRun | null>(null);
  const playback = useGridPlayback({ initial: initialState(map), active, stepMs, onResult(value) {
    if (preset && value.status === 'correct') setPresetLocked(true);
    running.current = false; setResult(value); onResult(value);
  } });
  const changeTransient = (value: Transient) => {
    transientRef.current = value; setTransient(value);
  };
  const cancelEdit = () => {
    generation.current += 1;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null; deferredCommit.current = null; changeTransient(null);
  };
  const resetPlayback = () => {
    running.current = false; playback.stop(); setResult(null);
  };
  useImperativeHandle(ref, () => ({
    check() {
      if (!active || running.current || !isReady(program())) return false;
      setResult(null);
      const accepted = playback.start(evaluate());
      running.current = accepted; return accepted;
    },
    startOver() {
      if (!active || !changed()) return;
      cancelEdit(); resetPlayback();
      setPresetLocked(false);
      slotsRef.current = initialOrder(); setSlots(slotsRef.current);
    },
    retry: resetPlayback,
  }));
  useLayoutEffect(() => {
    const node = root.current!;
    const resize = () => setWidth(node.getBoundingClientRect().width - 4);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => {
      observer.disconnect(); generation.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);
  const canCheck = isReady(slots.map(commandFor)) && (!preset || changed()) && playback.frame.phase !== 'running';
  const canReset = changed();
  const published = useRef<GridControls | null>(null);
  useLayoutEffect(() => {
    if (!active || deferredCommit.current) { published.current = null; return; }
    if (published.current?.canCheck === canCheck && published.current.canReset === canReset) return;
    published.current = { canCheck, canReset }; onControls(published.current);
  }, [active, canCheck, canReset, onControls]);
  useLayoutEffect(() => {
    activeRef.current = active;
    if (active && deferredCommit.current) {
      const apply = deferredCommit.current; deferredCommit.current = null; apply();
    }
  }, [active]);
  const box = (source: Source): Box => {
    const origin = root.current!.getBoundingClientRect();
    const node = root.current!.querySelector<HTMLElement>('[data-grid-location="' + key(source) + '"]')!;
    const rect = node.getBoundingClientRect();
    return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
  };
  const settle = (gesture: Gesture, destination: Source) => {
    const from = gesture.source, next = [...slotsRef.current];
    const item = from.kind === 'line' ? next[from.index] : gesture.command;
    const measured = (source: Source) =>
      gesture.targets.find(target => equalSource(target.source, source))!.rect;
    const home = { kind: 'bank', index: bank.indexOf(gesture.command) } as const;
    const to = destination.kind === 'bank' ? home : destination;
    const moves: Move[] = [];
    if (from.kind === 'line') next[from.index] = null;
    if (to.kind === 'line') {
      const displaced = next[to.index];
      if (displaced !== null) {
        const returnTo: Source = from.kind === 'line' ? from
          : { kind: 'bank', index: bank.indexOf(commandFor(displaced)!) };
        if (returnTo.kind === 'line') next[returnTo.index] = displaced;
        moves.push({ command: commandFor(displaced)!, source: to, from: measured(to), to: measured(returnTo) });
      }
      next[to.index] = item;
    }
    const fromBox = { ...gesture.box };
    if (gesture.kind === 'dragging') {
      fromBox.x += gesture.point.x - gesture.start.x;
      fromBox.y += gesture.point.y - gesture.start.y - 8;
    }
    moves.push({ command: gesture.command, source: from, from: fromBox, to: measured(to) });
    const token = ++generation.current;
    changeTransient({ kind: 'settling', moves, next, started: false,
      destination: gesture.kind === 'dragging' ? to : null });
    const commit = () => {
      if (token !== generation.current) return;
      timer.current = null;
      slotsRef.current = next; setSlots(next);
      changeTransient(null); resetPlayback();
    };
    timer.current = setTimeout(() => {
      if (token !== generation.current) return;
      if (activeRef.current) commit();
      else deferredCommit.current = commit;
    }, 250);
    onSound?.('drag-released');
  };
  const localPoint = (x: number, y: number): Point => {
    const rect = root.current!.getBoundingClientRect();
    return { x: x - rect.x, y: y - rect.y };
  };
  const press = (event: ReactPointerEvent, source: Source, command: Command) => {
    if (!active || running.current || presetLocked || result?.status === 'correct'
      || transientRef.current || event.button !== 0) return;
    event.preventDefault();
    // The reference starts mouse gestures with integer MouseEvent coordinates.
    const point = event.pointerType === 'mouse'
      ? localPoint(Math.floor(event.clientX), Math.floor(event.clientY))
      : localPoint(event.clientX, event.clientY);
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = root.current!.getBoundingClientRect();
    const sources: Source[] = [
      ...bank.map((_, index) => ({ kind: 'bank' as const, index })),
      ...slotsRef.current.map((_, index) => ({ kind: 'line' as const, index })),
    ];
    sources.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
    changeTransient({ kind: 'pressed', source, command, start: point, point,
      targets: sources.map(source => ({ source, rect: box(source) })),
      pointerId: event.pointerId, box: { x: rect.x - origin.x, y: rect.y - origin.y,
        width: rect.width, height: rect.height } });
  };
  const movePointer = (event: PointerEvent) => {
    const state = transientRef.current;
    if (!state || state.kind === 'settling' || state.pointerId !== event.pointerId) return;
    const point = localPoint(event.clientX, event.clientY);
    const distance = Math.hypot(point.x - state.start.x, point.y - state.start.y);
    const kind = state.kind === 'dragging' || distance > 5 ? 'dragging' : 'pressed';
    changeTransient({ ...state, kind, point });
    if (state.kind === 'pressed' && kind === 'dragging') onSound?.('drag-started');
  };
  const dropTarget = (gesture: Gesture): Source | null => {
    const tile = { ...gesture.box,
      x: gesture.box.x + gesture.point.x - gesture.start.x,
      y: gesture.box.y + gesture.point.y - gesture.start.y };
    let best: Source | null = null, area = 0;
    for (const { source, rect } of gesture.targets) {
      const overlap = Math.max(0, Math.min(tile.x + tile.width, rect.x + rect.width) - Math.max(tile.x, rect.x))
        * Math.max(0, Math.min(tile.y + tile.height, rect.y + rect.height) - Math.max(tile.y, rect.y));
      if (overlap > area) { best = source; area = overlap; }
    }
    return best;
  };
  const releasePointer = (event: PointerEvent) => {
    const state = transientRef.current;
    if (!state || state.kind === 'settling' || state.pointerId !== event.pointerId) return;
    const gesture = { ...state, point: localPoint(event.clientX, event.clientY) };
    if (state.kind === 'dragging') {
      const target = dropTarget(gesture);
      if (target) settle(gesture, target);
      else changeTransient(null);
      return;
    }
    const destination: Source = state.source.kind === 'line'
      ? { kind: 'bank', index: bank.indexOf(state.command) }
      : { kind: 'line', index: slotsRef.current.indexOf(null) };
    if (destination.index < 0) { cancelEdit(); return; }
    settle(gesture, destination);
  };
  useLayoutEffect(() => {
    if (!active) {
      if (transientRef.current && transientRef.current.kind !== 'settling') cancelEdit();
      return;
    }
    const cancelPointer = (event: PointerEvent) => {
      const state = transientRef.current;
      if (state && state.kind !== 'settling' && state.pointerId === event.pointerId) cancelEdit();
    };
    document.addEventListener('pointermove', movePointer);
    document.addEventListener('pointerup', releasePointer);
    document.addEventListener('pointercancel', cancelPointer);
    return () => {
      document.removeEventListener('pointermove', movePointer);
      document.removeEventListener('pointerup', releasePointer);
      document.removeEventListener('pointercancel', cancelPointer);
    };
  });
  const moves: Move[] = transient?.kind === 'settling' ? transient.moves : [];
  useLayoutEffect(() => {
    const pending = transientRef.current;
    if (!active || pending?.kind !== 'settling' || pending.started) return;
    for (const node of root.current!.querySelectorAll('.grid-settling')) {
      void getComputedStyle(node).transform;
    }
    const token = generation.current;
    const frame = requestAnimationFrame(() => {
      if (activeRef.current && token === generation.current && transientRef.current === pending) {
        changeTransient({ ...pending, started: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, transient]);
  const moving = (source: Source) => moves.some(move => equalSource(move.source, source))
    || (transient?.kind === 'dragging' && equalSource(transient.source, source));
  const destination = transient?.kind === 'dragging' ? dropTarget(transient)
    : transient?.kind === 'settling' ? transient.destination : null;
  const selected = (source: Source) => destination && equalSource(source, destination);
  const successful = result?.status === 'correct';
  const readOnly = playback.frame.phase === 'running' || successful || presetLocked;
  const activeRow = playback.frame.phase === 'running'
    ? repeatCount ? playback.frame.sourceRow ?? null : playback.frame.logicalIndex : null;
  const feedback = (index: number) => !result || playback.frame.phase !== 'finished' ? null : result.status === 'correct'
    ? 'success' : commandFor(slots[index]) === referenceProgram[index] ? 'match' : 'mismatch';
  const tile = (source: Source, command: Command) =>
    <div className="grid-tile" data-grid-tile={key(source)} data-grid-item={preset && source.kind === 'line' ? slots[source.index] : undefined}
      data-read-only={readOnly}
      aria-description={label(command, robot).join(' ')}
      style={{ opacity: source.kind === 'line' ? moving(source) ? 0 : selected(source) ? 0.5 : 1 : undefined }}
      onPointerDown={event => press(event, source, command)}>
      <div className="grid-tile-face"><CommandLabel robot={robot} command={command} /></div>
    </div>;
  return <div ref={root} className="grid-problem" data-phase={playback.frame.phase}>
    <div className="grid-shell">
      <div className="grid-visual">{width > 0 &&
        <GridBoard map={map} width={width} frame={playback.frame} artwork={artwork} result={result}
          stepMs={stepMs} delivery={grading === 'delivered-goals'} />}</div>
      <div className="grid-editor" aria-label="Program">
        {activeRow !== null && <div className="grid-active-row" aria-hidden="true"
          style={{ top: 11 + activeRow * 42 }} />}
        <div className="grid-lines">
          <div className="grid-line-numbers">{Array.from({ length: slots.length + (repeatCount ? 1 : 0) }, (_, index) => {
            const mark = repeatCount && index === 0 ? null : feedback(index - (repeatCount ? 1 : 0));
            return <div className="grid-line-number" key={index}
              data-active={activeRow === index} data-feedback={mark}>
              <span style={{ opacity: mark ? 0 : 1 }}>{index + 1}</span>
              {mark && <RowMark kind={mark} />}
            </div>;
          })}</div>
          <div className="grid-slots" data-repeat={!!repeatCount}>
            {repeatCount && <RepeatHeader count={repeatCount} />}
            {repeatCount && <div className="grid-repeat-line" aria-hidden="true" />}
            {slots.map((item, index) => {
            const command = commandFor(item);
            const source: Source = { kind: 'line', index };
            const mark = feedback(index);
            return <div className="grid-slot" key={index} data-grid-location={key(source)}
              aria-description={command ? label(command, robot).join(' ') + ' (student placed)'
                + (mark ? mark === 'mismatch' ? ' (❌)' : ' (✅)' : '') : undefined}>
              {command ? <>
                {!readOnly && <div className="grid-slot-backdrop" data-selected={!!selected(source)} />}
                {tile(source, command)}
              </> : <div className="grid-slot-empty" data-selected={!!selected(source)} />}
            </div>;
          })}</div>
        </div>
        {activeRow !== null && <div className="grid-active-arrow" aria-hidden="true"
          style={{ top: 21 + activeRow * 42 }}>
          <svg width="19" height="22" viewBox="0 0 19 22" fill="none">
            <path fill="currentColor" d="M18 9.26795C19.3333 10.0378 19.3333 11.9623 18 12.7321L3 21.3923C1.66667 22.1621 8.49539e-07 21.1999 9.16837e-07 19.6603L1.67394e-06 2.33975C1.74124e-06 0.800144 1.66667 -0.162106 3 0.607695L18 9.26795Z" />
          </svg>
        </div>}
      </div>
    </div>
    {successful ? <RunControl stop={false} onClick={() => {
      if (active) running.current = playback.start(evaluate());
    }} /> : preset ? playback.frame.phase === 'running' &&
      <div className="grid-bank-region"><div className="grid-stop-overlay">
        <RunControl stop onClick={() => { if (active) resetPlayback(); }} />
      </div></div>
    : <div className="grid-bank-region">
      <div style={{ opacity: playback.frame.phase === 'running' ? 0 : 1 }}>
      <div className="grid-bank">{bank.map((command, index) => {
      const source: Source = { kind: 'bank', index };
      return <div key={index} className="grid-bank-slot" data-grid-location={key(source)}>
        <div className="grid-bank-copy" aria-hidden="true">
          <div className="grid-tile-face"><CommandLabel robot={robot} command={command} /></div>
        </div>
        {tile(source, command)}
      </div>;
      })}</div>
      </div>
      {playback.frame.phase === 'running' && <div className="grid-stop-overlay">
        <RunControl stop onClick={() => { if (active) resetPlayback(); }} />
      </div>}
    </div>}
    {moves.map((move, index) => <div className="grid-floating grid-settling"
      data-started={transient?.kind === 'settling' && transient.started}
      key={generation.current + '-' + index} style={{
        left: move.to.x, top: move.to.y, width: move.from.width,
        '--move-x': (move.from.x - move.to.x) + 'px',
        '--move-y': (move.from.y - move.to.y) + 'px',
      } as CSSProperties}>
      <div className="grid-tile-face"><CommandLabel robot={robot} command={move.command} /></div>
    </div>)}
    {transient?.kind === 'dragging' && <div className="grid-floating"
      style={{ left: transient.box.x + transient.point.x - transient.start.x,
        top: transient.box.y + transient.point.y - transient.start.y - 8,
        width: transient.box.width }}>
      <div className="grid-tile-face"><CommandLabel robot={robot} command={transient.command} /></div>
    </div>}
  </div>;
});
