import { parseMap } from '../interactives/grid';
import type { Command } from '../interactives/grid';
import type { GridPage, Lesson } from './types';
import { writingCheckExplanations } from './writingCheckExplanations';

const maps = ['...\nX^.\n...', '...\n^X.\n...', '...\n.X.\n^..', '..X.\n....\n.^..\n....'];
const programs: readonly Command[][] = [
  ['left', 'forward'], ['right', 'forward'],
  ['forward', 'right', 'forward'], ['forward', 'forward', 'right', 'forward'],
];
const prompts = [
  ['Tap the blocks to write a program. Make the self-driving truck reach the delivery spot.'],
  ['Program the truck to reach the delivery spot.', "You don't have to use all the available code blocks."],
  ['Program the truck to reach the delivery spot.', 'You can use the same code block more than once.'],
  ['Program the truck to reach the delivery spot.'],
];
const gridPages: GridPage[] = maps.map((source, index) => {
  const parsed = parseMap(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return {
    kind: 'grid', asset: `LessonTappyOnboardingTicV18_Problem${index + 1}_Solvable`,
    map: parsed.map, prompt: prompts[index], slotCount: programs[index].length,
    bank: index === 0 ? ['left', 'forward'] : ['forward', 'right', 'left'],
    referenceProgram: programs[index],
    artwork: index === 3 ? 'financial-district' : 'mission-cove',
  };
});

const checkDefinitions = [
  {
    "asset": "PracticeTappyTicOnboardSet1V4_Problem1_Solvable",
    "map": "...\nX..\n.^.",
    "initial": [
      "forward",
      "forward",
      "left"
    ],
    "answer": [
      "forward",
      "left",
      "forward"
    ],
    "prompt": "**Drag to reorder the program commands.** Make the robot reach the gem."
  },
  {
    "asset": "PracticeTappyTicOnboardSet1V4_Problem2_Solvable",
    "map": "...\n...\n^.X",
    "initial": [
      "forward",
      "right",
      "forward"
    ],
    "answer": [
      "right",
      "forward",
      "forward"
    ],
    "prompt": "**Reorder the program commands.** Make the robot reach the gem."
  },
  {
    "asset": "PracticeTappyTicOnboardSet1V4_Problem3_Solvable",
    "map": "..X\n...\n^..",
    "initial": [
      "forward",
      "forward",
      "forward",
      "forward",
      "right"
    ],
    "answer": [
      "forward",
      "forward",
      "right",
      "forward",
      "forward"
    ],
    "prompt": "**Reorder the program commands.** Make the robot reach the gem."
  }
] as const;
const checkPages: GridPage[] = checkDefinitions.map((definition, index) => {
  const parsed = parseMap(definition.map);
  if (!parsed.ok) throw new Error(parsed.error);
  return { kind: 'grid', asset: definition.asset, map: parsed.map,
    prompt: [definition.prompt], bank: [], slotCount: definition.initial.length,
    initialProgram: definition.initial, referenceProgram: definition.answer,
    explanation: writingCheckExplanations[index],
    grading: 'reference-program', artwork: 'robot', stepMs: 1000 / 3, retryable: false };
});

export const writingPrograms: Lesson = {
  slug: 'tappy-onboarding-tic', version: 'v18', title: 'Writing Programs',
  route: '/courses/thinking-in-code/first-steps-cs/tappy-onboarding-tic/',
  courseRoute: '/courses/thinking-in-code/', xpPerProblem: 15,
  completion: { color: '#d3b8ff', riveColor: 5, levelNumber: 1 },
  checks: { slug: 'tappy-tic-onboard-set1', version: 'v4', pages: checkPages },
  pages: [
    {
      kind: 'introduction', asset: 'LessonTappyOnboardingTicV18_Interactive1',
      title: 'Writing Programs',
      // Preserve the punctuation of the captured V18 lesson copy.
      paragraphs: ["Programs are instructions. You already know how to write them, so let's prove it."],
    },
    ...gridPages,
    {
      kind: 'conclusion', asset: 'LessonTappyOnboardingTicV18_Interactive2',
      paragraphs: [
        'You exercised an important coding skill: using the right commands in the right order.',
        "In this course, you'll learn to use **loops, logic, and variables** to solve increasingly complex problems with code.",
      ],
    },
  ],
};
