import { useEffect, useRef, useState } from 'react';
import type { LessonSound } from '../services/lessonSounds';
import { CompletionFrame } from './CompletionFrame';
import { XpIcon } from './LessonCompletion';
import type { CompletionSummary } from './LessonCompletion';
import { usePracticeAnimation } from './usePracticeAnimation';
import './practiceCompletion.css';

function copy(percent: number) {
  if (percent === 0) return ['That was tricky!', 'Keep practicing these concepts'];
  if (percent < .5) return ['That was tricky!', 'Keep practicing the concepts you missed'];
  if (percent < 1) return ['Practice complete!', 'Nice, let’s keep the momentum going'];
  return ['Perfect!', 'Let’s keep the momentum going'];
}

function PracticeXp({ xp, onStart }: { xp: number; onStart(): void }) {
  const [value, setValue] = useState(0), [animating, setAnimating] = useState(false);
  const start = useRef(onStart); start.current = onStart;
  useEffect(() => {
    let timer = 0, frame = 0, origin: number | undefined, started = false;
    const schedule = () => { timer = window.setTimeout(() => {
      if (!started) { started = true; setAnimating(true); start.current(); }
      frame = requestAnimationFrame(tick);
    }, 583 / 10); };
    const tick = (time: number) => {
      origin ??= time;
      setValue(Math.floor(xp * Math.min((time - origin) / 583, 1)));
      if (time - origin < 583) schedule(); else setAnimating(false);
    };
    timer = window.setTimeout(schedule, 100);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [xp]);
  return <div className="practice-xp">
    <span className="practice-xp-label">Total XP</span>
    <div className="practice-xp-row"><div className="practice-xp-value">
      <div className="practice-xp-number" data-animating={animating}>{value}</div>
      <span className="practice-xp-icon"><XpIcon /></span>
    </div></div>
  </div>;
}

export function PracticeCompletion({ summary, onContinue, onError, onSound }: {
  summary: CompletionSummary; onContinue(): void; onError(): void; onSound?(cue: LessonSound): void;
}) {
  const percent = summary.score ? summary.score.correct / summary.score.total : 1;
  const [title, subtitle] = copy(percent);
  const [titleVisible, setTitleVisible] = useState(false), [xpVisible, setXpVisible] = useState(false);
  const [moved, setMoved] = useState(false);
  const { canvas, burstCanvas } = usePracticeAnimation({ color: summary.riveColor, percentCorrect: percent,
    onTitle: () => setTitleVisible(true), onXp: () => setXpVisible(true), onError,
    onTransition: () => { setMoved(true); onSound?.('course-complete'); },
  });
  const tally = () => {
    const cues = ['xp-tally-1', 'xp-tally-2', 'xp-tally-3', 'xp-tally-4', 'xp-tally-5'] as const;
    onSound?.(percent === 1 ? 'xp-tally-final' : cues[Math.floor(Math.random() * cues.length)]);
  };
  return <CompletionFrame onContinue={onContinue} practice>
    <div className="practice-completion-content" data-moved={moved}>
      <div className="completion-art"><div className="completion-canvas"><canvas ref={canvas} aria-hidden="true" /></div></div>
      <div className="completion-copy practice-copy">
        <div className="practice-reveal" data-visible={titleVisible}>
          <h1>{title}</h1><p>{subtitle}</p>
        </div>
        <div className="practice-xp-burst" hidden={percent < .5}>
          <canvas ref={burstCanvas} aria-hidden="true" />
        </div>
        <div className="practice-reveal" data-visible={xpVisible}>
          {xpVisible && summary.xp > 0 && <PracticeXp xp={summary.xp} onStart={tally} />}
        </div>
      </div>
    </div>
  </CompletionFrame>;
}
