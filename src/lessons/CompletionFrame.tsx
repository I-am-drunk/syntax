import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

function ContinueButton({ onContinue }: { onContinue(): void }) {
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setEntered(true)); });
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className="completion-cta-reveal" data-entered={entered}>
    <button className="completion-continue" type="button" onClick={onContinue}>
      <span className="completion-continue-face"><span className="completion-continue-content">Continue</span></span>
    </button>
  </div>;
}

export function CompletionFrame({ children, onContinue, color, practice = false }: {
  children: ReactNode; onContinue(): void; color?: string; practice?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [overlap, setOverlap] = useState(false);
  const content = useRef<HTMLDivElement>(null), footer = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const a = content.current?.getBoundingClientRect(), b = footer.current?.getBoundingClientRect();
      if (a && b) setOverlap(a.right - b.left > 1 && b.right - a.left > 1
        && a.bottom - b.top > 1 && b.bottom - a.top > 1);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(queue);
    if (content.current) observer.observe(content.current);
    if (footer.current) observer.observe(footer.current);
    measure();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue);
    };
  }, [ready]);
  return <main className="lesson-completion" data-phase="completion"
    data-kind={practice ? 'practice' : undefined} aria-label={practice ? 'Practice complete' : 'Lesson complete'}
    style={{ '--completion-score-color': color } as CSSProperties}>
    <div className="completion-layout">
      <div className="completion-content" ref={content}>{children}</div>
      {ready && <footer ref={footer} className="completion-footer" data-overlap={overlap}>
        <ContinueButton onContinue={onContinue} />
      </footer>}
    </div>
  </main>;
}
