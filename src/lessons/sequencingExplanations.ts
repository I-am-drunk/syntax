import type { GridPage } from './types';

export const sequencingLessonExplanations = [
  {
    asset: 'LessonSequencingCommandsSsExpV15_Problem1_Explanation',
    program: ["forward", "deliver"],
    mode: 'delivery', durationMs: 200, fixedStepMs: 1000 / 60,
    steps: [
      {"end": 0, "text": "Here's the correct program. Let's step through it line by line."},
      {"end": 1, "text": "To get to the delivery location, the truck drives forward."},
      {"end": 2, "text": "When the truck is at the right location, it delivers the package."},
    ],
    rowEmphasis: [[1, 1], [1, 0], [0, 1]],
  },
  {
    asset: 'LessonSequencingCommandsSsExpV15_Problem2_Explanation',
    program: ["right", "forward", "deliver"],
    mode: 'delivery', durationMs: 600, fixedStepMs: 1000 / 60,
    steps: [
      {"end": 0, "text": "Let's step through the correct program line by line."},
      {"end": 1, "text": "The truck turns right to face the delivery. Turning only changes the orientation of the truck."},
      {"end": 2, "text": "Then the truck drives forward to get to delivery."},
      {"end": 3, "text": "There, it delivers the package."},
    ],
    rowEmphasis: [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
    roadLayout: 'perimeter',
  },
  {
    asset: 'LessonSequencingCommandsSsExpV15_Problem3_Explanation',
    program: ["forward", "deliver", "right", "forward", "deliver"],
    mode: 'delivery', durationMs: 600, fixedStepMs: 1000 / 60,
    steps: [
      {"end": 0, "text": "Let's step through the correct program."},
      {"end": 2, "text": "After driving forward, the truck delivers the first package."},
      {"end": 4, "text": "From there, the truck turns right and drives forward to get to next delivery."},
      {"end": 5, "text": "Then it delivers the second package."},
    ],
    rowEmphasis: [[1, 1, 1, 1, 1], [1, 1, 0, 0, 0], [0, 0, 1, 1, 0], [0, 0, 0, 0, 1]],
  },
] as const satisfies readonly NonNullable<GridPage['explanation']>[];

export const sequencingCheckExplanations = [
  {
    asset: 'PracticeSequencingCommandsSsExpPractice1V4_Problem1_Explanation',
    program: ["forward", "left", "forward", "deliver"],
    mode: 'collection', durationMs: 600, fixedStepMs: 1000 / 60,
    steps: [
      {"end": 0, "text": "Here is a correct program. Let's go through it step by step."},
      {"end": 2, "text": "The program moves the robot forward and turns it to the left."},
      {"end": 3, "text": "After turning to the left, another `move forward` command makes the robot reach the gem."},
      {"end": 4, "text": "Finally, the `collect gem` command makes the robot collect the gem."},
    ],
    rowEmphasis: [[1, 1, 1, 1], [1, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  },
  {
    asset: 'PracticeSequencingCommandsSsExpPractice1V4_Problem2_Explanation',
    program: ["right", "forward", "deliver"],
    mode: 'collection', durationMs: 600, fixedStepMs: 1000 / 60,
    steps: [
      {"end": 0, "text": "Here's one correct solution. Let's go through it step by step."},
      {"end": 1, "text": "Because the robot is facing up, it needs to `turn right` first in order to face the gem."},
      {"end": 3, "text": "Now that the robot is facing the gem, it can move forward and collect the gem."},
    ],
    rowEmphasis: [[1, 1, 1], [1, 0, 0], [0, 1, 1]],
  },
  {
    asset: 'PracticeSequencingCommandsSsExpPractice1V4_Problem3_Explanation',
    program: ["forward", "deliver", "forward", "forward", "deliver"],
    mode: 'collection', durationMs: 600, fixedStepMs: 1000 / 60,
    steps: [
      {"end": 0, "text": "Here is the correct program. Let's go through it step by step."},
      {"end": 1, "text": "The robot moves forward to get to the first gem."},
      {"end": 2, "text": "Then the robot collects the first gem."},
      {"end": 4, "text": "Then the robot moves forward twice to get to the second gem."},
      {"end": 5, "text": "Once it's there, the robot collects the second gem."},
    ],
    rowSegments: [{"from": [1, 1, 1, 1, 1], "to": [1, 0, 0, 0, 0]}, {"from": [1, 0, 0, 0, 0], "to": [0, 1, 0, 0, 0]}, {"from": [0, 1, 0, 0, 0], "to": [0, 0, 0, 1, 0]}, {"from": [0, 0, 1, 1, 0], "to": [0, 0, 0, 0, 1]}],
  },
] as const satisfies readonly NonNullable<GridPage['explanation']>[];

