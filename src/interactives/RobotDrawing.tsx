import { createElement } from 'react';
import type { ReactElement } from 'react';
import { mixColor } from './gridAppearance';
import { robotGem, robotSprites } from './robotDrawings';
import { gemCollectionPaint } from './gemCollectionPaint';
import type { GemOutcome } from './gemCollectionPaint';
type Shape = { tag: string; props: Record<string, string | undefined>; children: Shape[]; paint?: Record<string, string[] | undefined> };
function shapes(parts: Shape[], x: number, y: number, angle = 0, scale = 1, palette = 0, amount = 0): ReactElement[] {
  const c = Math.cos(angle) * scale, s = Math.sin(angle) * scale;
  return parts.map((part, key) => {
    const props = { ...part.props };
    for (const [name, values] of Object.entries(part.paint ?? {})) {
      const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0,3).map(v => Math.round(Number(v)*255/100)) as [number, number, number];
      if (amount > 0 && values) props[name] = mixColor(rgb(values[0]), rgb(values[palette]), amount);
    }
    if (props.transform) {
      const [a,b,d,e,f,g] = props.transform.slice(7,-1).split(' ').map(Number);
      props.transform = `matrix(${c*a+s*b} ${-s*a+c*b} ${c*d+s*e} ${-s*d+c*e} ${x+c*f+s*g} ${y-s*f+c*g})`;
    }
    return createElement(part.tag, { ...props, key }, shapes(part.children, x, y, angle, scale, palette, amount));
  });
}
export function Robot({ x, y, angle, amount = 0, palette = 2, pulse = 0 }: { x: number; y: number; angle: number; amount?: number; palette?: number; pulse?: number }) {
  const direction = ((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4;
  const fields = [[9,4,5],[6,8,9],[9,4,5],[7,2,3]][direction];
  const parts = pulse > 0 ? robotSprites[direction].map((part,index) => {
    const field=fields.indexOf(index), values=part.paint?.fill;
    if(field<0||!values)return part;
    const rgb=(v:string)=>v.match(/[\d.]+/g)!.slice(0,3).map(n=>Number(n)*255/100) as [number,number,number];
    const base=rgb(mixColor(rgb(values[0]),rgb(values[palette]),amount));
    return {...part,props:{...part.props,fill:mixColor(base,field===2?[255,255,255]:[69,109,255],pulse)},
      paint:{...part.paint,fill:undefined}};
  }) : robotSprites[direction];
  return <g>{shapes(parts, x, y, angle, 1, palette, amount)}</g>;
}
const secondaryGem: Shape[] = robotGem.map((part, i) => i ? part : { ...part, children: part.children.map(child => ({ ...child, props: { ...child.props, stroke: 'black' }, paint: {} })) });
export function Gem({ x, y, scale = 1, amount = 0, secondary = false, collection, outcome = 'none', badge = false, checked = false, fixedCheckStroke = false }: {
  x: number; y: number; scale?: number; amount?: number; secondary?: boolean;
  fixedCheckStroke?: boolean; collection?: number; outcome?: GemOutcome; badge?: boolean; checked?: boolean;
}) {
  const source = secondary ? secondaryGem : robotGem;
  const parts = collection === undefined ? source : gemCollectionPaint(source,collection,outcome,amount);
  const drawing = badge ? parts.slice(1).map((part,i)=>i ? part : {...part,props:{...part.props,strokeWidth:'4'}}) : parts;
  const check = checked ? 1 : collection ?? 0;
  const checkScale = badge ? 1.3 : scale;
  return <g>{shapes(drawing, x, y, 0, scale, 2, collection === undefined ? amount : 0)}
    {check > 0 && <polyline transform={`matrix(${checkScale} 0 0 ${-checkScale} ${x - .883883476483184 * checkScale} ${y + 2.29809703885628 * checkScale})`}
      points="-2.82842712474619,2.82842712474619 0,0 4.596194077712559,4.596194077712559"
      fill="none" stroke="white" strokeWidth="2" vectorEffect={fixedCheckStroke ? 'non-scaling-stroke' : undefined} pathLength="1" strokeDasharray={check < 1 ? `${check} 1` : undefined} />}
  </g>;
}
