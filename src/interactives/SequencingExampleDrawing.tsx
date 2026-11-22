import { useId } from 'react';
import { parseMap, run } from './grid';
import { DeliveryMarker, TruckCursor } from './DeliveryDrawing';
import { ease, mixColor } from './gridAppearance';
import { cubicProgress, moveProgress, turnProgress } from './gridMotion';
const parsed = parseMap('^X..\n....\n....\n....');
if (!parsed.ok) throw new Error(parsed.error);
const states = run(parsed.map, ['right', 'forward', 'deliver'], 'delivered-goals').states;
const codeWidth = 104.1038513183594, codeHeight = 66.83999919891357;
const labels = [
  ['turn', 14.489976501464845, 0, true], [' right', 46.101925659179685, 0, false],
  ['drive', 17.09397735595703, 1, true], [' forward', 61.36891326904296, 1, false],
  ['deliver', 23.01597137451172, 2, true], [' package', 75.0678970336914, 2, false],
] as const;

export function SequencingExampleDrawing({ wide, position }: { wide: boolean; position: number }) {
  const filterId = useId();
  const width = wide ? codeWidth + 188 : 164, height = wide ? 172 : codeHeight + 180;
  const mapX = wide ? codeWidth + 32 : 12, mapY = wide ? 16 : codeHeight + 28;
  const codeX = wide ? 16 : (width - codeWidth) / 2, codeY = wide ? (height - codeHeight) / 2 : 12;
  const step = Math.min(3, position * 3), index = Math.ceil(step), fraction = index ? step - index + 1 : 0;
  const before = states[Math.max(0, index - 1)], current = states[index];
  const move = moveProgress(fraction), turn = turnProgress(fraction);
  const x = before.position.x + (current.position.x - before.position.x) * move;
  const y = before.position.y + (current.position.y - before.position.y) * move;
  const angle = (before.heading + (current.heading - before.heading) * turn) * Math.PI / 2;
  const collection = index === 3 ? fraction : 0;
  const delivered = ease(collection);
  const markerColor = mixColor([69, 109, 255], [55, 92, 227], delivered);
  const cursorColor = mixColor([69, 109, 255], [116, 145, 255], ease(1 - Math.abs(2 * collection - 1)));
  const point = (cx: number, cy: number) => ({ x: 22 + cx * 32, y: 118 - cy * 32 });
  const head = point(x, y), near = Math.max(0, 1 - Math.hypot(x - 1, y - 3) / .2);
  return <svg width={width} height={height} overflow="visible" role="img"
    aria-label="Turn right, drive forward, and deliver the package" className="sequencing-example-drawing">
    <rect width={width} height={height} rx="6" fill="white" stroke="#0000001a" strokeWidth="2" />
    <g fontFamily="CoFo Brilliant, system-ui, sans-serif" fontSize="14">
      {labels.map(([text, x, row, command]) => <text key={text}
        transform={`translate(${codeX + x} ${codeY + 13.144000053405762 + row * 24.27999973297119})`}
        textAnchor="middle" dominantBaseline="alphabetic"
        fontWeight={command ? 700 : 400} fill={command ? '#456dff' : 'black'}>{text}</text>)}
    </g>
    <g transform={`translate(${mapX} ${mapY})`}>
      {Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)]).flatMap(([cx, cy]) => [
        ...(cy < 3 && (cx === 0 || cx === 3) ? [`${cx},${cy} ${cx},${cy + 1}`] : []),
        ...(cx < 3 && (cy === 0 || cy === 3) ? [`${cx},${cy} ${cx + 1},${cy}`] : []),
      ]).map(points => <polyline key={points} points={points} transform="matrix(32 0 0 -32 22 118)"
        fill="none" stroke="#b1c2d2" strokeWidth="4" strokeLinecap="square"
        vectorEffect="non-scaling-stroke" />)}
      {Array.from({ length: 16 }, (_, i) => [i % 4, Math.floor(i / 4)])
        .filter(([cx, cy]) => (cx === 0 || cx === 3 || cy === 0 || cy === 3) && !(cx === 0 && cy === 3))
        .map(([cx, cy]) => <circle key={`${cx},${cy}`} cx={point(cx, cy).x} cy={point(cx, cy).y} r="3" fill="#778592" />)}
      {index >= 2 && <path d={`M22 22 H${head.x}`} fill="none" stroke="#383838" strokeWidth="2" />}
      <polygon points="-2,-2 2,-2 2,2 -2,2" fill="black"
        transform="matrix(0.7071067811865476 -0.7071067811865475 -0.7071067811865475 -0.7071067811865476 22 22)" />
      <DeliveryMarker x={54} y={22} amount={delivered} color={markerColor} />
      <TruckCursor {...head} angle={angle} color={cursorColor}
        ringRadius={8 + 10 * cubicProgress(0, 0, collection)}
        ringOpacity={cubicProgress(1, 1, (1 - collection) / .34)} />
      {near > 0 && <DeliveryMarker x={54 + (2 + 8 * near) / Math.SQRT2 + near}
        y={22 - (2 + 8 * near) / Math.SQRT2 - 3 * near} amount={delivered} color={markerColor} />}
    </g>
    {/* The source's empty shadow layer affects transparent-paint compositing. */}
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
