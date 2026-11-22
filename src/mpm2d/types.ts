import type { StepAnswerSpec } from './mathParser'

export type GeoColor = 'blue' | 'teal' | 'amber' | 'violet' | 'green' | 'red' | 'muted' | 'ink'

export type GeoPoint = {
  id: string
  x: number
  y: number
  label?: string
  showCoords?: boolean
  color?: GeoColor
  emphasis?: boolean
  dim?: boolean
  group?: string
}

export type GeoSegment = {
  from: [number, number]
  to: [number, number]
  color?: GeoColor
  dashed?: boolean
  width?: number
  label?: string
  ticks?: 1 | 2 // equal-length tick marks
  dim?: boolean
  group?: string
}

export type GeoLine = {
  // ax + by + c = 0
  a: number
  b: number
  c: number
  color?: GeoColor
  dashed?: boolean
  label?: string
  width?: number
  dim?: boolean
  group?: string
}

export type GeoPolygon = {
  vertices: [number, number][]
  color?: GeoColor
  fillOpacity?: number
  dim?: boolean
  group?: string
}

export type GeoCircle = {
  cx: number
  cy: number
  r: number
  color?: GeoColor
  dashed?: boolean
  label?: string
  dim?: boolean
  group?: string
}

export type GeoRightAngle = {
  vertex: [number, number]
  dir1: [number, number] // direction vector 1 from vertex
  dir2: [number, number] // direction vector 2 from vertex
  color?: GeoColor
  dim?: boolean
  group?: string
}

export type GeoRiseRun = {
  from: [number, number]
  to: [number, number]
  color?: GeoColor
  showLabels?: boolean
  dim?: boolean
  group?: string
}

export type GeoScene = {
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  showGrid?: boolean
  showAxisNumbers?: boolean
  showHoverCoords?: boolean
  polygons?: GeoPolygon[]
  circles?: GeoCircle[]
  lines?: GeoLine[]
  segments?: GeoSegment[]
  riseRuns?: GeoRiseRun[]
  rightAngles?: GeoRightAngle[]
  points?: GeoPoint[]
}

export type WorkedStep = {
  heading: string
  explanation: string
  mathLines: string[]
  scene: GeoScene
}

export type WorkedExample = {
  id: string
  source: string // e.g. "Alex's Notes · Oct 22"
  title: string
  question: string
  plan: string[]
  steps: WorkedStep[]
  takeaway: string
}

export type GuidedStep = {
  id: string
  label: string // e.g. "Step 1 : Find the midpoint of AB"
  prompt: string
  placeholder?: string
  answer: StepAnswerSpec
  hint: string
  workedLine: string // shown after solved or when viewing solution
  sceneOnSolve?: Partial<GeoScene> // merged into problem's base scene when this step is solved
}

export type GuidedProblem = {
  id: string
  source: string // e.g. "Handout W2 · #1a"
  title: string
  question: string
  plan?: string[] // shown in Guided Practice; hidden or collapsible in Try It Yourself
  independent?: boolean // if true, treated as unassisted practice (plan tucked behind toggle)
  baseScene: GeoScene
  steps: GuidedStep[]
  fullSolution: string[]
}

export type LessonDef = {
  id: string
  number: number
  title: string
  shortTitle: string
  subtitle: string
  dateTag: string
  sourceLabel: string
  plainIntro: string
  explorationId:
    | 'slope-perp'
    | 'midpoint'
    | 'median'
    | 'length-circle'
    | 'right-triangle'
    | 'shortest-distance'
    | 'three-lines'
    | 'shape-properties'
    | 'conference-overview'
  workedExamples: WorkedExample[]
  guidedProblems: GuidedProblem[]
  independentProblems: GuidedProblem[]
}

// Lesson 9: Tuesday U2 Conference : Making & Reading Plans
export type PlanBlock = {
  id: string
  text: string
  category: 'midpoint' | 'slope' | 'line' | 'poi' | 'length' | 'compare'
}

export type ValidPlan = {
  name: string
  steps: string[]
  explanation: string
}

export type MakePlanScenario = {
  id: string
  title: string
  question: string
  scene: GeoScene
  pool: PlanBlock[]
  // Multiple valid ordered plans (arrays of block ids)
  validPlans: ValidPlan[]
  missingFeedback?: { missingId: string; message: string }[]
  orderFeedback?: { before: string; after: string; message: string }[]
}

export type ReadPlanScenario = {
  id: string
  title: string
  given: string
  planSteps: { text: string; scene: GeoScene }[]
  options: { id: string; label: string; whyWrong?: string }[]
  correctOptionId: string
  explanation: string
}
