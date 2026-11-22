import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import type { GridMap } from '../interactives/grid';
import type { GridPage } from './types';
import { Arrow } from './LessonControls';
import { ExplanationDiagram } from './ExplanationDiagram';
import { useExplanationPlayback } from './useExplanationPlayback';
import './practiceExplanation.css';

function Caret({ direction }: { direction: 'left' | 'right' | 'down' }) {
  return <svg width="16" height="16" viewBox="0 0 12 8" aria-hidden="true"
    style={{ rotate: `${direction === 'down' ? 180 : direction === 'left' ? -90 : 90}deg` }}>
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd"
      d="M11.7071 6.14644L10.2929 7.56065L6.00001 3.26776L1.70712 7.56065L0.292908 6.14644L6.00001 0.439331L11.7071 6.14644Z" />
  </svg>;
}

export function PracticeExplanation({ map, explanation, open, active, isLast, container, onClose, onContinue }: {
  map: GridMap; explanation: NonNullable<GridPage['explanation']>;
  open: boolean; active: boolean; isLast: boolean; container: RefObject<HTMLDivElement>;
  onClose(): void; onContinue(): void;
}) {
  const playback = useExplanationPlayback(explanation.steps.length, open && active,
    explanation.durationMs, explanation.fixedStepMs);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 768px)').matches);
  const [height, setHeight] = useState<number>();
  const returnTo = useRef<HTMLElement | null>(null), advancing = useRef(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const last = playback.index === explanation.steps.length - 1;
  useLayoutEffect(() => {
    const media = matchMedia('(max-width: 768px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    advancing.current = false;
    const node = container.current;
    if (!node) return;
    const update = () => setHeight(node.clientHeight);
    update();
    const observer = new ResizeObserver(update); observer.observe(node);
    return () => { observer.disconnect(); swipe.current = null; };
  }, [open, container]);
  const continueQuestion = () => {
    advancing.current = true; onClose(); onContinue();
  };
  const step = explanation.steps[playback.index];
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <Dialog.Portal container={mobile ? container : undefined}>
      <Dialog.Backdrop className="explanation-backdrop" />
      <Dialog.Popup className="practice-explanation" initialFocus={false}
        finalFocus={() => advancing.current ? false : returnTo.current?.isConnected ? returnTo.current : false}
        data-asset={explanation.asset} data-step={playback.index} data-position={playback.position}
        style={{ '--explanation-height': height === undefined ? undefined : `${height}px` } as CSSProperties}>
        <header className="explanation-header">
          <Dialog.Title className="explanation-title">Explanation</Dialog.Title>
          <Dialog.Close className="explanation-close" aria-label="Close explanation">
            <span className="explanation-desktop-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></span>
            <span className="explanation-mobile-icon"><Caret direction="down" /></span>
          </Dialog.Close>
        </header>
        <div className="explanation-body">
          <div className="explanation-diagram" data-noswipe>
            <ExplanationDiagram map={map} explanation={explanation} position={playback.position} />
          </div>
          <div className="explanation-narration" aria-live="polite" onPointerDown={event => {
            if (!mobile || event.button !== 0) return;
            swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerCancel={() => { swipe.current = null; }} onPointerUp={event => {
            const start = swipe.current; swipe.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x, dy = event.clientY - start.y;
            if (Math.abs(dx) >= 10 && Math.abs(dx) > Math.abs(dy)) playback.move(dx < 0 ? 1 : -1);
          }}>
            <p>{step.text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`')
              ? <code key={index}>{part.slice(1, -1)}</code> : part)}</p>
          </div>
        </div>
        <footer className="explanation-footer" data-last={last}>
          <div className="explanation-previous-wrap">
            <button type="button" className="explanation-step-button" aria-label="Previous" disabled={playback.index === 0} onClick={() => playback.move(-1)}>
              <span className="explanation-desktop-icon"><Caret direction="left" /></span>
              <span className="explanation-mobile-icon"><Arrow /></span>
            </button>
          </div>
          <div className="explanation-dots" aria-label={`Step ${playback.index + 1} of ${explanation.steps.length}`}>
            {playback.index > 0 && <button type="button" aria-label="Previous step" onClick={() => playback.move(-1)}>
              {Array.from({ length: playback.index }, (_, i) => <i key={i} />)}</button>}
            <i className="explanation-current-dot" />
            {!last && <button type="button" aria-label="Next step" onClick={() => playback.move(1)}>
              {Array.from({ length: explanation.steps.length - playback.index - 1 }, (_, i) => <i key={i} />)}</button>}
          </div>
          <div className="explanation-next-wrap">
            <button type="button" className="explanation-step-button explanation-next" aria-label="Next" disabled={last} onClick={() => playback.move(1)}>
              <span className="explanation-desktop-icon"><Caret direction="right" /></span>
              <span className="explanation-mobile-icon"><Arrow right /></span>
            </button>
          </div>
          {last && <button type="button" className="lesson-action explanation-advance" onClick={continueQuestion}>
            <span>{isLast ? 'Finish' : 'Continue'}</span>
          </button>}
        </footer>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
