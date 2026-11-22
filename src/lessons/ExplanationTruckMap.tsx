import { useId } from 'react';
import type { Cell, GridMap } from '../interactives/grid';
import type { GridPlaybackFrame } from '../interactives/grid/useGridPlayback';
import { DeliveryMarker, TruckCursor } from '../interactives/DeliveryDrawing';
import { clamp, ease, mixColor } from '../interactives/gridAppearance';
import { cubicProgress, moveProgress, turnProgress } from '../interactives/gridMotion';

export function ExplanationTruckMap({ map, frame, stepMs, roadLayout }: {
  map: GridMap; frame: GridPlaybackFrame; stepMs: number; roadLayout?: 'perimeter';
}) {
  const filterId = useId();
  const width = map.width * 32 + 12, height = map.height * 32 + 12;
  const { current, previous } = frame, before = previous ?? current;
  const fraction = clamp(frame.visualElapsedMs / stepMs);
  const move = moveProgress(fraction), turn = turnProgress(fraction);
  const cursor = { x: before.position.x + (current.position.x - before.position.x) * move,
    y: before.position.y + (current.position.y - before.position.y) * move };
  const angle = (before.heading + (current.heading - before.heading) * turn) * Math.PI / 2;
  const point = (cell: Cell) => ({ x: 22 + cell.x * 32, y: height - 22 - cell.y * 32 });
  const collection = (goal: Cell) => {
    const has = (cells: readonly Cell[] = []) => Number(cells.some(c => c.x === goal.x && c.y === goal.y));
    const start = has(before.delivered);
    return start + (has(current.delivered) - start) * fraction;
  };
  const markerColor = (goal: Cell) => mixColor([69, 109, 255], [55, 92, 227], ease(collection(goal)));
  const near = map.goals.map(goal => ({ goal, proximity: clamp(1 - Math.hypot(cursor.x - goal.x, cursor.y - goal.y) / .2) })).find(c => c.proximity > 0);
  const pulse = near ? collection(near.goal) : 0;
  const cells = Array.from({ length: map.width * map.height }, (_, i) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
  const edge = (cell: Cell) => cell.x === 0 || cell.y === 0 || cell.x === map.width - 1 || cell.y === map.height - 1;
  const nodes = roadLayout === 'perimeter' ? cells.filter(edge) : cells;
  const trail = [cursor, ...current.visited];
  const head = point(cursor), start = point(map.start.position);
  return <svg width={width} height={height} overflow="visible" className="grid-board" role="img" aria-label="Delivery map">
    {nodes.flatMap(cell => [
      ...(cell.x + 1 < map.width ? [[cell, { x: cell.x + 1, y: cell.y }]] : []),
      ...(cell.y + 1 < map.height ? [[cell, { x: cell.x, y: cell.y + 1 }]] : []),
    ]).filter(([a, b]) => roadLayout !== 'perimeter'
      || (a.x === b.x ? a.x === 0 || a.x === map.width - 1 : a.y === 0 || a.y === map.height - 1))
      .map(([a, b], i) => <polyline key={i} points={`${point(a).x},${point(a).y} ${point(b).x},${point(b).y}`}
      fill="none" stroke="#b1c2d2" strokeWidth="4"
      strokeLinecap={map.width > 1 && map.height > 1 ? 'square' : 'butt'} />)}
    {nodes.filter(c => c.x !== map.start.position.x || c.y !== map.start.position.y)
      .map(c => <circle key={`${c.x},${c.y}`} cx={point(c).x} cy={point(c).y} r="3" fill="#778592" />)}
    {trail.length > 1 && <polyline points={trail.map(c => `${point(c).x},${point(c).y}`).join(' ')}
      fill="none" stroke="#383838" strokeWidth="2" />}
    {current.visited.slice().reverse().slice(1).map((c, i) =>
      <circle key={i} cx={point(c).x} cy={point(c).y} r="3" fill="black" />)}
    <polygon points="-2,-2 2,-2 2,2 -2,2" fill="black" transform={`translate(${start.x} ${start.y}) rotate(-45)`} />
    {map.goals.map(goal => <DeliveryMarker key={`${goal.x},${goal.y}`} {...point(goal)}
      amount={ease(collection(goal))} color={markerColor(goal)} />)}
    <TruckCursor {...head} angle={angle}
      color={mixColor([69, 109, 255], [116, 145, 255], ease(1 - Math.abs(2 * pulse - 1)))}
      ringRadius={8 + 10 * cubicProgress(0, 0, pulse)}
      ringOpacity={cubicProgress(1, 1, (1 - pulse) / .34)} />
    {near && <DeliveryMarker x={point(near.goal).x + (2 + 8 * near.proximity) / Math.SQRT2 + near.goal.x * near.proximity}
      y={point(near.goal).y - (2 + 8 * near.proximity) / Math.SQRT2 - near.goal.y * near.proximity}
      amount={ease(collection(near.goal))} color={markerColor(near.goal)} />}
    <defs><filter id={filterId} x="-100%" y="-100%" width="300%" height="300%"
      filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      <feBlend in="SourceGraphic" mode="normal" result="shape" />
      <feColorMatrix in="SourceAlpha" type="matrix"
        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
      <feMorphology radius="0" operator="dilate" in="SourceAlpha" />
      <feOffset dx="0" dy="4" /><feGaussianBlur stdDeviation="12" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
      <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
      <feBlend in2="shape" mode="normal" />
    </filter></defs>
    <g filter={`url(#${filterId})`} />
  </svg>;
}
