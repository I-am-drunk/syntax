import { ease } from './gridAppearance';

const blue = 'rgb(27.06% 42.75% 100%)';
export function DeliveryMarker({ x, y, amount = 0, color = blue }: {
  x: number; y: number; amount?: number; color?: string;
}) {
  // The source eases the reveal within each of the check's two segments.
  const corner = 4 / 10.5;
  const first = '-2.82842712474619,2.82842712474619';
  const tip = amount < corner
    ? -2.82842712474619 * (1 - ease(amount / corner))
    : 4.596194077712559 * ease((amount - corner) / (1 - corner));
  const points = amount < corner ? `${first} ${tip},${-tip}` : `${first} 0,0 ${tip},${tip}`;
  const shape = { transform: `matrix(1 0 0 -1 ${x} ${y})`, stroke: 'rgba(0,0,0,0)', strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke' } as const;
  return <g>
    <g opacity=".25"><circle {...shape} r={10 - 4 * amount} fill={color} /></g>
    <circle {...shape} r={6 + amount} fill="white" />
    <circle {...shape} r={4 + 2 * amount} fill={color} />
    {amount > 0 && <polyline
      transform={`matrix(1 0 0 -1 ${x - .883883476483184} ${y + 2.29809703885628})`}
      points={points}
      fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
  </g>;
}

export function TruckCursor({ x, y, angle, color = blue, pulse = 0, ringRadius, ringOpacity }: {
  x: number; y: number; angle: number; color?: string; pulse?: number;
  ringRadius?: number; ringOpacity?: number;
}) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const paint = { vectorEffect: 'non-scaling-stroke', strokeLinecap: 'butt',
    strokeLinejoin: 'miter', stroke: 'rgba(0,0,0,0)', strokeWidth: 2 } as const;
  const circle = { ...paint, transform: `matrix(${c} ${-s} ${-s} ${-c} ${x} ${y})` };
  return <g>
    <g opacity={ringOpacity ?? 1 - Math.max(0, Math.min(1, (pulse - .66) / .34))}>
      <circle {...circle} r={ringRadius ?? 8 + 10 * pulse}
        fill="rgba(0,0,0,0)" stroke={blue} />
    </g>
    <g opacity=".2">
      <circle {...circle} r="10" fill="rgba(0,0,0,0)" stroke="black" strokeWidth="4" />
    </g>
    <circle {...circle} r="10" fill="white" />
    <polygon {...paint}
      transform={`matrix(${c} ${-s} ${-s} ${-c} ${x + c} ${y - s})`}
      points="6,0 -6,6 -4,0 -6,-6" fill={color} />
  </g>;
}
