import type { GeoLesson, GeoLessonPage } from '../pageTypes'

/**
 * Full-page Brilliant digital paper geometry.
 * Each equation step gets its own dedicated full-page sheet (zero stacked cards).
 */
export const SHEET_WIDTH = 720
export const MIN_SHEET_HEIGHT = 600
export const MAX_SHEET_HEIGHT = 2200

export type WorksheetField = {
  id: string
  index: number
  title: string
  subtitle?: string
  /** Optional custom extra height if student pulls the bottom edge downward */
  extraHeight: number
  checked: boolean
  isCustom?: boolean
}

export type WorksheetSpec = {
  lessonTitle: string
  lessonNumber: number
  pageNumber: number
  totalPages: number
  isCheck: boolean
  source?: string
  prompt: string
  planSteps: string[]
  defaultFields: Omit<WorksheetField, 'checked' | 'extraHeight'>[]
}

type PersistedSheetState = {
  extraHeights: Record<string, number>
  checked: Record<string, boolean>
  customFields: { id: string; title: string }[]
}

const SHEET_PREFIX = 'mpm2d-pen-brilliant-v4:'

export function buildWorksheetSpec(
  lesson: GeoLesson,
  page: GeoLessonPage,
  pageIndex: number,
  totalPages: number,
  isCheck: boolean,
): WorksheetSpec {
  const source = 'source' in page ? page.source : undefined
  let planSteps: string[] = []
  let defaultFields: Omit<WorksheetField, 'checked' | 'extraHeight'>[] = []

  if (page.kind === 'worked') {
    planSteps = page.plan.length > 0 ? page.plan : page.steps.map(s => s.heading)
    defaultFields = page.steps.map((s, idx) => ({
      id: `step-${idx}`,
      index: idx + 1,
      title: s.heading,
      subtitle:
        idx === page.steps.length - 1
          ? 'Finish the algebra and write your final ∴ statement'
          : 'Work this step out by hand before revealing',
    }))
  } else if (page.kind === 'multi-step') {
    planSteps = page.plan
    defaultFields = page.steps.map((s, idx) => ({
      id: `ms-${s.id}`,
      index: idx + 1,
      title: s.label,
      subtitle: s.prompt,
    }))
  } else if (page.kind === 'plan-order') {
    const best = page.validPlans[0]?.steps ?? []
    planSteps = best
      .map(id => page.pool.find(p => p.id === id)?.text ?? '')
      .filter(Boolean)
    defaultFields = [
      {
        id: 'plan-sketch',
        index: 1,
        title: 'Sketch & Label Given Points',
        subtitle: 'Mark perpendiculars, midpoints, or distances on a quick sketch',
      },
      {
        id: 'plan-order',
        index: 2,
        title: 'Ordered Strategy Plan',
        subtitle: 'Write the numbered steps and why each formula is needed',
      },
    ]
  } else if (page.kind === 'read-plan') {
    planSteps = page.planSteps.map(s => s.text)
    defaultFields = [
      {
        id: 'read-trace',
        index: 1,
        title: 'Trace Each Step on a Sketch',
        subtitle: 'Draw the geometric object produced at each step',
      },
      {
        id: 'read-verify',
        index: 2,
        title: 'Final Target & Conclusion',
        subtitle: 'Identify what the final step finds',
      },
    ]
  } else if (page.kind === 'math-input') {
    planSteps = page.plan ?? [
      'Identify given coordinates and formula',
      'Substitute and simplify carefully',
      'Verify and write final ∴ statement',
    ]
    if (page.plan && page.plan.length >= 2 && page.plan.length <= 5) {
      defaultFields = page.plan.map((line, idx) => ({
        id: `mi-plan-${idx}`,
        index: idx + 1,
        title: line.replace(/\.$/, ''),
        subtitle:
          idx === page.plan!.length - 1
            ? 'Finish the algebra and circle your final answer'
            : 'Write the formula, substitution, and simplification',
      }))
    } else {
      defaultFields = [
        {
          id: 'mi-setup',
          index: 1,
          title: 'Formula & Setup',
          subtitle: 'List given coordinates and the formula you will use',
        },
        {
          id: 'mi-algebra',
          index: 2,
          title: 'Substitution & Algebra',
          subtitle: 'Show clean steps with exact fractions or radicals',
        },
        {
          id: 'mi-answer',
          index: 3,
          title: 'Final Answer & Check',
          subtitle: 'Verify signs and write your ∴ statement',
        },
      ]
    }
  } else {
    // For general conceptual, choice, or explore pages where pen workspace is opened,
    // don't show phantom algebra steps from other questions; provide a clean 1-page blank scratchpad!
    planSteps = ['Blank scratchpad for rough notes and calculations']
    defaultFields = [
      {
        id: 'scratch-page',
        index: 1,
        title: 'Scratch Paper',
        subtitle: 'Freely work out ideas, graphs, or rough algebra',
      },
    ]
  }

  return {
    lessonTitle: lesson.shortTitle,
    lessonNumber: lesson.number,
    pageNumber: pageIndex + 1,
    totalPages,
    isCheck,
    source,
    prompt: page.prompt,
    planSteps,
    defaultFields,
  }
}

export function clampExtraHeight(h: number): number {
  return Math.max(0, Math.min(MAX_SHEET_HEIGHT - MIN_SHEET_HEIGHT, Math.round(h)))
}

export function loadWorksheetFields(pageKey: string, spec: WorksheetSpec): WorksheetField[] {
  let saved: PersistedSheetState | null = null
  try {
    const raw = localStorage.getItem(SHEET_PREFIX + pageKey)
    if (raw) saved = JSON.parse(raw) as PersistedSheetState
  } catch {
    saved = null
  }

  const base: WorksheetField[] = spec.defaultFields.map(f => ({
    ...f,
    extraHeight: clampExtraHeight(saved?.extraHeights?.[f.id] ?? 0),
    checked: Boolean(saved?.checked?.[f.id]),
  }))

  const customs: WorksheetField[] = (saved?.customFields ?? []).map((cf, i) => ({
    id: cf.id,
    index: base.length + i + 1,
    title: cf.title,
    subtitle: 'Extra scratch paper',
    extraHeight: clampExtraHeight(saved?.extraHeights?.[cf.id] ?? 0),
    checked: Boolean(saved?.checked?.[cf.id]),
    isCustom: true,
  }))

  return [...base, ...customs]
}

export function saveWorksheetFields(pageKey: string, fields: WorksheetField[]) {
  const state: PersistedSheetState = {
    extraHeights: {},
    checked: {},
    customFields: [],
  }
  for (const f of fields) {
    if (f.extraHeight > 0) state.extraHeights[f.id] = Math.round(f.extraHeight)
    if (f.checked) state.checked[f.id] = true
    if (f.isCustom) {
      state.customFields.push({ id: f.id, title: f.title })
    }
  }
  try {
    localStorage.setItem(SHEET_PREFIX + pageKey, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}
