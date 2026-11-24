import { build } from 'esbuild'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GeoLesson, GeoLessonPage } from '../../../src/mpm2d/pageTypes.js'
import type { CatchupLesson } from '../../../src/mpm2d/data/catchupCourses.js'
import type { GeoScene } from '../../../src/mpm2d/types.js'
import type { StepAnswerSpec, GradeResult } from '../../../src/mpm2d/mathParser.js'
import type { Viewport, GraphMode } from '../../../src/mpm2d/graph/math.js'
import type { PlacedLabel } from '../../../src/mpm2d/graph/labelLayout.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '../../..')

export interface LoadedSyntaxApp {
  UNIT2_LESSONS: GeoLesson[]
  CATCHUP_LESSONS: CatchupLesson[]
  ALL_LESSONS: (GeoLesson | CatchupLesson)[]
  gradeAnswer: (raw: string, spec: StepAnswerSpec) => GradeResult
  parseNumberExpr: (input: string) => unknown
  parsePointExpr: (input: string) => { x: number; y: number } | null
  parseLineExpr: (input: string) => { a: number; b: number; c: number; isSlopeIntercept: boolean; isVertical: boolean; slope: number | null; intercept: number | null } | null
  buildViewport: (scene: GeoScene, mode: GraphMode) => Viewport
  computeLabelLayout: (scene: GeoScene, vp: Viewport, mode: GraphMode) => PlacedLabel[]
  getWalkthroughForPage: (pageId: string) => unknown
}

let cached: LoadedSyntaxApp | null = null

export async function loadSyntaxApp(forceReload = false): Promise<LoadedSyntaxApp> {
  if (cached && !forceReload) return cached

  const entryCode = `
    export { UNIT2_LESSONS } from './src/mpm2d/data/unit2Course.ts';
    export { CATCHUP_LESSONS } from './src/mpm2d/data/catchupCourses.ts';
    export { gradeAnswer, parseNumberExpr, parsePointExpr, parseLineExpr } from './src/mpm2d/mathParser.ts';
    export { buildViewport } from './src/mpm2d/graph/math.ts';
    export { computeLabelLayout } from './src/mpm2d/graph/labelLayout.ts';
    export { getWalkthroughForPage } from './src/mpm2d/walkthrough/walkthroughData.ts';
  `

  const result = await build({
    stdin: {
      contents: entryCode,
      resolveDir: REPO_ROOT,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  })

  const jsCode = result.outputFiles[0].text
  const mod = await import(`data:text/javascript;base64,${Buffer.from(jsCode).toString('base64')}`)

  cached = {
    UNIT2_LESSONS: mod.UNIT2_LESSONS,
    CATCHUP_LESSONS: mod.CATCHUP_LESSONS,
    ALL_LESSONS: [...mod.UNIT2_LESSONS, ...mod.CATCHUP_LESSONS],
    gradeAnswer: mod.gradeAnswer,
    parseNumberExpr: mod.parseNumberExpr,
    parsePointExpr: mod.parsePointExpr,
    parseLineExpr: mod.parseLineExpr,
    buildViewport: mod.buildViewport,
    computeLabelLayout: mod.computeLabelLayout,
    getWalkthroughForPage: mod.getWalkthroughForPage,
  }
  return cached
}

export function findPageInLessons(
  lessons: (GeoLesson | CatchupLesson)[],
  pageId: string,
): { lesson: GeoLesson | CatchupLesson; page: GeoLessonPage; isCheck: boolean; index: number } | null {
  for (const lesson of lessons) {
    const pIdx = lesson.pages.findIndex(p => p.id === pageId)
    if (pIdx >= 0) return { lesson, page: lesson.pages[pIdx], isCheck: false, index: pIdx }
    const cIdx = lesson.checks.findIndex(c => c.id === pageId)
    if (cIdx >= 0) return { lesson, page: lesson.checks[cIdx], isCheck: true, index: cIdx }
  }
  return null
}
