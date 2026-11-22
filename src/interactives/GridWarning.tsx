import { useId } from 'react';

export function GridWarning({ color, opacity }: { color: string; opacity: number }) {
  const mask = useId();
  return <g opacity={opacity} fill="none" stroke="rgb(71.76% 53.73% 0%)" strokeWidth="2">
    <defs><mask id={mask} maskUnits="userSpaceOnUse">
      <rect x="12" y="14" width="24" height="8" rx="2" fill="white" stroke="none" />
    </mask></defs>
    <rect x="12" y="14" width="24" height="8" rx="2" fill="rgb(99.22% 95.29% 82.75%)" stroke="none" />
    <g mask={`url(#${mask})`}>
      {Array.from({ length: 6 }, (_, index) => <path key={index} d="M0 -12 V12"
        transform={`translate(${24 + (index - 2.5) * 4 / Math.SQRT2} ${18 + (index - 2.5) * 4 / Math.SQRT2}) rotate(45) scale(1 -1)`} />)}
    </g>
    <rect x="12" y="14" width="24" height="8" rx="2" />
    <path d="M17 22 V30 M17 26 H31 M31 22 V30" />
    <g transform="matrix(1 0 0 -1 93.4689453125 26.989999866485597)">
      <text transform="scale(1 -1)" fontSize="14" fontWeight="500" dominantBaseline="alphabetic"
        style={{ whiteSpace: 'pre' }} textAnchor="middle" fontFamily="CoFo Brilliant, system-ui, sans-serif"
        fill={color} stroke="none">Out of bounds.</text>
    </g>
  </g>;
}
