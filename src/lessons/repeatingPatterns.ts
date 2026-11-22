import { parseMap } from '../interactives/grid';
import type { Command } from '../interactives/grid';
import type { GridArtwork } from '../interactives/GridBoard';
import type { GridPage, Lesson } from './types';
import { repeatingExplanations } from './repeatingExplanations';

const commands: readonly Command[] = ['forward', 'deliver', 'right', 'left'];
function problem(index: number, source: string, body: Command[], artwork: GridArtwork,
  repeatCount?: 3 | 5, check = false): GridPage {
  const parsed = parseMap(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return { kind: 'grid', map: parsed.map,
    asset: check ? `PracticeRepetitionTappyInsightSsExpPractice1V3_Problem${index}_Solvable`
      : `LessonRepetitionTappyInsightSsExpV14_Problem${index}_Solvable`,
    prompt: check ? ['**Complete the program.** Collect all the gems.'] : ['Complete all the deliveries.'],
    bank: check || index === 4 ? commands : commands.slice(0, 2),
    slotCount: body.length, referenceProgram: body, artwork, repeatCount,
    grading: 'delivered-goals', stepMs: check || !repeatCount ? 1000 / 3 : 200,
    xp: check || index < 3 ? 15 : 40, retryable: !check,
    explanation: repeatingExplanations[`${check ? 'check' : 'lesson'}${index}`] };
}
const p1 = problem(1, '>XXX..', ['forward', 'deliver', 'forward', 'deliver', 'forward', 'deliver'], 'broadway');
const p2 = problem(2, '>XXXXX', ['forward', 'deliver'], 'fifth-avenue', 5);
const p3 = problem(3, '>X.X.X.', ['forward', 'deliver', 'forward'], 'park-avenue', 3);
const p4 = problem(4, '...\nXX.\n^X.', ['forward', 'deliver', 'right'], 'mission-cove', 3);
const checks = [
  problem(1, '>.X.X.X', ['forward', 'forward', 'deliver'], 'robot', 3, true),
  problem(2, 'XXXXX<', ['forward', 'deliver'], 'robot', 5, true),
  problem(3, 'XX\n^X', ['forward', 'deliver', 'right'], 'robot', 3, true),
];

export const repeatingPatterns: Lesson = {
  slug: 'repetition-tappy-insight-ss-exp', version: 'v14', title: 'Repeating Patterns',
  route: '/courses/thinking-in-code/first-steps-cs/repetition-tappy-insight-ss-exp/',
  courseRoute: '/courses/thinking-in-code/', xpPerProblem: 15,
  completion: { color: '#d3b8ff', riveColor: 5, levelNumber: 1 },
  checks: { slug: 'repetition-tappy-insight-ss-exp-practice-1', version: 'v3', pages: checks },
  pages: [p1, {
    kind: 'repeating-equivalence', asset: 'LessonRepetitionTappyInsightSsExpV14_Interactive1',
    paragraphs: ['Since the pattern repeats, we can use a loop.'],
  }, p2, p3, p4, {
    kind: 'repeating-python', asset: 'LessonRepetitionTappyInsightSsExpV14_Interactive2',
    paragraphs: ['Loops are a common tool for repeating patterns with code.'],
  }],
};
