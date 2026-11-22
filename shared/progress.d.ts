export type ProgressKind = 'lesson' | 'practice';
export type ProblemOutcome = 'correct' | 'incorrect';
export type ContentProgress = {
  kind: ProgressKind;
  courseSlug: string;
  slug: string;
  version: string;
  completed: boolean;
  problems: { asset: string; state: ProblemOutcome }[];
};
export type ProgressSnapshot = {
  id: string;
  revision: number;
  contents: ContentProgress[];
};
export type ProgressReceipt = {
  accepted: true;
  progress: ProgressSnapshot;
  savedAt: string;
};
export type CourseProgress = {
  courseSlug: string;
  completedLessons: { slug: string; version: string }[];
};
export function parseCourseSlug(value: unknown): string;
export function parseCourseProgress(value: unknown): CourseProgress;
export function parseProgressId(value: unknown): string;
export function parseProgress(value: unknown): ProgressSnapshot;
export function parseProgressReceipt(value: unknown): ProgressReceipt;
