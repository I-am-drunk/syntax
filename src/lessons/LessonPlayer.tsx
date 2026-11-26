import { useLayoutEffect, useRef, useState } from 'react';
import { GridProblem } from '../interactives/GridProblem';
import type { GridControls, GridProblemHandle } from '../interactives/GridProblem';
import { GridIntroduction, GridConclusion } from '../interactives/GridIllustrations';
import { RepeatingIllustration } from '../interactives/RepeatingIllustration';
import { SequencingExample } from '../interactives/SequencingExamples';
import type { GridRun } from '../interactives/grid';
import type { LessonSound } from '../services/lessonSounds';
import type { Lesson } from './types';
import type { ProblemOutcome, ProgressKind } from '../../shared/progress.js';
import { LessonFooter, LessonNavigation, ResetIcon } from './LessonControls';
import { LessonReport } from './LessonReport';
import { LessonCompletion } from './LessonCompletion';
import { PracticeCompletion } from './PracticeCompletion';
import { PracticeExplanation } from './PracticeExplanation';
import type { CompletionSummary } from './LessonCompletion';
import type { ReportContext } from '../services/reports';
import './lesson.css';

type ProblemState = { controls: GridControls; evaluation: 'unsubmitted' | 'incorrect-retry' | 'incorrect' | 'correct'; completed: boolean };
const emptyProblem: ProblemState = {
  controls: { canCheck: false, canReset: false }, evaluation: 'unsubmitted', completed: false,
};

function Paragraph({ text }: { text: string }) {
  return <p>{text.split(/(\*\*.*?\*\*)/g).map((part, index) => part.startsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong> : part)}</p>;
}

