import { useId, useLayoutEffect, useRef, useState } from 'react';
import { SequencingExampleDrawing } from './SequencingExampleDrawing';
import pythonDiagram from './sequencing-python.svg?raw';
import './sequencingExamples.css';
import { assetUrl } from '../mpm2d/assetUrl';

export function SequencingExample({ kind, active }: {
  kind: 'sequencing-program' | 'sequencing-python'; active: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const restartShadowId = useId();
  const clock = useRef({ progress: 0, remainder: 0, running: false });
  const [wide, setWide] = useState(false), [position, setPosition] = useState(0);
  const [restart, setRestart] = useState(0);
  useLayoutEffect(() => {
    const node = root.current!;
    const measure = () => setWide(node.getBoundingClientRect().width >= 492);
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const state = clock.current, step = 1 / 60;
    if (!active || kind !== 'sequencing-program' || state.progress > 1) return;
    let frame = 0, previous = Date.now(), alive = true;
    state.running = true;
    const tick = () => {
      if (!alive) return;
      const now = Date.now(), steps = (state.remainder + (now - previous) / 1000) / step;
      const count = Math.floor(steps);
      state.remainder = (steps - count) * step; previous = now;
      for (let i = 0; i < count && state.progress <= 1; i++) state.progress += step / (.7 * 3);
      setPosition(Math.min(1, state.progress));
      if (state.progress <= 1) frame = requestAnimationFrame(tick);
      else state.running = false;
    };
    frame = requestAnimationFrame(tick);
    return () => { alive = false; state.running = false; cancelAnimationFrame(frame); };
  }, [active, kind, restart]);
  return <div ref={root} className="sequencing-example" data-kind={kind} data-position={position}>
    {kind === 'sequencing-python' ? <div className="sequencing-python" role="img"
      aria-label="The same five commands in pseudocode and Python"
      dangerouslySetInnerHTML={{ __html: pythonDiagram }} /> : <>
      <SequencingExampleDrawing wide={wide} position={position} />
      <button type="button" className="sequencing-restart" aria-label="Restart" onClick={() => {
        if (!active) return;
        clock.current.progress = 0; setPosition(0);
        if (!clock.current.running) setRestart(value => value + 1);
      }}><svg width="108" height="36" overflow="visible" aria-hidden="true">
        <defs><filter id={restartShadowId} x="-100%" y="-100%" width="300%" height="300%"
          filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feBlend in="SourceGraphic" mode="normal" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feMorphology radius="0" operator="dilate" in="SourceAlpha" />
          <feOffset dx="0" dy="4" /><feGaussianBlur stdDeviation="0" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
          <feBlend in2="shape" mode="normal" />
        </filter></defs>
        <g filter={`url(#${restartShadowId})`}><g transform="matrix(1 0 0 -1 54 18)">
          <image width="108" height="36" href={assetUrl("/assets/grid/restart-button.svg")}
            transform="scale(1 -1) translate(-54 -18)" />
        </g></g>
        <g transform="matrix(1 0 0 -1 64 22.863999938964845)">
          <text transform="scale(1 -1)" dominantBaseline="alphabetic" textAnchor="middle"
            fontFamily="Sequencing Soleil" fontSize="16" fontWeight="400" fill="white">Restart</text>
        </g>
      </svg></button>
    </>}
  </div>;
}
