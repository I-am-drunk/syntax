import { packageWarningShape } from './packageWarningShape';
export function PackageWarning({ x, y, scale = 1, color = '#b78900', face = 'none', map = false }: {
  x: number; y: number; scale?: number; color?: string; face?: string; map?: boolean;
}) {
  return <g transform={`matrix(${scale} 0 0 ${-scale} ${x} ${y})`}>
    {map && <polygon points={packageWarningShape[0]} fill="none" stroke="black" strokeWidth="6" opacity=".3"
      vectorEffect={map ? 'non-scaling-stroke' : undefined} />}
    <polygon points={packageWarningShape[0]} fill={map ? 'none' : face} stroke={map ? 'white' : color} strokeWidth="2"
      vectorEffect={map ? 'non-scaling-stroke' : undefined} />
    {map && <polygon points={packageWarningShape[0]} fill={face} />}
    <polygon points={packageWarningShape[1]} fill={color} />
    <polygon points={packageWarningShape[2]} fill={color} />
  </g>;
}
export function DeliveryWarning({ loop, color, opacity, message }: {
  loop: boolean; color: string; opacity: number; message?: 'No gem to pick up here.' | 'Already picked up.';
}) {
  return <g opacity={opacity}>
    {loop ? <g fill="none" stroke="#b78900" strokeWidth="2">
      <path transform="matrix(1 0 0 -1 20.297836529348675 21.922527331620817)"
        d="M1.9411428382689055 -7.244443697168013 L1.9411428382689055 -7.244443697168013 A7.5 7.5 0 1 1 -1.3777276490407722e-15 -7.5" />
      <polyline transform="matrix(1 0 0 -1 22.79466365496518 30.422527331620817)" points="0,6 0,0 6,0" />
    </g> : <PackageWarning x={20} y={22} />}
    <text x={message === 'No gem to pick up here.' ? 114.40687866210936 : message === 'Already picked up.' ? 97.35491027832032 : loop ? 78.37461665789486 : 80.31693420410156} y={26.989999866485597}
      fontSize="14" fontWeight="500" textAnchor="middle" fontFamily="CoFo Brilliant, system-ui, sans-serif" fill={color}>
      {message ?? (loop ? 'Infinite loop.' : 'Package lost.')}
    </text>
  </g>;
}
