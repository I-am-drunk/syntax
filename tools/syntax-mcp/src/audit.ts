import type { GeoLesson, GeoLessonPage } from '../../../src/mpm2d/pageTypes.js'
import type { GeoLine, GeoScene } from '../../../src/mpm2d/types.js'
import { loadSyntaxApp, findPageInLessons, type LoadedSyntaxApp } from './loader.js'
import type { AuditFinding, ToolResult } from './types.js'

function distPointToLine(px: number, py: number, line: Pick<GeoLine, 'a' | 'b' | 'c'>): number {
  const denom = Math.hypot(line.a, line.b)
  if (denom < 1e-9) return Infinity
  return Math.abs(line.a * px + line.b * py + line.c) / denom
}

function linesEquivalent(
  l1: Pick<GeoLine, 'a' | 'b' | 'c'>,
  l2: Pick<GeoLine, 'a' | 'b' | 'c'>,
  tol = 1e-2,
): boolean {
  const n1 = Math.hypot(l1.a, l1.b)
  const n2 = Math.hypot(l2.a, l2.b)
  if (n1 < 1e-9 || n2 < 1e-9) return false
  const a1 = l1.a / n1, b1 = l1.b / n1, c1 = l1.c / n1
  const a2 = l2.a / n2, b2 = l2.b / n2, c2 = l2.c / n2
  const same = Math.abs(a1 - a2) < tol && Math.abs(b1 - b2) < tol && Math.abs(c1 - c2) < tol
  const opp = Math.abs(a1 + a2) < tol && Math.abs(b1 + b2) < tol && Math.abs(c1 + c2) < tol
  return same || opp
}

