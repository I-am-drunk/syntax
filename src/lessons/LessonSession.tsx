import { useLayoutEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { LessonPlayer } from './LessonPlayer';
import { createLessonProgress } from '../services/lessonProgress';
import type { SaveState } from '../services/lessonProgress';
import { progressError } from '../services/progress';

export function LessonSession(props: ComponentProps<typeof LessonPlayer>) {
  const writer = useRef<ReturnType<typeof createLessonProgress> | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<SaveState>('saved');
  useLayoutEffect(() => {
    const session = createLessonProgress(props.lesson, next => {
      if (next === 'error' && document.activeElement instanceof HTMLElement)
        returnFocus.current = document.activeElement;
      setState(next);
    });
    writer.current = session; setState('saved');
    return () => { session.dispose(); if (writer.current === session) writer.current = null; };
  }, [props.lesson]);
  const flush = () => writer.current?.flush() ?? Promise.reject(new Error(progressError));
  const retry = async () => {
    const owner = writer.current;
    if (!owner) return;
    try {
      await owner.flush();
      if (writer.current !== owner) return;
      const target = returnFocus.current?.isConnected && returnFocus.current !== document.body
        ? returnFocus.current
        : document.querySelector<HTMLElement>('.completion-continue, .lesson-page:not([hidden])');
      target?.focus({ preventScroll: true });
    } catch { /* The writer retains the failed snapshot and reports the error. */ }
  };
  return <>
    <LessonPlayer {...props}
      onProblemResult={(asset, outcome) => writer.current?.record(asset, outcome)}
      onContentComplete={kind => writer.current?.complete(kind)} beforeExit={flush} />
    {state === 'error' && <div className="toast error" role="alert">
      <p>{progressError}</p>
      <button type="button" className="plain-button" onClick={retry}>Retry save</button>
    </div>}
  </>;
}
