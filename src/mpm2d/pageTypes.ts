import type { GeoScene, PlanBlock } from './types'
import type { StepAnswerSpec } from './mathParser'

export type ExplorationKind =
  | 'slope-perp'
  | 'midpoint'
  | 'median'
  | 'length-circle'
  | 'right-triangle'
  | 'shortest-distance'
  | 'three-lines'
  | 'shape-properties'

export type ExplanationStep = {
  text: string
  math?: string
  scene: GeoScene
}

export type GeoExplanation = {
  steps: ExplanationStep[]
}

export type ChoiceOption = {
  id: string
  label: string
  hint?: string
}

export type ExplorePage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'explore'
  prompt: string
  exploration: ExplorationKind
}

export type WorkedPage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  /** Explicitly tag whether this page counts as a lesson-type question */
  isLessonQuestion?: boolean
  kind: 'worked'
  source: string
  prompt: string
  plan: string[]
  /** Optional page-wide pre-answer graph showing only the given setup */
  preScene?: GeoScene
  steps: {
    heading: string
    mathLines: string[]
    /** Optional pre-reveal graph showing only the given setup for this step */
    preScene?: GeoScene
    scene: GeoScene
  }[]
  /** 3 plausible multiple-choice answers used to verify worksheet work in Draw Mode */
  checkChoice?: {
    prompt?: string
    options: ChoiceOption[]
    correctId: string
  }
}

export type ChoicePage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'choice'
  source?: string
  prompt: string
  /** Optional step-list layout for Spot-the-Broken-Step / Flawed-Plan cards */
  layout?: 'default' | 'steps'
  scene?: GeoScene
  solvedScene?: GeoScene
  options: ChoiceOption[]
  correctId: string
  explanation: GeoExplanation
}

export type MultiChoicePage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'multi-choice'
  source?: string
  prompt: string
  scene?: GeoScene
  options: ChoiceOption[]
  correctIds: string[]
  explanation: GeoExplanation
}

export type MathInputPage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'math-input'
  source?: string
  prompt: string
  placeholder?: string
  /** Optional numbered plan shown above the problem and stampable onto the pen canvas */
  plan?: string[]
  /** Optional non-spoiling Step-1 nudge surfaced after a first wrong attempt */
  nudge?: string
  scene: GeoScene
  solvedScene?: GeoScene
  answer: Exclude<StepAnswerSpec, { kind: 'choice' }>
  explanation: GeoExplanation
}

export type PlanOrderPage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'plan-order'
  source?: string
  prompt: string
  /** Start with tile bank veiled for cold-recall oral conference practice */
  defaultOralTest?: boolean
  scene: GeoScene
  pool: PlanBlock[]
  validPlans: {
    name: string
    steps: string[]
    explanation: string
  }[]
  missingFeedback?: { missingId: string; message: string }[]
  orderFeedback?: { before: string; after: string; message: string }[]
  explanation: GeoExplanation
}

export type ReadPlanPage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'read-plan'
  source?: string
  prompt: string
  /** Conference Exam Mode: hide diagram until submitted (or Peek Sketch clicked) */
  blindScene?: boolean
  planSteps: { text: string; scene: GeoScene }[]
  options: ChoiceOption[]
  correctId: string
  explanation: GeoExplanation
}

export type MultiStepItem = {
  id: string
  /** Short editorial label for the ① ② ③ ledger (e.g., "Midpoint of BC") */
  label: string
  /** Step prompt shown while this step is active */
  prompt: string
  placeholder?: string
  nudge?: string
  /** Graph scene shown BEFORE this step is solved */
  scene: GeoScene
  /** Graph scene drawn in smoothly AFTER this step is solved */
  solvedScene: GeoScene
  /** Clean short result written onto the completed ledger line (e.g., "M = (3, 1)") */
  ledgerResult: string
  answer: Exclude<StepAnswerSpec, { kind: 'choice' }>
}

export type MultiStepPage = {
  id: string
  /** Explicitly enable or disable the Pen PDF sheet on this page */
  penEnabled?: boolean
  kind: 'multi-step'
  source?: string
  prompt: string
  /** Full numbered plan stampable onto the pen canvas */
  plan: string[]
  steps: MultiStepItem[]
  explanation: GeoExplanation
}

export type GeoLessonPage =
  | ExplorePage
  | WorkedPage
  | ChoicePage
  | MultiChoicePage
  | MathInputPage
  | PlanOrderPage
  | ReadPlanPage
  | MultiStepPage

export type GeoLesson = {
  id: string
  level: 1 | 2 | 3 | 4
  number: number
  title: string
  shortTitle: string
  subtitle: string
  isReview?: boolean
  completionColor: string
  completionRiveColor: number
  pages: GeoLessonPage[]
  checks: GeoLessonPage[]
}

export type CourseLevel = {
  level: 1 | 2 | 3 | 4
  label: string
  title: string
}

export const COURSE_LEVELS: CourseLevel[] = [
  { level: 1, label: 'Level 1', title: 'Core Tools' },
  { level: 2, label: 'Level 2', title: 'Perpendiculars & Proofs' },
  { level: 3, label: 'Level 3', title: 'Tue Nov 24 · Oral Conference Sprints' },
  { level: 4, label: 'Level 4', title: 'Thu Nov 26 · Open-Notes Mock' },
]

/**
 * Determine whether the Pen PDF worksheet should be enabled for a given page.
 * Pure interactive graph explorations and quick conceptual taps disable & gray out
 * the pen toggle so the student stays focused on the right tool for each question.
 */
export function isPenEnabledForPage(page: GeoLessonPage, isCheck: boolean): boolean {
  if (typeof page.penEnabled === "boolean") return page.penEnabled
  if (page.kind === "explore") return false
  if (isCheck) return true
  if (
    page.kind === "worked" ||
    page.kind === "math-input" ||
    page.kind === "multi-step" ||
    page.kind === "plan-order" ||
    page.kind === "read-plan"
  ) {
    return true
  }
  if (page.kind === "choice") {
    if (page.layout === "steps") return true
    const hasMathWork =
      /[=²√]|\([-−]?\d+\s*,\s*[-−]?\d+\)/.test(page.prompt) ||
      page.options.some(o => /[=²√]|\([-−]?\d+\s*,\s*[-−]?\d+\)/.test(o.label))
    return hasMathWork
  }
  if (page.kind === "multi-choice") {
    const hasMathWork =
      /[=²√]|\([-−]?\d+\s*,\s*[-−]?\d+\)/.test(page.prompt) ||
      page.options.some(o => /[=²√]|\([-−]?\d+\s*,\s*[-−]?\d+\)/.test(o.label))
    return hasMathWork
  }
  return false
}

export type PageClassification = 'explore' | 'worked' | 'lesson-question' | 'check'

/**
 * Explicit lesson-type question classification in code (tracked independently
 * of whether Draw Mode / Pen worksheet is enabled for the page).
 */
export function classifyLessonPage(page: GeoLessonPage, isCheck: boolean): PageClassification {
  if (isCheck) return 'check'
  if (page.kind === 'explore') return 'explore'
  if (page.kind === 'worked') return page.isLessonQuestion ? 'lesson-question' : 'worked'
  return 'lesson-question'
}

export function isLessonQuestionPage(page: GeoLessonPage, isCheck: boolean): boolean {
  return classifyLessonPage(page, isCheck) === 'lesson-question'
}