function checkScene(
  app: LoadedSyntaxApp,
  scene: GeoScene,
  lessonId: string,
  pageId: string,
  sceneLabel: string,
  findings: AuditFinding[],
) {
  // 1. Bounds validity
  if (
    scene.xMin !== undefined &&
    scene.xMax !== undefined &&
    scene.xMin >= scene.xMax
  ) {
    findings.push({
      severity: 'error',
      category: 'geometry',
      lessonId,
      pageId,
      code: 'INVALID_BOUNDS',
      message: `${sceneLabel}: xMin (${scene.xMin}) >= xMax (${scene.xMax}).`,
    })
  }
  if (
    scene.yMin !== undefined &&
    scene.yMax !== undefined &&
    scene.yMin >= scene.yMax
  ) {
    findings.push({
      severity: 'error',
      category: 'geometry',
      lessonId,
      pageId,
      code: 'INVALID_BOUNDS',
      message: `${sceneLabel}: yMin (${scene.yMin}) >= yMax (${scene.yMax}).`,
    })
  }

  // 2. Points inside viewport bounds
  const vp = app.buildViewport(scene, 'display')
  for (const pt of scene.points ?? []) {
    if (
      pt.x < vp.bounds.xMin - 0.1 ||
      pt.x > vp.bounds.xMax + 0.1 ||
      pt.y < vp.bounds.yMin - 0.1 ||
      pt.y > vp.bounds.yMax + 0.1
    ) {
      findings.push({
        severity: 'error',
        category: 'geometry',
        lessonId,
        pageId,
        code: 'POINT_OUT_OF_BOUNDS',
        message: `${sceneLabel}: Point ${pt.label ?? pt.id}(${pt.x}, ${pt.y}) lies outside viewport bounds.`,
        evidence: { point: pt, bounds: vp.bounds },
      })
    }
  }

  // 3. Lines: non-degenerate + label equation matches ax + by + c = 0
  for (const line of scene.lines ?? []) {
    if (Math.hypot(line.a, line.b) < 1e-9) {
      findings.push({
        severity: 'error',
        category: 'geometry',
        lessonId,
        pageId,
        code: 'DEGENERATE_LINE',
        message: `${sceneLabel}: Line has a=0 and b=0.`,
        evidence: { line },
      })
      continue
    }
    if (line.label && /=/.test(line.label) && !/^m\b|^m⊥/i.test(line.label.trim())) {
      const parsed = app.parseLineExpr(line.label)
      if (parsed && !linesEquivalent(line, parsed)) {
        findings.push({
          severity: 'error',
          category: 'math',
          lessonId,
          pageId,
          code: 'LINE_LABEL_MISMATCH',
          message: `${sceneLabel}: Line label "${line.label}" does not match ax+by+c=0 (${line.a}x + ${line.b}y + ${line.c} = 0).`,
          evidence: { line, parsed },
        })
      }
    }
  }

  // 4. Right angles: exact 90 deg orthogonality + vertex on geometry
  for (const ra of scene.rightAngles ?? []) {
    const [dx1, dy1] = ra.dir1
    const [dx2, dy2] = ra.dir2
    const norm = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2)
    if (norm < 1e-9) {
      findings.push({
        severity: 'error',
        category: 'geometry',
        lessonId,
        pageId,
        code: 'DEGENERATE_RIGHT_ANGLE',
        message: `${sceneLabel}: Right-angle marker has zero-length direction vector.`,
        evidence: { rightAngle: ra },
      })
    } else {
      const cosAngle = Math.abs(dx1 * dx2 + dy1 * dy2) / norm
      if (cosAngle > 0.02) {
        findings.push({
          severity: 'error',
          category: 'geometry',
          lessonId,
          pageId,
          code: 'NON_ORTHOGONAL_RIGHT_ANGLE',
          message: `${sceneLabel}: Right-angle marker vectors dir1=${JSON.stringify(ra.dir1)} and dir2=${JSON.stringify(ra.dir2)} are not perpendicular (cos=${cosAngle.toFixed(3)}).`,
          evidence: { rightAngle: ra, cosAngle },
        })
      }
    }

    const lines = scene.lines ?? []
    if (lines.length >= 2) {
      const onLines = lines.filter(l => distPointToLine(ra.vertex[0], ra.vertex[1], l) < 0.15)
      if (onLines.length < 2 && (scene.segments?.length ?? 0) === 0 && (scene.polygons?.length ?? 0) === 0) {
        findings.push({
          severity: 'warning',
          category: 'geometry',
          lessonId,
          pageId,
          code: 'RIGHT_ANGLE_VERTEX_OFF_INTERSECTION',
          message: `${sceneLabel}: Right-angle vertex (${ra.vertex[0]}, ${ra.vertex[1]}) is not on 2 lines in the scene (matched ${onLines.length}).`,
          evidence: { vertex: ra.vertex },
        })
      }
    }
  }

  // 5. Circles: r > 0
  for (const c of scene.circles ?? []) {
    if (!(c.r > 0)) {
      findings.push({
        severity: 'error',
        category: 'geometry',
        lessonId,
        pageId,
        code: 'INVALID_CIRCLE_RADIUS',
        message: `${sceneLabel}: Circle has non-positive radius r=${c.r}.`,
      })
    }
  }

  // 6. UI: Label overlap check via computeLabelLayout
  const labels = app.computeLabelLayout(scene, vp, 'display')
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]
      const b = labels[j]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (dist < 14) {
        findings.push({
          severity: 'warning',
          category: 'ui',
          lessonId,
          pageId,
          code: 'LABEL_OVERLAP',
          message: `${sceneLabel}: Labels "${a.text}" and "${b.text}" are very close (${dist.toFixed(1)}px apart).`,
          evidence: { labelA: a.text, labelB: b.text, distPx: Math.round(dist * 10) / 10 },
        })
      }
    }
  }
}

function checkTextStyle(
  text: string | undefined,
  field: string,
  lessonId: string,
  pageId: string,
  findings: AuditFinding[],
) {
  if (!text) return
  if (text.includes('—')) {
    findings.push({
      severity: 'warning',
      category: 'ui',
      lessonId,
      pageId,
      code: 'EM_DASH_FOUND',
      message: `${field} contains an em dash ("—"). Replace with a comma, colon, or period.`,
      evidence: { field, snippet: text.slice(0, 140) },
    })
  }
}

