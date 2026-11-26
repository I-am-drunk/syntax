import { useId } from 'react';
import { clamp, ease, mixColor, colors } from './gridAppearance';
import { cubicProgress } from './gridMotion';
import { introMotion } from './gridIntroMotion';
import { DiagramShadow } from './DiagramShadow';
import { assetUrl } from '../mpm2d/assetUrl';

const transparent = 'rgba(0%,0%,0%,0)';
const blue = 'rgb(27.06% 42.75% 100%)';
const stroke = { stroke: transparent, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' } as const;
const matrix = (x: number, y: number, scale = 1, angle = 0) => {
  const c = scale * Math.cos(angle), s = scale * Math.sin(angle);
  return `matrix(${c} ${-s} ${-s} ${-c} ${x} ${y})`;
};
const assets = assetUrl('/assets/grid/');
const phone = 'phone_wrapper_sailr_289x457_2x-uvkefr-1-jWC5K7.png';
const mask = 'phone_wrapper_mask_289x457_2x-ZJdBWF.png';
const gridX = [-2, -1, 0, 1, 2], gridY = [-3, -2, -1, 0, 1, 2, 3];

function IntroCommands({ x, y, row, check }: { x: number; y: number; row: number; check: number }) {
  return <>{[0, 1, 2, 3].map(index => {
    const difference = index + 1 - row, distance = clamp(Math.abs(difference));
    const local = 1 - .8 * ease(difference > 0 ? (distance - .5) / .5 : distance / .5);
    const amount = Math.min(local, 1 - .8 * ease(check / .5));
    const color = mixColor(colors.gray, colors.blue, amount);
    const border = mixColor([229, 229, 229], [204, 204, 204], amount);
    const turn = index === 2, width = turn ? 84.6239013671875 : 113.56787109375;
    const centerY = y - 61 + index * 40;
    return <g key={index}>
      <rect {...stroke} transform={matrix(x + width / 2, centerY + 2)} x={-width / 2} y={-16}
        width={width} height="32" rx="2" fill={border} stroke={border} />
      <rect {...stroke} transform={matrix(x + width / 2, centerY)} x={-width / 2} y={-16}
        width={width} height="32" rx="2" fill="white" stroke={border} />
      {(turn ? [['turn', 22.55997314453125], ['right', 60.871923828125]]
        : [['drive', 25.53597412109375], ['forward', 78.31990966796875]]).map(([text, offset], word) =>
        <g key={text} transform={matrix(x + Number(offset), centerY + 4.576000213623047)}>
          <text transform="scale(1 -1)" dominantBaseline="alphabetic" textAnchor="middle"
            style={{ whiteSpace: 'pre' }} fontFamily="CoFo Brilliant, system-ui, sans-serif"
            fontSize="16" fontWeight={word === 0 ? 700 : 400} fill={color}>{text}</text>
        </g>)}
    </g>;
  })}</>;
}

export function IntroDrawing({ wide, phase }: { wide: boolean; phase: number }) {
  const id = useId(), motion = introMotion(phase);
  const gap = wide ? 40 : 20, labelWidth = 115.56787109375;
  const height = Math.min(288, ((wide ? 492 : 288) - gap - labelWidth) * 914 / 578);
  const phoneWidth = height * 578 / 914, width = phoneWidth + gap + labelWidth;
  const center = phoneWidth / 2, y = height / 2, unit = height / 3.75, x = center + unit / 2;
  const point = (p: readonly number[]) => [x + p[0] * unit, y - p[1] * unit];
  const [cursorX, cursorY] = point(motion.point), angle = motion.heading;
  const iconScale = cubicProgress(0, .3, motion.check);
  const iconOpacity = ease(motion.check);
  return <svg className="grid-intro-drawing" width={width} height={height} overflow="visible"
    role="img" aria-label="A delivery program guides a truck through streets on a phone map.">
    <defs>
      <filter id={id + '-white'}><feColorMatrix in="SourceGraphic" type="matrix"
        values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" /></filter>
      <mask id={id + '-phone'} maskUnits="userSpaceOnUse">
        <g transform={matrix(center, y, height / 914)}>
          <image width="578" height="914" href={assets + mask} filter={`url(#${id}-white)`}
            transform="scale(1 -1) translate(-289 -457)" />
        </g>
      </mask>
      <filter id={id + '-shadow'} x="-100%" y="-100%" width="300%" height="300%"
        filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feBlend in="SourceGraphic" mode="normal" result="shape" />
        <feColorMatrix in="SourceAlpha" type="matrix" result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
        <feMorphology radius="0" operator="dilate" in="SourceAlpha" />
        <feOffset dx="0" dy="0" /><feGaussianBlur stdDeviation="4" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
        <feComponentTransfer><feFuncA type="linear" slope="0.25" /></feComponentTransfer>
        <feBlend in2="shape" mode="normal" />
      </filter>
      <mask id={id + '-map'} maskUnits="userSpaceOnUse">
        <polygon {...stroke} fill="white" transform={matrix(center, y, unit)}
          points="-1.375,-1.875 1.375,-1.875 1.375,1.875 -1.375,1.875" />
      </mask>
    </defs>
    <g mask={`url(#${id}-phone)`}>
      <g mask={`url(#${id}-map)`}>
        <polygon {...stroke} fill="white" transform={matrix(x, y, unit)}
          points="-2.6461538461538465,-4.430769230769231 2.6461538461538465,-4.430769230769231 2.6461538461538465,4.430769230769231 -2.6461538461538465,4.430769230769231" />
        <g opacity=".66"><g transform={matrix(x, y, unit / 32.5)}>
          <image width="172" height="288" href={assets + 'marketdistrict-svg-v2keDj.format-svg.svg'}
            transform="scale(1 -1) translate(-86 -144)" />
        </g></g>
        {[false, true].map(fill => <g key={String(fill)}>
          {gridX.map(column => <polygon key={'x' + column} {...stroke}
            transform={matrix(x + column * unit, y, unit)} points="-.05,-3 .05,-3 .05,3 -.05,3"
            fill={fill ? 'rgb(69.41% 76.08% 82.35%)' : transparent}
            stroke={fill ? transparent : 'rgb(55.69% 63.53% 71.37%)'} />)}
          {gridY.map(row => <polygon key={'y' + row} {...stroke}
            transform={matrix(x, y - row * unit, unit)} points="-2,-.05 2,-.05 2,.05 -2,.05"
            fill={fill ? 'rgb(69.41% 76.08% 82.35%)' : transparent}
            stroke={fill ? transparent : 'rgb(55.69% 63.53% 71.37%)'} />)}
        </g>)}
        {gridX.flatMap(column => gridY.map(row => <circle key={`${column},${row}`} {...stroke}
          transform={matrix(x + column * unit, y - row * unit)} r="2" fill="rgb(46.67% 52.16% 57.25%)" />))}
        {motion.trail.length === 1 ? <circle transform={matrix(...point(motion.trail[0]) as [number, number])}
          r="1.5" fill="rgb(40% 40% 40%)" /> : <polyline {...stroke} transform={matrix(x, y, unit)}
          points={motion.trail.map(p => p.join(',')).join(' ')} fill={transparent} stroke="rgb(40% 40% 40%)" strokeWidth="3" />}
        <polygon {...stroke} transform={matrix(x - unit, y + unit, 1, Math.PI / 4)}
          points="-2,-2 2,-2 2,2 -2,2" fill="black" />
        {motion.markers.slice(1).map((p, i) => <circle key={i} {...stroke}
          transform={matrix(...point(p) as [number, number])} r="2" fill="black" />)}
        <circle {...stroke} transform={matrix(x, y - unit, 1.5)} r="10" fill="rgba(27.06%,42.75%,100%,.25)" />
        <circle {...stroke} transform={matrix(x, y - unit, 1.5)} r="5" fill="white" />
        <circle {...stroke} transform={matrix(x, y - unit, 1.5)} r="4" fill={blue} />
        <g opacity=".2"><circle {...stroke} transform={matrix(cursorX, cursorY, 1.25, angle)}
          r="10" fill={transparent} stroke="black" strokeWidth="4" /></g>
        <circle {...stroke} transform={matrix(cursorX, cursorY, 1.25, angle)} r="10" fill="white" />
        <polygon {...stroke} fill={blue} points="6,0 -6,6 -4,0 -6,-6"
          transform={matrix(cursorX + 1.25 * Math.cos(angle), cursorY - 1.25 * Math.sin(angle), 1.25, angle)} />
      </g>
      <g filter={`url(#${id}-shadow)`}><g opacity={iconOpacity}>
        <g transform={matrix(center, y, iconScale)}>
          <image width="32" height="32" href={assets + 'group-17685-RWhCQl.png'}
            transform="scale(1 -1) translate(-16 -16)" />
        </g>
      </g></g>
    </g>
    <g transform={matrix(center, y, height / 914)}>
      <image width="578" height="914" href={assets + phone}
        transform="scale(1 -1) translate(-289 -457)" />
    </g>
    <IntroCommands x={phoneWidth + gap + 1} y={y} row={motion.row} check={motion.check} />
    <DiagramShadow />
  </svg>;
}
