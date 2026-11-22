import type { Cell, GridMap, GridRun } from './grid/types';
import type { GridPlaybackFrame } from './grid/useGridPlayback';
import { GRID_STEP_MS } from './grid/useGridPlayback';
import { moveProgress, turnProgress } from './gridMotion';
import { collisionOffset, ease, gridAppearance } from './gridAppearance';
import { GridCompletion } from './GridCompletion';
import { GridWarning } from './GridWarning';
import { RobotBoard } from './RobotBoard';
import { DeliveryMarker } from './DeliveryDrawing';
import { DeliveryWarning, PackageWarning } from './DeliveryWarning';

export type GridArtwork = 'mission-cove' | 'financial-district' | 'solitary-street' | 'botanical-district' | 'broadway' | 'fifth-avenue' | 'park-avenue' | 'canal-street' | 'market-district' | 'robot';
type Props = { map: GridMap; width: number; frame: GridPlaybackFrame; artwork: GridArtwork; result: GridRun | null; stepMs?: number; delivery?: boolean };
const blue = 'rgb(27.06% 42.75% 100%)';
const border = 'rgb(89.8% 89.8% 89.8%)';
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const matrix = (x: number, y: number, angle = 0) => {
  const c = Math.cos(angle), s = Math.sin(angle);
  return `matrix(${c} ${-s} ${-s} ${-c} ${x} ${y})`;
};