export function auditSinglePage(
  app: LoadedSyntaxApp,
  lesson: GeoLesson,
  page: GeoLessonPage,
): AuditFinding[] {
  const findings: AuditFinding[] = []
  const lid = lesson.id
  const pid = page.id

  // Check em dashes in prompt
  checkTextStyle(page.prompt, 'prompt', lid, pid, findings)

  // Check scenes
  if ('scene' in page && page.scene) {
    checkScene(app, page.scene, lid, pid, 'scene', findings)
  }
  if ('solvedScene' in page && page.solvedScene) {
    checkScene(app, page.solvedScene, lid, pid, 'solvedScene', findings)
  }
  if (page.kind === 'worked') {
    page.steps.forEach((s, i) => {
      checkTextStyle(s.heading, `steps[${i}].heading`, lid, pid, findings)
      checkScene(app, s.scene, lid, pid, `steps[${i}].scene`, findings)
    })
    if (!page.plan || page.plan.length === 0) {
      findings.push({
        severity: 'warning',
        category: 'pedagogy',
        lessonId: lid,
        pageId: pid,
        code: 'MISSING_PLAN',
        message: 'Worked example is missing a numbered plan.',
      })
    }
  }

  // Check choice / multi-choice options & hints
  if (page.kind === 'choice') {
    const correctOpt = page.options.find(o => o.id === page.correctId)
    if (!correctOpt) {
      findings.push({
        severity: 'error',
        category: 'math',
        lessonId: lid,
        pageId: pid,
        code: 'INVALID_CORRECT_ID',
        message: `correctId "${page.correctId}" does not match any option.`,
      })
    }
    const missingHints = page.options.filter(o => o.id !== page.correctId && !o.hint)
    if (missingHints.length > 0) {
      findings.push({
        severity: 'warning',
        category: 'pedagogy',
        lessonId: lid,
        pageId: pid,
        code: 'MISSING_DISTRACTOR_HINTS',
        message: `${missingHints.length} wrong option(s) are missing targeted hints (${missingHints.map(o => o.id).join(', ')}).`,
      })
    }
    page.options.forEach(o => {
      checkTextStyle(o.label, `option[${o.id}].label`, lid, pid, findings)
      checkTextStyle(o.hint, `option[${o.id}].hint`, lid, pid, findings)
    })
  }

  if (page.kind === 'multi-choice') {
    const missingHints = page.options.filter(o => !page.correctIds.includes(o.id) && !o.hint)
    if (missingHints.length > 0) {
      findings.push({
        severity: 'warning',
        category: 'pedagogy',
        lessonId: lid,
        pageId: pid,
        code: 'MISSING_DISTRACTOR_HINTS',
        message: `${missingHints.length} wrong option(s) are missing targeted hints.`,
      })
    }
  }

function cleanDisplayForGrader(display: string): string {
  let s = display.split('≈')[0].trim()
  if (!s.startsWith('(')) {
    s = s.replace(/\s*\([^)]*\)\s*$/, '').trim()
  }
  return s.replace(/\b(km|m|cm|units?)\b/gi, '').trim()
}

  // Check math-input answer self-consistency with gradeAnswer
  if (page.kind === 'math-input') {
    const cleaned = cleanDisplayForGrader(page.answer.display)
    const res = app.gradeAnswer(cleaned, page.answer)
    if (!res.correct) {
      findings.push({
        severity: 'error',
        category: 'math',
        lessonId: lid,
        pageId: pid,
        code: 'DISPLAY_ANSWER_FAILS_GRADER',
        message: `answer.display ("${page.answer.display}") is rejected by gradeAnswer: ${res.feedback}`,
        evidence: { display: page.answer.display, cleaned, feedback: res.feedback },
      })
    }
  }

  // Check multi-step items
  if (page.kind === 'multi-step') {
    if (!page.plan || page.plan.length === 0) {
      findings.push({
        severity: 'warning',
        category: 'pedagogy',
        lessonId: lid,
        pageId: pid,
        code: 'MISSING_PLAN',
        message: 'Multi-step page is missing a numbered plan.',
      })
    }
    page.steps.forEach((step, idx) => {
      checkTextStyle(step.prompt, `steps[${idx}].prompt`, lid, pid, findings)
      checkScene(app, step.scene, lid, pid, `steps[${idx}].scene`, findings)
      checkScene(app, step.solvedScene, lid, pid, `steps[${idx}].solvedScene`, findings)
      const cleaned = cleanDisplayForGrader(step.answer.display)
      const res = app.gradeAnswer(cleaned, step.answer)
      if (!res.correct) {
        findings.push({
          severity: 'error',
          category: 'math',
          lessonId: lid,
          pageId: pid,
          code: 'DISPLAY_ANSWER_FAILS_GRADER',
          message: `steps[${idx}] ("${step.id}"): answer.display ("${step.answer.display}") fails gradeAnswer: ${res.feedback}`,
        })
      }
    })
  }

  // Check explanation scenes & em dashes
  if ('explanation' in page && page.explanation) {
    page.explanation.steps.forEach((es, idx) => {
      checkTextStyle(es.text, `explanation.steps[${idx}].text`, lid, pid, findings)
      checkScene(app, es.scene, lid, pid, `explanation.steps[${idx}].scene`, findings)
    })
  }

  return findings
}

