import { parseCourseSlug, parseCourseProgress, parseProgress, parseProgressId, parseProgressReceipt } from '../../shared/progress.js';
import type { CourseProgress, ProgressSnapshot, ProgressReceipt } from '../../shared/progress.js';
export type { ProblemOutcome, ProgressKind, ProgressSnapshot } from '../../shared/progress.js';

export const progressError = 'Your progress could not be saved. Retry before leaving.';

async function receipt(response: Response): Promise<ProgressReceipt> {
  if (response.status !== 200) throw new Error(progressError);
  return parseProgressReceipt(await response.json());
}

export async function saveProgress(value: ProgressSnapshot): Promise<ProgressReceipt> {
  const progress = parseProgress(value);
  const result = await receipt(await fetch('/api/progress', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress), keepalive: true,
  }));
  if (JSON.stringify(result.progress) !== JSON.stringify(progress)) throw new Error(progressError);
  return result;
}

export async function readProgress(id: string): Promise<ProgressReceipt> {
  const result = await receipt(await fetch('/api/progress?id=' + parseProgressId(id), { cache: 'no-store' }));
  if (result.progress.id !== id) throw new Error(progressError);
  return result;
}

export async function readCourseProgress(course: string, signal?: AbortSignal): Promise<CourseProgress> {
  const courseSlug = parseCourseSlug(course);
  const response = await fetch('/api/progress?course=' + courseSlug, { cache: 'no-store', signal });
  if (response.status !== 200) throw new Error('Saved course progress could not be loaded.');
  const result = parseCourseProgress(await response.json());
  if (result.courseSlug !== courseSlug) throw new Error('Saved course progress did not match.');
  return result;
}