export function LessonPlayer({ lesson, onSound, onReport, onProblemResult, onContentComplete, beforeExit, onClose }: {
  lesson: Lesson; onSound?(cue: LessonSound): void; onReport?(context: ReportContext): void;
  onProblemResult?(asset: string, outcome: ProblemOutcome): void;
  onContentComplete?(kind: ProgressKind): void;
  beforeExit?(): Promise<void>;
  onClose?(): void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const [problems, setProblems] = useState<Record<string, ProblemState>>({});
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const [seenExplanations, setSeenExplanations] = useState<Record<string, boolean>>({});
  const [completion, setCompletion] = useState<CompletionSummary | null>(null);
  const completionRef = useRef<CompletionSummary | null>(null);
  const mounted = useRef(true), exited = useRef(false);
  const finishing = useRef(false), exitPending = useRef(false);
  const handles = useRef(new Map<string, GridProblemHandle>());
  const pages = useRef(new Map<string, HTMLElement>());
  const surface = useRef<HTMLDivElement>(null);
  const allPages = [...lesson.pages, ...(lesson.checks?.pages ?? [])];
  const standalonePractice = lesson.kind === 'practice';
  const checkPages = standalonePractice ? lesson.pages : lesson.checks?.pages ?? [];
  const isCheck = standalonePractice || pageIndex >= lesson.pages.length;
  const keyFor = (asset: string) => {
    const content = lesson.checks?.pages.some(item => item.asset === asset) ? lesson.checks : lesson;
    return `${content.slug}:${content.version}:${asset}`;
  };
  const page = allPages[pageIndex], activeKey = keyFor(page.asset);
  const selection = useRef({ index: pageIndex, key: activeKey });
  const states = useRef(problems);
  selection.current = { index: pageIndex, key: activeKey }; states.current = problems;
  const current = problems[activeKey] ?? emptyProblem;
  const report = () => {
    const content = isCheck && lesson.checks ? lesson.checks : lesson;
    const [, , courseSlug, chapterSlug] = lesson.route.split('/');
    onReport?.({ contentSlug: content.slug, contentType: isCheck ? 'practice' : 'lesson',
      contentVersionName: content.version, courseSlug, chapterSlug, asset: page.asset,
      uri: location.pathname + location.hash });
  };
  const earnedXp = (values: Record<string, ProblemState>) => allPages.reduce((total, item) =>
    total + (item.kind === 'grid' && values[keyFor(item.asset)]?.completed ? item.xp ?? lesson.xpPerProblem : 0), 0);
  const xp = earnedXp(problems);
  const updateProblem = (key: string, update: (previous: ProblemState) => ProblemState) => {
    if (!mounted.current || finishing.current || completionRef.current || exited.current) return;
    const previous = states.current[key] ?? emptyProblem, next = update(previous);
    if (next === previous) return;
    states.current = { ...states.current, [key]: next }; setProblems(states.current);
  };
  const publishControls = (key: string, controls: GridControls) => updateProblem(key, previous =>
    previous.controls.canCheck === controls.canCheck && previous.controls.canReset === controls.canReset
      ? previous : { ...previous, controls });
  const receiveResult = (key: string, result: GridRun) => {
    if (!mounted.current || finishing.current || completionRef.current || exited.current) return;
    if (result.status === 'not-ready') return;
    const item = allPages.find(page => keyFor(page.asset) === key);
    const retryable = item?.kind !== 'grid' || item.retryable !== false;
    const correct = result.status === 'correct' || states.current[key]?.evaluation === 'correct';
    updateProblem(key, previous => ({ ...previous,
      evaluation: previous.evaluation === 'correct' || result.status === 'correct' ? 'correct' : retryable ? 'incorrect-retry' : 'incorrect',
      completed: previous.completed || result.status === 'correct',
    }));
    if (item?.kind === 'grid') onProblemResult?.(item.asset, result.status === 'correct' ? 'correct' : 'incorrect');
    onSound?.(correct ? 'correct' : retryable ? 'hint' : 'incorrect');
  };
  const reset = (key: string, action: 'retry' | 'startOver') => {
    if (finishing.current || completionRef.current || exited.current) return;
    if (selection.current.key !== key) return;
    const state = states.current[key] ?? emptyProblem;
    if (action === 'startOver' && !state.controls.canReset) return;
    handles.current.get(key)?.[action]();
    updateProblem(key, previous => ({ ...previous, evaluation: 'unsubmitted' }));
  };
  const check = (key: string) => {
    if (finishing.current || completionRef.current || exited.current) return;
    if (selection.current.key !== key) return;
    const state = states.current[key] ?? emptyProblem;
    if (state.evaluation !== 'unsubmitted' || !state.controls.canCheck) return;
    handles.current.get(key)?.check();
  };
  const selectPage = (index: number) => {
    if (finishing.current || completionRef.current || exited.current) return;
    const next = allPages[index];
    if (!next) return;
    setExplanationKey(null);
    selection.current = { index, key: keyFor(next.asset) };
    setPageIndex(index);
  };
  const navigate = (offset: number) => {
    const next = selection.current.index + offset;
    if (next >= 0 && next <= furthest) selectPage(next);
  };
  const showExplanation = (key: string) => {
    if (!mounted.current || finishing.current || completionRef.current || exited.current) return;
    if (selection.current.key !== key || page.kind !== 'grid' || !page.explanation) return;
    if (!['correct', 'incorrect'].includes(states.current[key]?.evaluation ?? '')) return;
    setSeenExplanations(previous => ({ ...previous, [key]: true }));
    setExplanationKey(key);
  };
  const exitCompletion = (snapshot: CompletionSummary | null, withSound = false) => {
    if (!mounted.current || exited.current || exitPending.current || completionRef.current !== snapshot) return;
    const leave = () => {
      if (!mounted.current || exited.current || completionRef.current !== snapshot) return;
      exited.current = true;
      if (withSound) onSound?.('continue');
      if (onClose) onClose(); else location.assign(lesson.courseRoute);
    };
    if (!beforeExit) { leave(); return; }
    exitPending.current = true;
    void Promise.resolve().then(beforeExit).then(leave).catch(() => {})
      .finally(() => { exitPending.current = false; });
  };
  const continueLesson = (key: string) => {
    if (!mounted.current || completionRef.current || exited.current) return;
    if (selection.current.key !== key) return;
    if (finishing.current) { exitCompletion(null); return; }
    const index = selection.current.index;
    if (allPages[index].kind === 'grid' && !['correct', 'incorrect'].includes(states.current[key]?.evaluation ?? '')) return;
    if (index === lesson.pages.length - 1) onContentComplete?.(lesson.kind ?? 'lesson');
    if (index === allPages.length - 1) {
      finishing.current = true;
      if (index >= lesson.pages.length) onContentComplete?.('practice');
      const earned = earnedXp(states.current);
      if ((earned > 0 || standalonePractice) && checkPages.length > 0 && lesson.completion) {
        const score = { total: checkPages.length, correct: checkPages.filter(item =>
          states.current[keyFor(item.asset)]?.evaluation === 'correct').length };
        const snapshot = { ...lesson.completion, xp: earned, score };
        completionRef.current = snapshot; setCompletion(snapshot);
      } else exitCompletion(null);
      return;
    }
    setFurthest(previous => Math.max(previous, index + 1)); selectPage(index + 1);
    onSound?.('continue');
  };
  const previousPage = useRef(pageIndex);
  useLayoutEffect(() => {
    if (!onClose) history.replaceState(history.state, '', `${location.pathname}${location.search}#page-${pageIndex + 1}`);
    if (previousPage.current !== pageIndex) pages.current.get(activeKey)?.focus({ preventScroll: true });
    previousPage.current = pageIndex;
  }, [pageIndex, activeKey]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useLayoutEffect(() => {
    const previous = document.title; document.title = `${lesson.title} | Syntax`;
    return () => { document.title = previous; };
  }, [lesson.title]);
  useLayoutEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const Completion = standalonePractice ? PracticeCompletion : LessonCompletion;
  if (completion) return <Completion summary={completion} onSound={onSound}
    onContinue={() => exitCompletion(completion, true)} onError={() => exitCompletion(completion)} />;
  return <main className="lesson-shell" data-phase={isCheck ? 'checks' : 'lesson'} aria-label={lesson.title}>
    <LessonNavigation page={pageIndex} total={lesson.pages.length} furthest={furthest}
      checkIndex={isCheck ? standalonePractice ? pageIndex : pageIndex - lesson.pages.length : undefined}
      checkEvaluations={checkPages.length ? checkPages.map(item => problems[keyFor(item.asset)]?.evaluation ?? 'unsubmitted') : undefined}
      xp={xp} closeHref={lesson.courseRoute} onClose={onClose ? () => exitCompletion(null) : undefined} onNavigate={navigate} />
    <div className="lesson-surface" ref={surface} data-evaluation={current.evaluation}>
      <div className="lesson-surface-inner">
      {isCheck && onReport && current.evaluation !== 'unsubmitted' && <LessonReport onReport={report} />}
      {allPages.map((item, index) => {
        if (index > furthest) return null;
        const key = keyFor(item.asset), active = index === pageIndex;
        const state = problems[key] ?? emptyProblem;
        return <section key={key} className="lesson-page" hidden={!active} tabIndex={-1}
          aria-label={standalonePractice ? `Practice ${index + 1}` : index >= lesson.pages.length ? `Check ${index - lesson.pages.length + 1}` : item.kind === 'grid' ? `Problem ${allPages.slice(0, index + 1).filter(p => p.kind === 'grid').length}` : item.title ?? (item.kind === 'conclusion' ? 'Conclusion' : 'Example')}
          data-asset={item.asset} data-page-kind={item.kind} data-is-check={standalonePractice || index >= lesson.pages.length}
          ref={node => { if (node) pages.current.set(key, node); else pages.current.delete(key); }}>
          <div className="lesson-content">
            {item.kind === 'introduction' && <GridIntroduction active={active && visible} />}
            <div className="lesson-copy">
              {item.kind !== 'grid' && item.title && <h1>{item.title}</h1>}
              {(item.kind === 'grid' ? item.prompt : item.paragraphs).map(text => <Paragraph key={text} text={text} />)}
            </div>
            {item.kind === 'grid' && <>
              <div className="lesson-asset">
              <GridProblem map={item.map} bank={item.bank} slotCount={item.slotCount}
                artwork={item.artwork} referenceProgram={item.referenceProgram} active={active && visible}
                initialProgram={item.initialProgram} grading={item.grading} stepMs={item.stepMs} repeatCount={item.repeatCount}
                onSound={onSound}
                ref={handle => { if (handle) handles.current.set(key, handle); else handles.current.delete(key); }}
                onControls={controls => publishControls(key, controls)} onResult={result => receiveResult(key, result)} />
              </div>
              {!standalonePractice && index < lesson.pages.length && <div className="lesson-reset-row">
                {state.evaluation !== 'correct' && index === furthest && <button type="button"
                  className="lesson-reset" disabled={!state.controls.canReset}
                  onClick={() => reset(key, 'startOver')}><ResetIcon />Start over</button>}
              </div>}
            </>}
            {item.kind === 'conclusion' && <GridConclusion />}
            {(item.kind === 'repeating-equivalence' || item.kind === 'repeating-python' || item.kind === 'debugging-example' || item.kind === 'debugging-python') &&
              <RepeatingIllustration kind={item.kind} />}
            {(item.kind === 'sequencing-program' || item.kind === 'sequencing-python') &&
              <SequencingExample kind={item.kind} active={active && visible} />}
            {item.kind !== 'grid' && item.afterParagraphs && <div className="lesson-copy">
              {item.afterParagraphs.map(text => <Paragraph key={text} text={text} />)}
            </div>}
          </div>
          {item.kind === 'grid' && item.explanation && <PracticeExplanation
            key={item.explanation.asset} map={item.map} explanation={item.explanation}
            open={active && explanationKey === key} active={active && visible}
            isLast={index === allPages.length - 1} container={surface}
            onClose={() => setExplanationKey(previous => previous === key ? null : previous)}
            onContinue={() => continueLesson(key)} />}
        </section>;
      })}
      <LessonFooter key={`${activeKey}:${current.evaluation}`} evaluation={current.evaluation}
        isProblem={page.kind === 'grid'} isLast={pageIndex === allPages.length - 1} isCheck={isCheck}
        canCheck={current.controls.canCheck} onCheck={() => check(activeKey)}
        onReport={onReport ? report : undefined}
        onExplain={page.kind === 'grid' && page.explanation ? () => showExplanation(activeKey) : undefined}
        explanationSeen={!!seenExplanations[activeKey]}
        onRetry={() => reset(activeKey, 'retry')} onContinue={() => continueLesson(activeKey)} />
      </div>
    </div>
  </main>;
}