function DeliveryDot({ x, y, color = blue }: Cell & { color?: string }) {
  const shape = { transform: matrix(x, y), stroke: 'rgba(0,0,0,0)', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' } as const;
  return <g>
    <g opacity=".25"><circle {...shape} r="10" fill={color} /></g>
    <circle {...shape} r="6" fill="white" />
    <circle {...shape} r="4" fill={color} />
  </g>;
}

const remainingTextCenters = [58.08096923828125, 56.98197479248047, 57.70997009277343,
  57.835975646972656, 57.85697479248047, 57.69597778320312];

const signs = {
  'canal-street': { title: 'Canal', area: 'ST', width: 77.02196960449218,
    center: 485.48901519775393, titleX: 476.66201629638675, areaX: 507.6730010986329 },
  'market-district': { title: 'Market', area: 'DISTRICT', width: 119.1809341430664,
    center: 464.4095329284668, titleX: 439.3330474853515, areaX: 491.4235145568847 },
  'broadway': { title: 'Broadway', area: '', width: 88.57197265625,
    center: 479.714013671875, titleX: 479.714013671875, areaX: 0 },
  'fifth-avenue': { title: 'Fifth', area: 'AVE', width: 77.37793884277343,
    center: 485.31103057861327, titleX: 473.35203552246094, areaX: 504.5410049438476 },
  'park-avenue': { title: 'Park', area: 'AVE', width: 75.27793884277344,
    center: 486.3610305786133, titleX: 474.40203552246095, areaX: 504.54100494384767 },
  'mission-cove': { title: 'Mission', area: 'COVE', width: 105.28795013427734,
    center: 471.3560249328613, titleX: 455.47303619384763, areaX: 500.6170112609863 },
  'financial-district': { title: 'Financial', area: 'DISTRICT', width: 132.2848922729492,
    center: 457.85755386352537, titleX: 432.7810684204101, areaX: 491.4235145568847 },
  'solitary-street': { title: 'Solitary', area: 'ST', width: 91.77796020507813,
    center: 478.11101989746095, titleX: 469.2840209960938, areaX: 507.6730010986328 },
  'botanical-district': { title: 'Botanical', area: 'DISTRICT', width: 134.8889144897461,
    center: 456.55554275512696, titleX: 431.4790573120117, areaX: 491.4235145568848 },
};

function MapSign({ artwork, width }: { artwork: Exclude<GridArtwork, 'robot'>; width: number }) {
  const sign = signs[artwork];
  const shift = width - 536;
  return <g fontFamily="CoFo Brilliant, system-ui, sans-serif"
    fontWeight="700" textAnchor="middle">
    <rect transform={matrix(sign.center + shift, 22)} x={-sign.width / 2} y={-15.639999866485596}
      width={sign.width} height={31.27999973297119} rx="3" fill="none" stroke={border}
      vectorEffect="non-scaling-stroke" />
    <rect transform={matrix(sign.center + shift, 22)} x={-sign.width / 2 + 3} y={-12.639999866485596}
      width={sign.width - 6} height={25.27999973297119} rx="3" fill="none" stroke="rgb(55.29% 63.14% 70.59%)"
      vectorEffect="non-scaling-stroke" />
    <g transform={matrix(sign.titleX + shift, 27.504000186920166)}>
      <text transform="scale(1 -1)" fontSize="14" fill="rgb(29.02% 36.08% 42.75%)">{sign.title}</text>
    </g>
    {sign.area && <g transform={matrix(sign.areaX + shift, 23.52400016784668)}>
      <text transform="scale(1 -1)" fontSize="9" fill="rgb(46.67% 52.16% 57.25%)">{sign.area}</text>
    </g>}
    <polygon transform={matrix(sign.center + shift, 40.8199999332428)}
      points="-4,-3.180000066757202 4,-3.180000066757202 4,3.180000066757202 -4,3.180000066757202"
      fill={border} stroke="rgba(0,0,0,0)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </g>;
}

export function GridBoard({ map, width, frame, artwork, result, stepMs = GRID_STEP_MS, delivery = false }: Props) {
  if (artwork === 'robot') return <RobotBoard map={map} width={width} frame={frame} stepMs={stepMs} delivery={delivery} result={result} />;
  const { current, previous } = frame;
  const appearance = gridAppearance(frame, result, stepMs);
  const fraction = Math.max(0, Math.min(1, frame.visualElapsedMs / stepMs));
  const start = previous ?? current;
  const move = moveProgress(fraction), turn = turnProgress(fraction);
  const destination = appearance.collision ? start.position : current.position;
  const cursor = { x: start.position.x + (destination.x - start.position.x) * move,
    y: start.position.y + (destination.y - start.position.y) * move };
  const fromAngle = start.heading * 0.25 * (2 * Math.PI);
  const toAngle = current.heading * 0.25 * (2 * Math.PI);
  const angle = start.heading === current.heading ? toAngle : fromAngle * (1 - turn) + turn * toAngle;
  const point = (cell: Cell) => ({ x: width / 2 + (cell.x - (map.width - 1) / 2) * 42,
    y: 131 - (cell.y - (map.height - 1) / 2) * 42 });
  const origin = point({ x: 0, y: 0 }), head = point(cursor), initial = point(map.start.position);
  const offset = appearance.collision ? collisionOffset(fraction) : { x: 0, y: 0 };
  head.x += offset.x * Math.cos(angle) - offset.y * Math.sin(angle);
  head.y -= offset.x * Math.sin(angle) + offset.y * Math.cos(angle);
  const trail = [cursor, ...current.visited].filter((cell, index, all) =>
    index === 0 || !same(cell, all[index - 1]));
  const nearby = map.goals.map(goal => ({ goal, proximity: Math.max(0, 1 - Math.hypot(cursor.x - goal.x, cursor.y - goal.y) / 0.2) }))
    .find(value => value.proximity > 0);
  const cells = Array.from({ length: map.width * map.height }, (_, i) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
  const perimeter = (cell: Cell) => cell.x === 0 || cell.y === 0 || cell.x === map.width - 1 || cell.y === map.height - 1;
  const intersections = cells.filter(cell => artwork !== 'botanical-district' || perimeter(cell))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const edges = cells.flatMap(cell => [
    ...(cell.y < map.height - 1 ? [[cell, { x: cell.x, y: cell.y + 1 }]] : []),
    ...(cell.x < map.width - 1 ? [[cell, { x: cell.x + 1, y: cell.y }]] : []),
  ]).filter(([a, b]) => artwork !== 'botanical-district' || (perimeter(a) && perimeter(b)));
  const collected = (goal: Cell) => {
    if (!delivery) return 0;
    const from = Number(start.delivered?.some(cell => same(cell, goal)) ?? false);
    const to = Number(current.delivered?.some(cell => same(cell, goal)) ?? false);
    return from + (to - from) * ease(fraction);
  };
  const left = Math.floor(map.goals.reduce((total, goal) => total + 1 - collected(goal), 0));
  const pulse = nearby ? collected(nearby.goal) : 0;
  return <svg width={width} height="217" overflow="visible" className="grid-board"
    role="img" aria-label={`${map.width} by ${map.height} delivery map`}>
    <g opacity={appearance.backdropOpacity}>
      <g vectorEffect="non-scaling-stroke" transform={`matrix(${1 / 3} 0 0 ${-1 / 3} ${width / 2} 131)`}>
        <image width="1620" height="516" href={`/assets/grid/${artwork}.svg`}
          transform="scale(1 -1) translate(-810 -258)" />
      </g>
      {([['rgb(55.69% 63.53% 71.37%)', 8], ['rgb(69.41% 76.08% 82.35%)', 6]] as const).flatMap(([color, size]) =>
        edges.map(([a, b], i) => <polyline key={`${size}-${i}`} fill="rgba(0%,0%,0%,0)" stroke={color}
          strokeWidth={size} strokeLinecap={map.width > 1 && map.height > 1 ? 'square' : 'butt'} vectorEffect="non-scaling-stroke"
          transform={`matrix(42 0 0 -42 ${origin.x} ${origin.y})`} points={`${a.x},${a.y} ${b.x},${b.y}`} />))}
      {intersections.filter(cell => !same(cell, map.start.position)).map(cell => {
        const p = point(cell);
        return <circle key={`${cell.x},${cell.y}`} transform={matrix(p.x, p.y)} r="2"
          fill="rgb(46.67% 52.16% 57.25%)" stroke="rgba(0,0,0,0)" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
      })}
    </g>
    {trail.length > 1 && <polyline points={trail.map(cell => `${cell.x},${cell.y}`).join(' ')}
      transform={`matrix(42 0 0 -42 ${origin.x} ${origin.y})`} fill="none" stroke={appearance.trail}
      strokeWidth="3" vectorEffect="non-scaling-stroke" />}
    {current.visited.map((cell, index) => <circle key={index} transform={matrix(point(cell).x, point(cell).y)}
      r="2" fill={appearance.visited} stroke="rgba(0,0,0,0)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
    <polygon points="-2,-2 2,-2 2,2 -2,2" fill={appearance.visited}
      transform={matrix(initial.x, initial.y, Math.PI / 4)} />
    {map.goals.map(goal => delivery
      ? <DeliveryMarker key={`${goal.x},${goal.y}`} {...point(goal)} amount={collected(goal)} color={appearance.goal} />
      : <DeliveryDot key={`${goal.x},${goal.y}`} {...point(goal)} color={appearance.goal} />)}
    <g>
      <circle transform={matrix(head.x, head.y, angle)} r={8 + 10 * pulse}
        opacity={1 - Math.max(0, Math.min(1, (pulse - .66) / .34))}
        fill="none" stroke={blue} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <g opacity=".2"><circle transform={matrix(head.x, head.y, angle)} r="10" fill="none" stroke="black" strokeWidth="4" vectorEffect="non-scaling-stroke" /></g>
      <circle transform={matrix(head.x, head.y, angle)} r="10" fill="white" stroke="rgba(0,0,0,0)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polygon transform={matrix(head.x + Math.cos(angle), head.y - Math.sin(angle), angle)}
        points="6,0 -6,6 -4,0 -6,-6" fill={appearance.cursor} stroke="rgba(0,0,0,0)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </g>
    {nearby && (delivery ? <g opacity={current.failure === 'duplicate-delivery' ? 1 - ease(fraction) : 1}
      transform={`translate(${point(nearby.goal).x + (2 + 8 * nearby.proximity) / Math.SQRT2 + nearby.goal.x * nearby.proximity} ${point(nearby.goal).y - (2 + 8 * nearby.proximity) / Math.SQRT2 - nearby.goal.y * nearby.proximity})`}>
      <DeliveryMarker x={0} y={0} amount={collected(nearby.goal)} color={appearance.goal} />
    </g> : <DeliveryDot x={point(nearby.goal).x + (2 + 8 * nearby.proximity) / Math.SQRT2}
      y={point(nearby.goal).y - (2 + 8 * nearby.proximity) / Math.SQRT2 - nearby.proximity} color={appearance.goal} />)}
    {delivery && (current.failure === 'wrong-delivery' || current.failure === 'duplicate-delivery') &&
      <PackageWarning map x={head.x + (2 + 14 * Math.min(1, fraction * 2)) / Math.SQRT2}
        y={head.y - (2 + 14 * Math.min(1, fraction * 2)) / Math.SQRT2}
        scale={Math.min(1, fraction * 2)} color="black" face="#f7c325" />}
    <rect width={width} height="44" fill={appearance.hud} stroke={border} strokeWidth="2" />
    <g opacity={appearance.counterOpacity}>
    <DeliveryDot x={22} y={22} color={appearance.goal} />
    <text x={remainingTextCenters[left] ?? remainingTextCenters[1]} y={26.989999866485597} fontSize="14" fontWeight="500"
      fill={appearance.text} textAnchor="middle" fontFamily="CoFo Brilliant, system-ui, sans-serif">{left} left</text>
    </g>
    <g opacity={appearance.signOpacity}><MapSign artwork={artwork} width={width} /></g>
    {appearance.collision && <GridWarning color={appearance.text} opacity={appearance.messageOpacity} />}
    {appearance.fatal && !appearance.collision && <DeliveryWarning loop={current.failure === 'infinite-loop'}
      color={appearance.text} opacity={appearance.messageOpacity} />}
    {appearance.correct && <GridCompletion time={appearance.time} width={width} color={appearance.text} />}
    <path d={`M0 44 H${width}`} fill="none" stroke={border} strokeWidth="2" />
  </svg>;
}
