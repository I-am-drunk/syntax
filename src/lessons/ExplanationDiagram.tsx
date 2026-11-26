import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { run } from '../interactives/grid';
import type { GridMap } from '../interactives/grid';
import { RobotBoard } from '../interactives/RobotBoard';
import type { GridPage } from './types';
import { explanationFrame } from './useExplanationPlayback';
import { ExplanationCode } from './ExplanationCode';
import { ExplanationTruckMap } from './ExplanationTruckMap';

export function ExplanationDiagram({ map, explanation, position }: {
  map: GridMap; explanation: NonNullable<GridPage['explanation']>; position: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ wide: false, horizontal: false });
  useLayoutEffect(() => {
    const node = frameRef.current, host = hostRef.current;
    if (!node || !host) return;
    const [program, board] = Array.from(node.children);
    const update = () => {
      const wide = parseFloat(getComputedStyle(host).width) >= 492;
      const horizontal = wide && parseFloat(getComputedStyle(program).height) >= 50
        && parseFloat(getComputedStyle(board).height) >= 90;
      setLayout(current => current.wide === wide && current.horizontal === horizontal
        ? current : { wide, horizontal });
    };
    const observer = new ResizeObserver(update);
    [host, program, board].forEach(element => observer.observe(element));
    update();
    return () => observer.disconnect();
  }, []);
  const states = useMemo(() => run(map, explanation.program,
    explanation.mode ? 'delivered-goals' : 'visited-goals').states, [map, explanation]);
  const sample = explanationFrame(states, explanation.steps, position, explanation.durationMs);
  return <div ref={hostRef} className="explanation-grid-host"><div ref={frameRef} className="explanation-grid" data-wide={layout.wide}
    data-layout={layout.horizontal ? 'row' : 'column'}>
    <ExplanationCode explanation={explanation} position={position} />
    {explanation.mode === 'delivery' ? <ExplanationTruckMap map={map} {...sample} roadLayout={explanation.roadLayout} />
      : <RobotBoard map={map} width={map.width * 30 + 60} {...sample} bare delivery={explanation.mode === 'collection'} />}
    <svg className="explanation-frame" aria-hidden="true" overflow="visible">
      <rect width="100%" height="100%" rx="12" fill="#fafafa" stroke="rgb(0 0 0 / .12)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  </div></div>;
}
