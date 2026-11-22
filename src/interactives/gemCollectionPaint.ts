import { mixColor } from './gridAppearance';
type Shape = { tag: string; props: Record<string, string | undefined>; children: Shape[]; paint?: Record<string, string[] | undefined> };
export type GemOutcome = 'none' | 'success' | 'hard' | 'incomplete';
const rgb = (v: string) => v.match(/[\d.]+/g)!.slice(0,3).map(x => Math.round(Number(x)*255/100)) as [number,number,number];
const blue=[69,109,255] as const;
const green=[41,204,87] as const;
const warning: Record<string, readonly [number,number,number]> = {
  '211,184,255':[252,228,157], '182,137,255':[249,210,92],
  '157,98,255':[247,195,37], '135,77,229':[215,166,19],
};
export function gemCollectionPaint(parts: Shape[], collection: number, outcome: GemOutcome, amount: number): Shape[] {
  return parts.map(part => {
    const props={...part.props};
    for(const [key,values] of Object.entries(part.paint??{})){
      if(!values)continue;
      const normal=mixColor(rgb(values[0]),rgb(values[2]),collection);
      const target=outcome==='success'?rgb(values[1]):outcome==='hard'||collection>0?rgb(values[2])
        :outcome==='incomplete'?warning[rgb(values[0]).join(',')]??rgb(values[0]):rgb(normal);
      const selected=rgb(mixColor(rgb(normal),target,amount));
      const flat=rgb(mixColor(blue,outcome==='success'?green:blue,amount));
      props[key]=mixColor(selected,flat,collection);
    }
    return {...part,props,paint:{},children:gemCollectionPaint(part.children,collection,outcome,amount)};
  });
}
