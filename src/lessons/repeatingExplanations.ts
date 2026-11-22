import type { GridPage } from './types';

export const repeatingExplanations: Record<string, NonNullable<GridPage['explanation']>> = {
  lesson1: {
    asset: "LessonRepetitionTappyInsightSsExpV14_Problem1_Explanation",
    program: ["forward", "deliver", "forward", "deliver", "forward", "deliver"],
    steps: [{"end": 0, "text": "The correct program has a repeating pattern."}, {"end": 2, "text": "First, the truck drives forward and delivers the first package."}, {"end": 4, "text": "Then the truck drives forward again and delivers the second package. "}, {"end": 6, "text": "Finally the truck drives forward once more and delivers the third package. "}],
    durationMs: 400, fixedStepMs: 1000 / 60, mode: 'delivery',
    rowEmphasis: [[1, 1, 1, 1, 1, 1], [1, 1, 0, 0, 0, 0], [0, 0, 1, 1, 0, 0], [0, 0, 0, 0, 1, 1]],
  },
  lesson2: {
    asset: "LessonRepetitionTappyInsightSsExpV14_Problem2_Explanation",
    program: ["forward", "deliver", "forward", "deliver", "forward", "deliver", "forward", "deliver", "forward", "deliver"],
    steps: [{"end": 0, "text": "Here's the correct program. Let's understand how it works."}, {"end": 2, "text": "The pattern to repeat is driving forward and delivering a package. These commands go inside the repeat loop."}, {"end": 10, "text": "The truck should repeat this pattern a total of 5 times, so the repeat loop is set to 5."}],
    durationMs: 400, fixedStepMs: 1000 / 60, mode: 'delivery', repeatCount: 5,
    rowEmphasis: [[1, 1, 1], [0, 1, 1], [1, 0, 0]],
  },
  lesson3: {
    asset: "LessonRepetitionTappyInsightSsExpV14_Problem3_Explanation",
    program: ["forward", "deliver", "forward", "forward", "deliver", "forward", "forward", "deliver", "forward"],
    steps: [{"end": 0, "text": "Here's the correct program. Let's understand how it works."}, {"end": 3, "text": "The pattern to repeat is driving forward, delivering a package, then driving forward again. These commands go inside the repeat loop."}, {"end": 9, "text": "The truck should repeat this pattern a total of 3 times, so the repeat loop is set to 3."}],
    durationMs: 500, fixedStepMs: 1000 / 60, mode: 'delivery', repeatCount: 3,
    rowEmphasis: [[1, 1, 1, 1], [0, 1, 1, 1], [1, 0, 0, 0]],
  },
  lesson4: {
    asset: "LessonRepetitionTappyInsightSsExpV14_Problem4_Explanation",
    program: ["forward", "deliver", "right", "forward", "deliver", "right", "forward", "deliver", "right"],
    steps: [{"end": 0, "text": "Let's analyze the correct program."}, {"end": 2, "text": "Each repetition, the truck drives forward and delivers a package."}, {"end": 3, "text": "Each repetition, the truck turns right to face the next delivery location."}, {"end": 9, "text": "Repeating these commands a total of 3 times completes deliveries in a square pattern."}],
    durationMs: 400, fixedStepMs: 1000 / 60, mode: 'delivery', repeatCount: 3,
    rowEmphasis: [[1, 1, 1, 1], [0, 1, 1, 0], [0, 0, 0, 1], [1, 0, 0, 0]],
  },
  check1: {
    asset: "PracticeRepetitionTappyInsightSsExpPractice1V3_Problem1_Explanation",
    program: ["forward", "forward", "deliver", "forward", "forward", "deliver", "forward", "forward", "deliver"],
    steps: [{"end": 0, "text": "Here's the correct program. Let's analyze it."}, {"end": 3, "text": "Inside the loop, the program moves the robot forward twice and collects a gem."}, {"end": 9, "text": "Repeating this pattern 3 times collects all 3 gems."}],
    durationMs: 900, fixedStepMs: 1000 / 60, mode: 'collection', repeatCount: 3,
    rowEmphasis: [[1, 1, 1, 1], [0, 1, 1, 1], [1, 0, 0, 0]],
  },
  check2: {
    asset: "PracticeRepetitionTappyInsightSsExpPractice1V3_Problem2_Explanation",
    program: ["forward", "deliver", "forward", "deliver", "forward", "deliver", "forward", "deliver", "forward", "deliver"],
    steps: [{"end": 0, "text": "The correct program repeats a pattern 5 times. Let's analyze it."}, {"end": 2, "text": "The pattern to repeat involves first moving forward and then collecting a gem."}, {"end": 10, "text": "Repeating this pattern 5 times collects all 5 gems."}],
    durationMs: 900, fixedStepMs: 1000 / 60, mode: 'collection', repeatCount: 5,
    rowEmphasis: [[1, 1, 1], [0, 1, 1], [1, 0, 0]],
  },
  check3: {
    asset: "PracticeRepetitionTappyInsightSsExpPractice1V3_Problem3_Explanation",
    program: ["forward", "deliver", "right", "forward", "deliver", "right", "forward", "deliver", "right"],
    steps: [{"end": 0, "text": "Here's the correct program. Let's analyze it."}, {"end": 2, "text": "Each repetition, the car moves forward and collects a gem."}, {"end": 3, "text": "Each repetition, the car also needs to turn right to face the next gem."}, {"end": 9, "text": "Repeating this pattern 3 times collects all the gems."}],
    durationMs: 600, fixedStepMs: 1000 / 60, mode: 'collection', repeatCount: 3,
    rowEmphasis: [[1, 1, 1, 1], [0, 1, 1, 0], [0, 0, 0, 1], [1, 0, 0, 0]],
  },
};
