import { parseMap } from '../interactives/grid';
import type { Command } from '../interactives/grid';
import type { GridArtwork } from '../interactives/GridBoard';
import type { GridPage, Lesson } from './types';
import { debuggingExplanations } from './debuggingExplanations';

const command = { F: 'forward', D: 'deliver', L: 'left', R: 'right' } as const;
const program = (text: string): Command[] => [...text].map(c => command[c as keyof typeof command]);
function problem(index: number, source: string, initial: string, answer: string,
  repeatCount: 3 | 4 | 5, artwork: GridArtwork, check = false): GridPage {
  const parsed = parseMap(source);
  if (!parsed.ok) throw new Error(parsed.error);
  const prefix = check ? 'PracticeModifyingProgramsTappyInsightSsExpPractice1V3' : 'LessonModifyingProgramsTappyInsightSsExpV13';
  return { kind: 'grid', asset: `${prefix}_Problem${index}_Solvable`, map: parsed.map,
    prompt: check ? ['**Reorder the commands to debug the program.** Collect all the gems.']
      : ['Fix the program to complete all the deliveries.'],
    bank: [], slotCount: initial.length, initialProgram: program(initial),
    referenceProgram: program(answer), repeatCount, artwork, grading: 'delivered-goals',
    stepMs: check ? index === 3 ? 100 : 1000 / 3 : 200, retryable: !check,
    xp: !check && index === 4 ? 40 : 15,
    explanation: debuggingExplanations[`${check ? 'check' : 'lesson'}${index}`] };
}
const problems = [
  problem(1, '>XXXX.', 'DF', 'FD', 4, 'canal-street'),
  problem(2, '.X.\nX.X\n^X.', 'FDRF', 'FDFR', 4, 'mission-cove'),
  problem(3, '....\n.X^.\n.XX.\n....', 'FDL', 'LFD', 3, 'financial-district'),
  problem(4, '....X\n...X.\n..X..\n.X...\n^....', 'FLDFR', 'FRFDL', 4, 'market-district'),
];
export const debuggingPrograms: Lesson = {
  slug: 'modifying-programs-tappy-insight-ss-exp', version: 'v13', title: 'Debugging Programs',
  route: '/courses/thinking-in-code/first-steps-cs/modifying-programs-tappy-insight-ss-exp/',
  courseRoute: '/courses/thinking-in-code/', xpPerProblem: 15,
  completion: { color: '#d3b8ff', riveColor: 5, levelNumber: 1 },
  checks: { slug: 'modifying-programs-tappy-insight-ss-exp-practice-1', version: 'v3', pages: [
    problem(1, 'X.X\n...\n^.X', 'FDFR', 'FFDR', 3, 'robot', true),
    problem(2, '>X.X.X.X.', 'DFF', 'FDF', 4, 'robot', true),
    problem(3, '....XX\n...XX.\n..XX..\n.XX...\nXX....\n^.....', 'FDRDLF', 'FDRFDL', 5, 'robot', true),
  ] },
  pages: [problems[0], problems[1], {
    kind: 'debugging-example', asset: 'LessonModifyingProgramsTappyInsightSsExpV13_Interactive1',
    paragraphs: ['To debug a loop, picture what happens in the first repetition.'],
    afterParagraphs: ['This can help you spot the problem and fix it.'],
  }, problems[2], problems[3], {
    kind: 'debugging-python', asset: 'LessonModifyingProgramsTappyInsightSsExpV13_Interactive2',
    paragraphs: ["It's so common to debug programs that it's considered a crucial programming skill."],
  }],
};
