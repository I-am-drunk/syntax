import { useLayoutEffect, useRef, useState } from 'react';
import { advanceIntro } from './gridIntroMotion';
import { IntroDrawing } from './IntroDrawing';
import { ConclusionDrawing } from './ConclusionDrawing';
import './gridIllustrations.css';

function useSceneWidth() {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const next = root.current!.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root.current!); measure();
    return () => observer.disconnect();
  }, []);
  return { root, width };
}

export function GridIntroduction({ active }: { active: boolean }) {
  const { root, width } = useSceneWidth();
  const clock = useRef({ phase: 0, remainder: 0 });
  const generation = useRef(0);
  const [phase, setPhase] = useState(0);
  useLayoutEffect(() => {
    const owned = ++generation.current;
    if (!active) return;
    let frame: number | null = null, baseline = Date.now();
    const tick = () => {
      if (generation.current !== owned) return;
      const now = Date.now();
      clock.current = advanceIntro(clock.current, (now - baseline) / 1000);
      baseline = now; setPhase(clock.current.phase);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      generation.current += 1;
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [active]);
  return <div ref={root} className="grid-illustration">
    {width > 0 && <IntroDrawing wide={width >= 492} phase={phase} />}
  </div>;
}

export function GridConclusion() {
  const { root, width } = useSceneWidth();
  return <div ref={root} className="grid-illustration">
    {width > 0 && <ConclusionDrawing wide={width >= 492} />}
  </div>;
}
