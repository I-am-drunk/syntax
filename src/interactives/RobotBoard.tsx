import { useId } from 'react';
import type { GridMap, GridRun, Cell } from './grid';
import { Robot, Gem } from './RobotDrawing';
import type { GridPlaybackFrame } from './grid/useGridPlayback';
import { cubicProgress, moveProgress, turnProgress } from './gridMotion';
import { clamp, ease, colors, mixColor, collisionOffset, gridAppearance } from './gridAppearance';
import { GridWarning } from './GridWarning';
import { DeliveryWarning, PackageWarning } from './DeliveryWarning';
import { GridCompletion } from './GridCompletion';
const square = '-0.5,-0.5 0.5,-0.5 0.5,0.5 -0.5,0.5';
const dark = 'rgb(3.14% 5.88% 15.69%)', blue = 'rgb(27.06% 42.75% 100%)';
const lightBlue = 'rgb(67.06% 74.12% 100%)', visited = 'rgb(16.08% 29.41% 77.65%)';
export function RobotBoard({ map, width, frame, stepMs, bare = false, delivery = false, result = null }: {
  map: GridMap; width: number; frame: GridPlaybackFrame; stepMs: number; bare?: boolean; delivery?: boolean; result?: GridRun | null;
}) {
  const height = bare ? map.height * 30 + 60 : 216;
  const clip = useId(), cx = width / 2, cy = bare ? height / 2 : 130, size = 30;
  // The solvable map fits its half-cell padding inside a 16px inset.
  const cellSize = bare ? size : Math.min(size, (width - 32) / (map.width + 1), (height - 44 - 32) / (map.height + 1));
  const scale = cellSize / size;
  const { current, previous } = frame, start = previous ?? current;
  const fraction = clamp(frame.visualElapsedMs / stepMs), move = moveProgress(fraction), turn = turnProgress(fraction);
  const warning = cubicProgress(0, .3, clamp(fraction * 2));
  const collision = current.failure === 'out-of-bounds';
  const destination = collision ? start.position : current.position;
  const cursor = { x: start.position.x + (destination.x - start.position.x) * move,
    y: start.position.y + (destination.y - start.position.y) * move };
  const fromAngle = start.heading * .25 * (2 * Math.PI), toAngle = current.heading * .25 * (2 * Math.PI);
  const angle = start.heading === current.heading ? toAngle : fromAngle * (1 - turn) + turn * toAngle;
  const appearance = gridAppearance(frame,result,stepMs);
  const amount = delivery ? appearance.amount : collision && fraction > .99999 ? clamp(frame.visualElapsedMs / 330) : 0;
  const collected = (goal: Cell, eased = true) => {
    const has = (cells: readonly Cell[] | undefined) => Number(cells?.some(c=>c.x===goal.x&&c.y===goal.y)??false);
    const from=has(start.delivered), to=has(current.delivered);
    return from+(to-from)*(eased ? ease(fraction) : fraction);
  };
  const outcome = appearance.correct ? 'success' : appearance.fatal ? 'hard' : result?.status==='incorrect' ? 'incomplete' : 'none';
  const left = delivery ? Math.floor(map.goals.reduce((n,g)=>n+1-collected(g),0)) : map.goals.length;
  const trail = [cursor, ...current.visited];
  const point = (x: number, y: number) => [cx + (x - (map.width - 1) / 2) * size, cy - (y - (map.height - 1) / 2) * size];
  const matrix = (x: number, y: number) => `matrix(30 0 0 -30 ${x} ${y})`;
  const columns = 1 + 2 * Math.ceil(Math.ceil(width / cellSize) / 2);
  const rows = bare ? 7 : 1 + 2 * Math.ceil(Math.ceil((height - 44) / cellSize) / 2);
  const cells = Array.from({ length: map.width * map.height }, (_, i) => [i % map.width, map.height - 1 - Math.floor(i / map.width)]);
  const [sx, sy] = point(map.start.position.x, map.start.position.y);
  const [px, py] = point(cursor.x, cursor.y), offset = collision ? collisionOffset(fraction) : { x: 0, y: 0 };
  const head = [px + offset.x * Math.cos(angle) - offset.y * Math.sin(angle), py - offset.x * Math.sin(angle) - offset.y * Math.cos(angle)];
  const near = map.goals.map(goal => ({ goal, proximity: clamp(1 - Math.hypot(cursor.x - goal.x, cursor.y - goal.y) / .2) })).find(g => g.proximity > 0);
  const moving = start.position.x !== current.position.x || start.position.y !== current.position.y;
  const bounds = { transform: matrix(cx, cy), x: -map.width / 2, y: -map.height / 2, width: map.width, height: map.height, rx: .2, ry: .2, vectorEffect: 'non-scaling-stroke' };
  return <svg width={width} height={height}
    overflow={bare ? 'hidden' : 'visible'} className="grid-board" aria-label="Robot and gem map">
    <g transform={scale === 1 ? undefined : `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}>
    {!bare && Array.from({ length: columns * rows }, (_, i) => <polygon key={i} points={square} fill={dark}
      stroke="rgb(7.84% 14.51% 38.82%)" strokeWidth="1" vectorEffect="non-scaling-stroke"
      transform={matrix(cx + (i % columns - (columns - 1) / 2 + (delivery && map.width % 2 === 0 ? .5 : 0)) * size,
        cy + (Math.floor(i / columns) - (rows - 1) / 2 - (delivery && map.height % 2 === 0 ? .5 : 0)) * size)} />)}
    <rect {...bounds} fill="none" stroke={lightBlue} strokeWidth="10" />
    <defs><mask id={clip} maskUnits="userSpaceOnUse"><rect {...bounds} fill="white" /></mask></defs>
    <g mask={`url(#${clip})`}>
      {cells.map(([x, y]) => <polygon key={`${x},${y}`} points={square} fill={dark} stroke={blue} strokeWidth="1"
        vectorEffect="non-scaling-stroke" transform={matrix(...point(x, y) as [number, number])} />)}
      {current.visited.map((cell, i) => <polygon key={i} points={square} fill={visited} stroke={blue} strokeWidth="1" vectorEffect="non-scaling-stroke" transform={matrix(...point(cell.x, cell.y) as [number, number])} />)}
      {!collision && <polygon points={square} fill={visited} stroke={blue} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={moving ? ease(fraction) : 1} transform={matrix(...point(current.position.x, current.position.y) as [number, number])} />}
      {trail.length > 1 && <polyline points={trail.map(cell => point(cell.x, cell.y).join(',')).join(' ')} fill="none" stroke={blue} strokeWidth="3" vectorEffect={scale === 1 ? undefined : 'non-scaling-stroke'} />}
      <rect x={sx - 4} y={sy - 4} width="8" height="8" rx="2" fill={blue} transform={`rotate(-45 ${sx} ${sy})`} />
    </g>
    <rect {...bounds} fill="none" stroke={blue} strokeWidth="2" />
    {map.goals.map(({ x, y }) => <Gem key={`${x},${y}`} x={point(x, y)[0]} y={point(x, y)[1]} amount={ease(amount)}
      collection={delivery ? collected({x,y}) : undefined} outcome={outcome} fixedCheckStroke={scale !== 1} />)}
    <Robot x={head[0]} y={head[1]} angle={angle} amount={amount} palette={delivery && !appearance.fatal ? 1 : 2}
      pulse={delivery && near ? ease(1-Math.abs(2*clamp(collected(near.goal,false)/.8)-1)) : 0} />
    {near && <g opacity={delivery && current.failure==='duplicate-delivery' ? 1-ease(fraction) : 1}>
      <Gem secondary x={point(near.goal.x, near.goal.y)[0] + 18 / Math.SQRT2 * (.5 + .5 * near.proximity)}
      y={point(near.goal.x, near.goal.y)[1] - 18 / Math.SQRT2 * (.5 + .5 * near.proximity)} scale={near.proximity} amount={ease(amount)}
      collection={delivery ? collected(near.goal) : undefined} outcome={outcome} fixedCheckStroke={scale !== 1} /></g>}
    {delivery && (current.failure==='wrong-delivery'||current.failure==='duplicate-delivery') &&
      <PackageWarning map x={head[0]+19.8*warning/Math.SQRT2}
        y={head[1]-19.8*warning/Math.SQRT2} scale={1.25*warning/scale} color="black" face="#f7c325" />}
    </g>
    {!bare && <>
    <rect width={width} height="44" fill={delivery ? appearance.hud : mixColor(colors.white, colors.warning, amount)} stroke="rgb(89.8% 89.8% 89.8%)" strokeWidth="2" />
    <g opacity={delivery ? appearance.counterOpacity : 1 - ease(amount)}>
    <Gem x={17.599999999999994} y={22} scale={14 / 15} />
    <text x={48.18197479248046} y={26.989999866485597} textAnchor="middle" fontFamily="CoFo Brilliant, sans-serif"
      fontSize="14" fontWeight="500" fill="black">{left} left</text>
    </g>
    {collision && <GridWarning color={mixColor(colors.black, colors.warningText, amount)} opacity={ease(amount)} />}
    {delivery && appearance.fatal && !collision && <DeliveryWarning loop={current.failure==='infinite-loop'}
      message={current.failure==='wrong-delivery'?'No gem to pick up here.':current.failure==='duplicate-delivery'?'Already picked up.':undefined}
      color={appearance.text} opacity={appearance.messageOpacity} />}
    {delivery && appearance.correct && <GridCompletion robot time={appearance.time} width={width} color={appearance.text} />}
    <path d={`M0 44 H${width}`} fill="none" stroke="rgb(89.8% 89.8% 89.8%)" strokeWidth="2" />
    </>}
  </svg>;
}
