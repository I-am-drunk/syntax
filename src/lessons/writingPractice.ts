import { parseMap } from '../interactives/grid';
import type { Command } from '../interactives/grid';
import type { GridPage, Lesson } from './types';

const maps = ['...\n.X.\n..^', '...\n...\nX.^', 'X..\n...\n..^'];
const initial: readonly Command[][] = [
  ['forward', 'forward', 'left'], ['forward', 'left', 'forward'],
  ['forward', 'forward', 'forward', 'forward', 'left'],
];
const answers: readonly Command[][] = [
  ['forward', 'left', 'forward'], ['left', 'forward', 'forward'],
  ['forward', 'forward', 'left', 'forward', 'forward'],
];
const explanations = [
  ["The program moves the robot forward and turns it to the left.",
    "After turning to the left, another `move forward` command makes the robot reach the gem."],
  ["The program turns the robot left first, and then moves it forward.",
    "After that, moving forward once more makes the robot reach the gem."],
  ["The program moves the robot forward twice and turns it to the left.",
    "After that, moving forward twice more makes the robot reach the gem."],
];

const pages: GridPage[] = maps.map((text, index) => {
  const parsed = parseMap(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    kind: 'grid', asset: `PracticeTappyTicOnboardSet2V3_Problem${index + 1}_Solvable`,
    prompt: ['**Reorder the program commands.** Make the robot reach the gem.'],
    map: parsed.map, bank: [], slotCount: initial[index].length,
    initialProgram: initial[index], referenceProgram: answers[index],
    grading: 'reference-program', artwork: 'robot', stepMs: 1000 / 3, retryable: false,
    explanation: {
      asset: `PracticeTappyTicOnboardSet2V3_Problem${index + 1}_Explanation`,
      program: answers[index],
      steps: [
        { end: 0, text: "Here is a correct program. Let's go through it step by step." },
        { end: index === 2 ? 3 : 2, text: explanations[index][0] },
        { end: answers[index].length, text: explanations[index][1] },
      ],
    },
  };
});

export const writingPractice: Lesson = {
  kind: 'practice', slug: 'tappy-tic-onboard-set2', version: 'v3',
  title: 'Writing Programs Practice',
  route: '/courses/thinking-in-code/first-steps-cs/practice/tappy-tic-onboard-set2/',
  courseRoute: '/courses/thinking-in-code/', xpPerProblem: 15,
  completion: { color: '#d3b8ff', riveColor: 5, levelNumber: 1 },
  pages,
};
