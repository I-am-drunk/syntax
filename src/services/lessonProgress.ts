import type { Lesson } from '../lessons/types';
import type { ContentProgress, ProgressKind, ProblemOutcome, ProgressSnapshot } from '../../shared/progress.js';
import { readProgress, saveProgress, progressError } from './progress';

export type SaveState = 'saved' | 'saving' | 'error';

export function createLessonProgress(lesson: Lesson, onState: (state: SaveState) => void) {
  const courseSlug = lesson.courseRoute.split('/')[2];
  const content = (kind: ProgressKind, value: { slug: string; version: string }): ContentProgress =>
    ({ kind, courseSlug, slug: value.slug, version: value.version, completed: false, problems: [] });
  let current: ProgressSnapshot = { id: crypto.randomUUID(), revision: 0,
    contents: [content(lesson.kind ?? 'lesson', lesson), ...(lesson.checks ? [content('practice', lesson.checks)] : [])] };
  const practice = new Map<string, ProblemOutcome>();
  const queue: ProgressSnapshot[] = [];
  const assets = [lesson.pages.filter(page => page.kind === 'grid').map(page => page.asset),
    lesson.checks?.pages.map(page => page.asset) ?? []];
  let savedRevision = 0, disposed = false, final = false;
  let pending: Promise<void> | null = null;
  const report = (state: SaveState) => { if (!disposed) onState(state); };

  function flush(): Promise<void> {
    if (pending) return pending;
    if (disposed || current.revision === savedRevision) return Promise.resolve();
    report('saving');
    pending = (async () => {
      while (queue.length) {
        const snapshot = queue[0];
        await saveProgress(snapshot);
        savedRevision = snapshot.revision;
        queue.shift();
      }
      report('saved');
    })().catch(error => { report('error'); throw error; }).finally(() => { pending = null; });
    return pending;
  }

  function change(index: number, next: ContentProgress) {
    current = { ...current, revision: current.revision + 1,
      contents: current.contents.map((item, position) => position === index ? next : item) };
    queue.push(current);
    void flush().catch(() => {});
  }

  function record(asset: string, state: ProblemOutcome) {
    if (disposed || final) return;
    const index = assets.findIndex(items => items.includes(asset));
    if (index < 0) return;
    if (current.contents[index].kind === 'practice') { practice.set(asset, state); return; }
    const item = current.contents[index], outcomes = new Map(item.problems.map(p => [p.asset, p.state]));
    outcomes.set(asset, state);
    change(index, { ...item, problems: assets[index].filter(asset => outcomes.has(asset))
      .map(asset => ({ asset, state: outcomes.get(asset)! })) });
  }

  function complete(kind: ProgressKind) {
    if (disposed || final) return;
    const index = current.contents.findIndex(item => item.kind === kind);
    if (index < 0 || current.contents[index].completed) return;
    const item = current.contents[index];
    const problems = kind === 'practice' ? assets[index].filter(asset => practice.has(asset))
      .map(asset => ({ asset, state: practice.get(asset)! })) : item.problems;
    final = kind === 'practice' || !lesson.checks;
    change(index, { ...item, completed: true, problems });
  }

  async function verify(): Promise<void> {
    report('saving');
    try {
      for (;;) {
        if (disposed) throw new Error(progressError);
        await flush();
        if (disposed) throw new Error(progressError);
        const snapshot = current;
        if (snapshot.revision === 0) { report('saved'); return; }
        const saved = await readProgress(snapshot.id);
        if (disposed) throw new Error(progressError);
        if (snapshot !== current) continue;
        if (JSON.stringify(saved.progress) !== JSON.stringify(snapshot)) throw new Error(progressError);
        report('saved'); return;
      }
    } catch (error) { report('error'); throw error; }
  }

  return { record, complete, flush: verify, dispose() { disposed = true; } };
}
