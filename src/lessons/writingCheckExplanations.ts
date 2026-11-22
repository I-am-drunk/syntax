// Data-only proposal for the three Writing Programs v4 checks.
// Attach by index to checkDefinitions/checkPages, never to ordinary gridPages.
export const writingCheckExplanations = [
  {
    asset: 'PracticeTappyTicOnboardSet1V4_Problem1_Explanation',
    program: ['forward', 'left', 'forward'],
    fixedStepMs: 1000 / 60,
    steps: [
      { end: 0, text: "Here is a correct program. Let's go through it step by step." },
      { end: 2, text: 'The program moves the robot forward and turns it to the left.' },
      { end: 3, text: 'After that, another `move forward` command makes the robot reach the gem.' },
    ],
  },
  {
    asset: 'PracticeTappyTicOnboardSet1V4_Problem2_Explanation',
    program: ['right', 'forward', 'forward'],
    fixedStepMs: 1000 / 60,
    steps: [
      { end: 0, text: "Here is a correct program. Let's go through it step by step." },
      { end: 2, text: 'The program turns the robot right first, and then moves it forward.' },
      { end: 3, text: 'After that, moving forward once more makes the robot reach the gem.' },
    ],
  },
  {
    asset: 'PracticeTappyTicOnboardSet1V4_Problem3_Explanation',
    program: ['forward', 'forward', 'right', 'forward', 'forward'],
    fixedStepMs: 1000 / 60,
    steps: [
      { end: 0, text: "Here is a correct program. Let's go through it step by step." },
      { end: 3, text: 'The program moves the robot forward twice and turns it to the right.' },
      { end: 5, text: 'After that, moving forward twice more makes the robot reach the gem.' },
    ],
  },
] as const;
