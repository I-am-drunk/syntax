import { Fragment } from 'react';
import { DiagramShadow } from './DiagramShadow';

const blue = 'rgb(27.06% 42.75% 100%)', green = 'rgb(0% 60.78% 16.86%)';
const darkGreen = 'rgb(0% 48.63% 13.73%)', transparent = 'rgba(0%,0%,0%,0)';
const stroke = { stroke: transparent, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' } as const;
const matrix = (x: number, y: number, scale = 1) => `matrix(${scale} 0 0 ${-scale} ${x} ${y})`;
const words = [
  ['while', 54.22798461914063, 53.58400058746338, 700, green],
  ['deliveries remain', 133.64685516357423, 53.58400058746338, 400, darkGreen],
  ['if', 28.80198974609375, 77.86400032043457, 700, green],
  ['street open ahead', 98.65187225341796, 77.86400032043457, 400, darkGreen],
  ['drive', 49.09397735595703, 102.14400005340576, 700, blue],
  [' forward', 93.36891326904296, 102.14400005340576, 400, 'black'],
  ['...', 37.417971801757815, 126.42399978637695, 700, blue],
] as const;
const cells = Array.from({ length: 16 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4) }));
const goals = [[2, 0], [3, 0], [0, 1], [1, 1], [3, 1], [1, 2], [2, 2], [3, 2], [0, 3], [1, 3], [3, 3]];

export function ConclusionDrawing({ wide }: { wide: boolean }) {
  const width = wide ? 363.6597564697265 : 199.65975646972657;
  const height = wide ? 172 : 271.11999893188477;
  const ox = wide ? 0 : -4, oy = wide ? 0 : -28.440000534057617;
  const gx = wide ? 229.65975646972657 : 51.82987823486329;
  const gy = wide ? 134 : 237.11999893188477;
  const cursor = (offset = 0) => `matrix(${Math.cos(Math.PI / 2)} -1 -1 ${-Math.cos(Math.PI / 2)} ${gx} ${gy - offset})`;
  const edges = cells.flatMap(p => [
    ...(p.y < 3 ? [[p, { x: p.x, y: p.y + 1 }]] : []),
    ...(p.x < 3 ? [[p, { x: p.x + 1, y: p.y }]] : []),
  ]);
  return <svg width={width} height={height} overflow="visible" role="img"
    aria-label="A static program with while and if blocks beside a delivery road grid.">
    <rect {...stroke} x="0" y="0" width={width} height={height} rx="6"
      fill="white" stroke="rgba(0%,0%,0%,.1)" />
    <g transform={`translate(${ox} ${oy})`}>
      <polyline {...stroke} transform={matrix(16.5, 58.72000026702881)}
        points="0,0 0,-72.92399911880494" fill={transparent} stroke="#ccc" strokeWidth="1" />
      <polyline {...stroke} transform={matrix(16.5, 131.64399938583375)}
        points="0,0 4,0" fill={transparent} stroke="#ccc" strokeWidth="1" />
      <polyline {...stroke} transform={matrix(24.5, 83)}
        points="0,0 0,-48.615999412536624" fill={transparent} stroke="#ccc" strokeWidth="1" />
      <polyline {...stroke} transform={matrix(24.5, 131.6159994125366)}
        points="0,0 4,0" fill={transparent} stroke="#ccc" strokeWidth="1" />
      <polygon {...stroke} fill={green} transform={matrix(16, 41.58000040054321)}
        points="12.5,-3.5 2.5,-3.5 2.5,-2.5 13.5,-2.5 13.5,-7.79289 15.1464,-6.14645 15.8536,-6.85355 13,-9.70711 10.1464,-6.85355 10.8536,-6.14645 12.5,-7.79289 12.5,-3.5" />
      <polygon {...stroke} fill={green} transform={matrix(16, 41.58000040054321)}
        points="4,-12.5 14,-12.5 14,-13.5 3,-13.5 3,-8.20711 1.35355,-9.85355 .646446,-9.14645 3.5,-6.29289 6.35355,-9.14645 5.64645,-9.85355 4,-8.20711 4,-12.5" />
      {[[133.64685516357423, 49.601000213623045, 116.02580261230469],
        [98.65187225341796, 73.88099994659424, 123.73981628417968]].map(([x, y, w]) =>
        <rect key={x} {...stroke} transform={matrix(x, y)} x={-w / 2} y={-9.048999786376953}
          width={w} height={18.097999572753906} rx="2" fill="rgb(94.9% 94.9% 94.9%)" />)}
      {words.map(([text, x, y, weight, color]) => <g key={text} transform={matrix(x, y)}>
        <text transform="scale(1 -1)" dominantBaseline="alphabetic" textAnchor="middle"
          style={{ whiteSpace: 'pre' }} fontFamily="CoFo Brilliant, system-ui, sans-serif"
          fontSize="14" fontWeight={weight} fill={color}>{text}</text>
      </g>)}
    </g>
    {edges.map(([a, b], i) => <polyline key={i} {...stroke} transform={matrix(gx, gy, 32)}
      points={`${a.x},${a.y} ${b.x},${b.y}`} fill={transparent} stroke="rgb(69.41% 76.08% 82.35%)"
      strokeWidth="4" strokeLinecap="square" />)}
    {cells.filter(p => p.x || p.y).sort((a, b) => a.x - b.x || a.y - b.y).map(p =>
      <circle key={`${p.x},${p.y}`} {...stroke} transform={matrix(gx + p.x * 32, gy - p.y * 32)}
        r="3" fill="rgb(46.67% 52.16% 57.25%)" />)}
    <circle transform={matrix(gx, gy)} r="1" fill="rgb(21.96% 21.96% 21.96%)" />
    <polygon {...stroke} transform={`matrix(${Math.SQRT1_2} ${-Math.SQRT1_2} ${-Math.SQRT1_2} ${-Math.SQRT1_2} ${gx} ${gy})`}
      fill="black" points="-2,-2 2,-2 2,2 -2,2" />
    {goals.map(([x, y]) => <Fragment key={`${x},${y}`}>
      <g opacity=".25"><circle {...stroke} transform={matrix(gx + x * 32, gy - y * 32)} r="10" fill={blue} /></g>
      <circle {...stroke} transform={matrix(gx + x * 32, gy - y * 32)} r="6" fill="white" />
      <circle {...stroke} transform={matrix(gx + x * 32, gy - y * 32)} r="4" fill={blue} />
    </Fragment>)}
    <g opacity="1">
      <circle {...stroke} transform={cursor()} r="8" fill={transparent} stroke={blue} />
      <g opacity=".2"><circle {...stroke} transform={cursor()} r="10" fill={transparent} stroke="black" strokeWidth="4" /></g>
      <circle {...stroke} transform={cursor()} r="10" fill="white" />
      <polygon {...stroke} transform={cursor(1)} fill={blue} points="6,0 -6,6 -4,0 -6,-6" />
    </g>
    <DiagramShadow />
  </svg>;
}