export async function auditLesson(lessonId: string): Promise<ToolResult> {
  const app = await loadSyntaxApp(true)
  const lesson = app.ALL_LESSONS.find(l => l.id === lessonId)
  if (!lesson) {
    return {
      ok: false,
      summary: `Lesson "${lessonId}" not found.`,
      evidence: {},
      unknowns: [],
    }
  }
  const findings: AuditFinding[] = []
  checkTextStyle(lesson.subtitle, 'lesson.subtitle', lesson.id, lesson.id, findings)
  for (const p of [...lesson.pages, ...lesson.checks]) {
    findings.push(...auditSinglePage(app, lesson, p))
  }
  const errors = findings.filter(f => f.severity === 'error').length
  const warnings = findings.filter(f => f.severity === 'warning').length
  return {
    ok: errors === 0,
    summary: `Audited lesson "${lesson.id}" (${lesson.pages.length + lesson.checks.length} pages): ${errors} error(s), ${warnings} warning(s).`,
    evidence: {
      lessonId: lesson.id,
      pagesAudited: lesson.pages.length + lesson.checks.length,
      errorCount: errors,
      warningCount: warnings,
    },
    findings,
    unknowns: [],
  }
}

export async function auditPage(pageId: string): Promise<ToolResult> {
  const app = await loadSyntaxApp(true)
  const found = findPageInLessons(app.ALL_LESSONS, pageId)
  if (!found) {
    return { ok: false, summary: `Page "${pageId}" not found.`, evidence: {}, unknowns: [] }
  }
  const findings = auditSinglePage(app, found.lesson, found.page)
  const errors = findings.filter(f => f.severity === 'error').length
  const warnings = findings.filter(f => f.severity === 'warning').length
  return {
    ok: errors === 0,
    summary: `Audited page "${pageId}": ${errors} error(s), ${warnings} warning(s).`,
    evidence: { lessonId: found.lesson.id, pageId, errorCount: errors, warningCount: warnings },
    findings,
    unknowns: [],
  }
}

export async function auditAll(): Promise<ToolResult> {
  const app = await loadSyntaxApp(true)
  const findings: AuditFinding[] = []
  let totalPages = 0
  for (const lesson of app.ALL_LESSONS) {
    checkTextStyle(lesson.subtitle, 'lesson.subtitle', lesson.id, lesson.id, findings)
    for (const p of [...lesson.pages, ...lesson.checks]) {
      totalPages++
      findings.push(...auditSinglePage(app, lesson, p))
    }
  }
  const errors = findings.filter(f => f.severity === 'error').length
  const warnings = findings.filter(f => f.severity === 'warning').length
  return {
    ok: errors === 0,
    summary: `Audited all ${app.ALL_LESSONS.length} lessons (${totalPages} pages): ${errors} error(s), ${warnings} warning(s).`,
    evidence: {
      lessonCount: app.ALL_LESSONS.length,
      totalPages,
      errorCount: errors,
      warningCount: warnings,
    },
    findings,
    unknowns: [],
  }
}
