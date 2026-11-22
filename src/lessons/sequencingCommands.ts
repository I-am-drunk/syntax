import { parseMap } from '../interactives/grid';
import type { Command } from '../interactives/grid';
import type { GridPage, Lesson } from './types';
import { sequencingLessonExplanations, sequencingCheckExplanations } from './sequencingExplanations';

const programs: readonly Command[][] = [
  ['forward', 'deliver'], ['right', 'forward', 'deliver'],
  ['forward', 'deliver', 'right', 'forward', 'deliver'],
];
const maps = ['>X....', '^X..\n....\n....\n....', '....\n.>X.\n..X.\n....'];
const prompts = ['Drive forward and deliver the package.', 'Complete the delivery.', 'Complete the deliveries.'];
const artwork = ['solitary-street', 'botanical-district', 'financial-district'] as const;
const problems: GridPage[] = maps.map((source, i) => {
  const parsed = parseMap(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return { kind: 'grid', asset: `LessonSequencingCommandsSsExpV15_Problem${i + 1}_Solvable`,
    map: parsed.map, prompt: [prompts[i]], slotCount: programs[i].length,
    explanation: sequencingLessonExplanations[i],
    bank: i === 0 ? ['forward', 'deliver'] : ['forward', 'deliver', 'right', 'left'],
    referenceProgram: programs[i], artwork: artwork[i], grading: 'delivered-goals', stepMs: 1000 / 3 };
});

const checkMaps = ['.X\n>.', '..\n^X', 'X.X<'];
const initial: readonly Command[][] = [
  ['forward', 'forward', 'deliver', 'left'], ['forward', 'deliver', 'right'],
  ['forward', 'forward', 'forward', 'deliver', 'deliver'],
];
const answers: readonly Command[][] = [
  ['forward', 'left', 'forward', 'deliver'], ['right', 'forward', 'deliver'],
  ['forward', 'deliver', 'forward', 'forward', 'deliver'],
];
const checkPages: GridPage[] = checkMaps.map((source, i) => {
  const parsed = parseMap(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return { kind: 'grid', asset: `PracticeSequencingCommandsSsExpPractice1V4_Problem${i + 1}_Solvable`,
    map: parsed.map, prompt: [`**Reorder the program commands.** Make the robot collect the ${i === 2 ? 'gems' : 'gem'}.`],
    bank: [], slotCount: initial[i].length, initialProgram: initial[i], referenceProgram: answers[i],
    explanation: sequencingCheckExplanations[i],
    artwork: 'robot', grading: 'delivered-goals', stepMs: 1000 / 3, retryable: false };
});

export const sequencingCommands: Lesson = {
  slug: 'sequencing-commands-ss-exp', version: 'v15', title: 'Sequencing Commands',
  route: '/courses/thinking-in-code/first-steps-cs/sequencing-commands-ss-exp/',
  courseRoute: '/courses/thinking-in-code/', xpPerProblem: 15,
  completion: { color: '#d3b8ff', riveColor: 5, levelNumber: 1 },
  checks: { slug: 'sequencing-commands-ss-exp-practice-1', version: 'v4', pages: checkPages },
  pages: [problems[0], problems[1], {
    kind: 'sequencing-program', asset: 'LessonSequencingCommandsSsExpV15_Interactive1',
    paragraphs: ['Programs are precise instructions that describe how to complete a task.'],
  }, problems[2], {
    kind: 'sequencing-python', asset: 'LessonSequencingCommandsSsExpV15_Interactive2',
    paragraphs: ['When designing a program, writing precise pseudocode is a great first step. Then you can translate the steps into a programming language like Python.'],
  }],
};
