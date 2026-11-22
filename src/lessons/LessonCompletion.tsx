import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LessonSound } from '../services/lessonSounds';
import { useCompletionAnimation } from './useCompletionAnimation';
import { CompletionFrame } from './CompletionFrame';
import './completion.css';

export type CompletionSummary = {
  xp: number; score: { correct: number; total: number } | null;
  color: string; riveColor: number; levelNumber: number;
};

function Counter({ end, duration, steps }: { end: number; duration: number; steps: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0, timer = 0, origin: number | undefined;
    const schedule = () => { timer = window.setTimeout(() => {
      timer = 0; frame = requestAnimationFrame(tick);
    }, duration / steps); };
    const tick = (time: number) => {
      frame = 0; origin ??= time;
      const elapsed = time - origin;
      setValue(Math.floor(end * Math.min(elapsed / duration, 1)));
      if (elapsed < duration) schedule();
    };
    if (end !== 0) schedule();
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [duration, end, steps]);
  return <div className="completion-number">{value}</div>;
}

export function XpIcon() {
  return <svg className="completion-xp-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M10.5714 2.85742L13.4267 10.5736L21.1429 13.4289L13.4267 16.2841L10.5714 24.0003L7.71618 16.2841L0 13.4289L7.71618 10.5736L10.5714 2.85742Z" />
    <path fill="currentColor" d="M19.1423 0L20.4542 3.54527L23.9994 4.85714L20.4542 6.16901L19.1423 9.71429L17.8304 6.16901L14.2852 4.85714L17.8304 3.54527L19.1423 0Z" />
  </svg>;
}

function Stat({ label, children, xp = false }: { label: string; children: ReactNode; xp?: boolean }) {
  return <div className="completion-stat" data-xp={xp || undefined}>
    <div className="completion-stat-gradient" />
    <div className="completion-stat-value"><div className="completion-stat-number">{children}</div></div>
    <span className="completion-stat-label">{label}</span>
  </div>;
}

export function LessonCompletion({ summary, onContinue, onError, onSound }: {
  summary: CompletionSummary; onContinue(): void; onError(): void;
  onSound?(cue: LessonSound): void;
}) {
  const [revealed, setRevealed] = useState(false);
  const canvas = useCompletionAnimation({ color: summary.riveColor,
    levelNumber: summary.levelNumber,
    mastered: !!summary.score && summary.score.correct === summary.score.total,
    onReveal: () => setRevealed(true), onError,
    onTransition: () => onSound?.(summary.score && summary.score.correct < summary.score.total
      ? 'skill-check-failed' : 'lesson-complete'),
  });
  useEffect(() => {
    if (revealed) return;
    const timer = setTimeout(() => setRevealed(true), 3000);
    return () => clearTimeout(timer);
  }, [revealed]);
  return <CompletionFrame onContinue={onContinue} color={summary.color}>
        <div className="completion-art"><div className="completion-canvas"><canvas ref={canvas} aria-hidden="true" /></div></div>
        <div className="completion-copy">
          {revealed && <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .5 }}>
              <h1>Lesson<br />complete!</h1>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .5 }}>
              <div className="completion-stats">
                <Stat label="Total XP" xp><Counter end={summary.xp} duration={800} steps={12} /><XpIcon /></Stat>
                {summary.score && <Stat label="Score">
                  <Counter end={summary.score.correct} duration={600} steps={8} />
                  <span className="completion-denominator">{'/' + summary.score.total}</span>
                </Stat>}
              </div>
            </motion.div>
          </>}
        </div>
  </CompletionFrame>;
}
