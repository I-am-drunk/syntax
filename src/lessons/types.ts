import type { Command, GoalMode, GridMap } from '../interactives/grid';
import type { GridArtwork } from '../interactives/GridBoard';

export type IllustrationPage = {
  kind: 'introduction' | 'conclusion' | 'sequencing-program' | 'sequencing-python' | 'repeating-equivalence' | 'repeating-python' | 'debugging-example' | 'debugging-python';
  asset: string;
  title?: string;
  paragraphs: readonly string[];
  afterParagraphs?: readonly string[];
};
export type GridPage = {
  kind: 'grid';
  asset: string;
  prompt: readonly string[];
  map: GridMap;
  bank: readonly Command[];
  slotCount: number;
  referenceProgram: readonly Command[];
  artwork: GridArtwork;
  initialProgram?: readonly Command[];
  grading?: GoalMode | 'reference-program';
  stepMs?: number;
  retryable?: boolean;
  repeatCount?: 3 | 4 | 5;
  xp?: number;
  explanation?: {
    asset: string;
    program: readonly Command[];
    steps: readonly { end: number; text: string }[];
    durationMs?: number;
    fixedStepMs?: number;
    repeatCount?: 3 | 4 | 5;
    mode?: 'delivery' | 'collection';
    rowEmphasis?: readonly (readonly number[])[];
    rowSegments?: readonly { from: readonly number[]; to: readonly number[] }[];
    roadLayout?: 'perimeter';
  };
};
export type Lesson = {
  kind?: 'lesson' | 'practice';
  slug: string;
  version: string;
  title: string;
  route: string;
  courseRoute: string;
  xpPerProblem: number;
  completion?: { color: string; riveColor: number; levelNumber: number };
  pages: readonly (IllustrationPage | GridPage)[];
  checks?: { slug: string; version: string; pages: readonly GridPage[] };
};
