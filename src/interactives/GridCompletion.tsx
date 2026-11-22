import { clamp, ease } from './gridAppearance';
import { cubicProgress } from './gridMotion';
import { Gem } from './RobotDrawing';

export function GridCompletion({ time, width, color, robot = false }: { time: number; width: number; color: string; robot?: boolean }) {
  const tick = time * 30 / 1000;
  const progress = tick >= 44 ? 1 : tick <= 20 ? 0 : tick <= 28 ? -0.05 * ease((tick - 20) / 8)
    : tick <= 38 ? -0.05 + 1.075 * ease((tick - 28) / 10) : 1.025 - 0.025 * ease((tick - 38) / 6);
  const angle = tick <= 20 ? 0 : tick <= 28 ? -36 * ease((tick - 20) / 8)
    : tick <= 38 ? -36 + 456 * ease((tick - 28) / 10) : 420 - 50 * ease((tick - 38) / 6);
  const entry = clamp((tick - 8) / 4);
  const pop = entry <= 0.7 ? 1.1 * cubicProgress(0.7, 1, entry / 0.7)
    : 1.1 - 0.1 * cubicProgress(0, 0.3, (entry - 0.7) / 0.3);
  const scale = pop * (tick < 53 ? 1 : 0.8 + 0.2 * cubicProgress(0, 0.3, clamp((tick - 53) / 10)));
  const text = robot ? 'Level complete!' : 'Deliveries complete!';
  const halfTextWidth = robot ? 53.04578399658203 : 68.20090942382814;
  const x = width / 2 + (2 * progress - 1) * (halfTextWidth + 20);
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians) * scale, sine = Math.sin(radians) * scale;
  const transform = (dx = 0, dy = 0, mirror = 1, size = 1) => {
    const c = cosine * size, s = sine * size;
    return `matrix(${c * mirror} ${s * mirror} ${s} ${-c} ${x + c * dx + s * dy} ${22 + s * dx - c * dy})`;
  };
  return <>
    {robot && [[-70,-10,30],[-20,12,32],[20,-14,34]].map(([dx,dy,start])=>{
      const phase=clamp((tick-start)/20), travel=cubicProgress(0,.3,phase);
      const points=Array.from({length:8},(_,i)=>{
        const radius=i%2 ? 3 : 7, theta=i*Math.PI/4;
        return `${Math.cos(theta)*radius},${Math.sin(theta)*radius}`;
      }).join(' ');
      return phase>0 && phase<1 && <polygon key={start} points={points} fill="#9fe8b3"
        opacity={1-cubicProgress(.7,1,phase)}
        transform={`translate(${width/2+dx+24*travel} ${22-dy}) rotate(${180*travel})`} />;
    })}
    <text x={width / 2 - halfTextWidth} y={26.989999866485597} fontSize="14" fontWeight="500"
      textAnchor="start" style={{ whiteSpace: 'pre' }} fontFamily="CoFo Brilliant, system-ui, sans-serif" fill={color}>
      {text.slice(0, Math.round(text.length * clamp(progress)))}
    </text>
    {robot && scale > 0 && <g transform={`translate(${x} 22) rotate(${angle}) scale(${scale})`}>
      <Gem x={0} y={0} scale={2} collection={0} outcome="success" amount={1} badge checked={tick > 52} />
    </g>}
    {!robot && scale > 0 && <g
      fill="none" stroke="rgb(8.24% 70.59% 25.49%)" strokeWidth="1">
      <polygon transform={transform()} points="-12,-8 12,-8 12,8 -12,8" fill="white" vectorEffect="non-scaling-stroke" />
      {([-1, 1] as const).map(side => <polyline key={'upper' + side}
        transform={transform(side * 12, -7, -side)}
        points="0,0 7.778174593052022,7.778174593052022" vectorEffect="non-scaling-stroke" />)}
      {([-1, 1] as const).map(side => <polyline key={'lower' + side}
        transform={transform(side * 12, 8, -side)}
        points="0,0 9.899494936611664,-9.899494936611664" vectorEffect="non-scaling-stroke" />)}
      <path transform={transform(0, 0.200505063388335)}
        d="M-2.1213203435596424 -2.121320343559643 L-2.1213203435596424 -2.121320343559643 A3 3 0 0 1 2.121320343559643 -2.1213203435596424"
        strokeLinecap="square" vectorEffect="non-scaling-stroke" />
      {tick > 52 && <>
        <circle transform={transform()} r="6" fill="rgb(8.24% 70.59% 25.49%)" stroke="none" />
        <polyline transform={transform(-0.883883476483184, -2.29809703885628, 1, 0.9)}
          points="-2.82842712474619,2.82842712474619 0,0 4.596194077712559,4.596194077712559"
          stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </>}
    </g>}
  </>;
}
