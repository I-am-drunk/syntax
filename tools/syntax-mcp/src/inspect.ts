import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadSyntaxApp, findPageInLessons, REPO_ROOT } from './loader.js'
import type { ToolResult } from './types.js'

export async function inspectCourses(): Promise<ToolResult> {
  const app = await loadSyntaxApp()
  const unit2 = app.UNIT2_LESSONS.map(l => ({
    id: l.id,
    level: l.level,
    number: l.number,
    title: l.title,
    subtitle: l.subtitle,
    pageCount: l.pages.length,
    checkCount: l.checks.length,
    pageIds: l.pages.map(p => p.id),
    checkIds: l.checks.map(c => c.id),
  }))
  const catchup = app.CATCHUP_LESSONS.map(l => ({
    id: l.id,
    supportsLessonId: l.supportsLessonId,
    branchSide: l.branchSide,
    minutes: l.minutes,
    skillTag: l.skillTag,
    title: l.title,
    pageCount: l.pages.length,
    checkCount: l.checks.length,
    pageIds: l.pages.map(p => p.id),
    checkIds: l.checks.map(c => c.id),
  }))

  return {
    ok: true,
    summary: `Found ${unit2.length} Unit 2 lessons and ${catchup.length} catch-up lessons.`,
    evidence: { unit2, catchup },
    unknowns: [],
  }
}

export async function inspectLesson(lessonId: string): Promise<ToolResult> {
  const app = await loadSyntaxApp()
  const lesson = app.ALL_LESSONS.find(l => l.id === lessonId)
  if (!lesson) {
    return {
      ok: false,
      summary: `Lesson "${lessonId}" not found.`,
      evidence: { availableLessonIds: app.ALL_LESSONS.map(l => l.id) },
      unknowns: [],
    }
  }
  const summarizePage = (p: (typeof lesson.pages)[number], isCheck: boolean) => ({
    id: p.id,
    kind: p.kind,
    isCheck,
    source: 'source' in p ? p.source : undefined,
    prompt: p.prompt,
    hasWalkthrough: Boolean(app.getWalkthroughForPage(p.id)),
  })
  return {
    ok: true,
    summary: `Lesson "${lesson.title}" (${lesson.id}): ${lesson.pages.length} pages, ${lesson.checks.length} checks.`,
    evidence: {
      id: lesson.id,
      title: lesson.title,
      subtitle: lesson.subtitle,
      level: lesson.level,
      isCatchup: 'isCatchup' in lesson ? true : false,
      supportsLessonId: 'supportsLessonId' in lesson ? lesson.supportsLessonId : undefined,
      pages: lesson.pages.map(p => summarizePage(p, false)),
      checks: lesson.checks.map(c => summarizePage(c, true)),
    },
    unknowns: [],
  }
}

export async function inspectPage(pageId: string): Promise<ToolResult> {
  const app = await loadSyntaxApp()
  const found = findPageInLessons(app.ALL_LESSONS, pageId)
  if (!found) {
    return {
      ok: false,
      summary: `Page "${pageId}" not found.`,
      evidence: {},
      unknowns: [],
    }
  }
  const walkthrough = app.getWalkthroughForPage(pageId)
  const unknowns: string[] = []
  if (!walkthrough) {
    unknowns.push(`No walkthrough video metadata found in walkthroughData.ts for page "${pageId}".`)
  }
  return {
    ok: true,
    summary: `Page "${pageId}" (${found.page.kind}) in lesson "${found.lesson.id}" (${found.isCheck ? 'check' : 'page'} #${found.index + 1}).`,
    evidence: {
      lessonId: found.lesson.id,
      lessonTitle: found.lesson.title,
      isCheck: found.isCheck,
      index: found.index,
      page: found.page,
      walkthrough: walkthrough ?? null,
    },
    unknowns,
  }
}

export async function findSourceMaterial(query: string): Promise<ToolResult> {
  const classroomDir = path.join(REPO_ROOT, 'classroom-materials')
  const unknowns: string[] = []
  if (!fs.existsSync(classroomDir)) {
    unknowns.push(
      `Local classroom-materials/ directory not found at ${classroomDir}. On Iris, it lives at /home/tjninja/syntax-mpm2d/classroom-materials/.`,
    )
    return {
      ok: true,
      summary: `No local classroom-materials/ directory to search for "${query}".`,
      evidence: { matches: [] },
      unknowns,
    }
  }

  const q = query.toLowerCase()
  const matches: { file: string; line: number; snippet: string }[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (/\.(md|txt)$/i.test(entry.name)) {
        const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/)
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(q) && matches.length < 30) {
            matches.push({
              file: path.relative(REPO_ROOT, full),
              line: idx + 1,
              snippet: line.trim().slice(0, 200),
            })
          }
        })
      }
    }
  }
  walk(classroomDir)

  return {
    ok: true,
    summary: `Found ${matches.length} source material matches for "${query}".`,
    evidence: { query, matches },
    unknowns,
  }
}
