import { useEffect, useMemo, useState } from 'react'
import { Check, HelpCircle } from 'lucide-react'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import type { SyntaxPackageManifest } from '../core/packages'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { formatMathPreview, parseNumberExpr } from '../mpm2d/mathParser'
import { PackageIcon } from '../ui/PackageIcon'

const CUSTOM_PROGRESS_KEY = 'syntax.custom.progress.v1'

function loadCustomCompleted(courseId: string): Set<string> {
  try {
    const raw = localStorage.getItem(CUSTOM_PROGRESS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const list = parsed?.[courseId]
    if (Array.isArray(list)) {
      return new Set(list.filter((x): x is string => typeof x === 'string'))
    }
  } catch {
    // ignore storage errors
  }
  return new Set()
}

function saveCustomCompleted(courseId: string, completedIds: Set<string>) {
  try {
    const raw = localStorage.getItem(CUSTOM_PROGRESS_KEY)
    const map: Record<string, string[]> = raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
    map[courseId] = [...completedIds]
    localStorage.setItem(CUSTOM_PROGRESS_KEY, JSON.stringify(map))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syntax:custom-progress-changed', { detail: { courseId } }))
    }
  } catch {
    // ignore
  }
}

function checkDeclarativeMathAnswer(rawInput: string, accepted: string[]): boolean {
  const trimmed = rawInput.trim()
  if (!trimmed) return false
  const parsedInput = parseNumberExpr(trimmed)
  for (const candidate of accepted) {
    if (trimmed.toLowerCase() === candidate.trim().toLowerCase()) return true
    const parsedTarget = parseNumberExpr(candidate)
    if (parsedInput && parsedTarget) {
      if (parsedInput.kind === 'undefined' && parsedTarget.kind === 'undefined') return true
      if (
        parsedInput.kind === 'value' &&
        parsedTarget.kind === 'value' &&
        Math.abs(parsedInput.value - parsedTarget.value) < 1e-3
      ) {
        return true
      }
    }
  }
  return false
}

interface CustomCourseStageProps {
  course: SyntaxPackageManifest
  theme: 'light' | 'dark'
}

export default function CustomCourseStage({ course, theme }: CustomCourseStageProps) {
  const installed = useInstalledPackages()
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const units = course.customCourse?.units ?? []
  const [selectedChoice, setSelectedChoice] = useState<Record<string, number>>({})
  const [mathInputs, setMathInputs] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [hintOpen, setHintOpen] = useState<Record<string, boolean>>({})
  const [completedIds, setCompletedIds] = useState<Set<string>>(() =>
    loadCustomCompleted(course.id),
  )

  useEffect(() => {
    setCompletedIds(loadCustomCompleted(course.id))
  }, [course.id])

  const totalLessons = useMemo(
    () => units.reduce((sum, u) => sum + u.lessons.length, 0),
    [units],
  )
  const completedCount = completedIds.size
  const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  function markCompleted(lessonId: string) {
    setCompletedIds(prev => {
      if (prev.has(lessonId)) return prev
      const next = new Set(prev)
      next.add(lessonId)
      saveCustomCompleted(course.id, next)
      return next
    })
  }

  const requiredSandboxes = useMemo(() => {
    const byId = new Map(installed.map(r => [r.manifest.id, r]))
    const seen = new Set<string>()
    const result: SyntaxPackageManifest[] = []
    for (const dep of course.requires ?? []) {
      if (seen.has(dep.id)) continue
      seen.add(dep.id)
      const rec = byId.get(dep.id)
      if (rec && rec.enabled && rec.manifest.sandboxHtml) {
        result.push(rec.manifest)
      }
    }
    return result
  }, [installed, course.requires])

  return (
    <main className="sx-course-page">
      <div className="sx-course-hero">
        <PackageIcon id={course.id} kind={course.kind} svg={course.iconSvg} size={52} />
        <div style={{ flex: 1 }}>
          <h1>{course.name}</h1>
          <span className="sx-modal-meta">
            @{course.author.handle} · {completedCount}/{totalLessons} completed ({percent}%)
          </span>
          {totalLessons > 0 && (
            <div className="sx-custom-course-bar" aria-hidden="true">
              <div className="sx-custom-course-bar-fill" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      </div>

      {requiredSandboxes.map(sandboxPkg => (
        <SyntaxErrorBoundary
          key={sandboxPkg.id}
          scope={`embedded-plugin:${sandboxPkg.id}`}
          pluginName={sandboxPkg.name}
          onDisablePlugin={() => setPackageEnabled(sandboxPkg.id, false)}
          resetKeys={[sandboxPkg.id]}
        >
          <PluginSandboxFrame
            pluginId={sandboxPkg.id}
            title={sandboxPkg.name}
            html={sandboxPkg.sandboxHtml!}
            theme={theme}
            onDisablePlugin={() => setPackageEnabled(sandboxPkg.id, false)}
          />
        </SyntaxErrorBoundary>
      ))}

      {units.map((unit, uIdx) => (
        <section key={`${uIdx}:${unit.title}`} className="sx-course-lessons">
          <h2>{unit.title}</h2>
          {unit.lessons.map(lesson => {
            const hasChoices = Boolean(lesson.choices && lesson.choices.length > 0)
            const hasMathInput = Boolean(lesson.acceptedAnswers && lesson.acceptedAnswers.length > 0)
            const picked = selectedChoice[lesson.id]
            const rawMath = mathInputs[lesson.id] ?? ''
            const isChecked = Boolean(checked[lesson.id])
            const isDone = completedIds.has(lesson.id)

            const isRight = isChecked
              ? hasChoices
                ? typeof lesson.answerIndex === 'number' && picked === lesson.answerIndex
                : hasMathInput
                  ? checkDeclarativeMathAnswer(rawMath, lesson.acceptedAnswers!)
                  : true
              : false

            return (
              <article key={lesson.id} className="sx-course-lesson-card">
                <div className="sx-custom-lesson-head">
                  <strong>{lesson.title}</strong>
                  {isDone && (
                    <span className="sx-status-pill is-ok">
                      <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                      <span>Completed</span>
                    </span>
                  )}
                </div>
                {lesson.prompt && <p className="sx-modal-copy">{lesson.prompt}</p>}

                {hasChoices && (
                  <div className="sx-course-choices">
                    {lesson.choices!.map((choice, cIdx) => {
                      const cls =
                        isChecked && picked === cIdx
                          ? isRight
                            ? ' is-correct'
                            : ' is-wrong'
                          : ''
                      return (
                        <button
                          key={`${lesson.id}:${cIdx}`}
                          type="button"
                          aria-pressed={picked === cIdx}
                          className={`sx-course-choice${cls}`}
                          style={
                            !isChecked && picked === cIdx
                              ? { borderColor: 'var(--accent-blue, #456dff)' }
                              : undefined
                          }
                          onClick={() => {
                            setSelectedChoice(prev => ({ ...prev, [lesson.id]: cIdx }))
                            setChecked(prev => ({ ...prev, [lesson.id]: false }))
                          }}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                )}

                {!hasChoices && hasMathInput && (
                  <div className="sx-custom-math-input-wrap">
                    <input
                      type="text"
                      className="sx-custom-math-input"
                      value={rawMath}
                      placeholder="Type a number, fraction (3/4), or radical (sqrt(2))..."
                      aria-label={`Answer for ${lesson.title}`}
                      onChange={e => {
                        setMathInputs(prev => ({ ...prev, [lesson.id]: e.target.value }))
                        setChecked(prev => ({ ...prev, [lesson.id]: false }))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && rawMath.trim()) {
                          const ok = checkDeclarativeMathAnswer(rawMath, lesson.acceptedAnswers!)
                          setChecked(prev => ({ ...prev, [lesson.id]: true }))
                          if (ok) markCompleted(lesson.id)
                        }
                      }}
                    />
                    {rawMath.trim() && (
                      <span className="sx-custom-math-preview">
                        Preview: <code>{formatMathPreview(rawMath)}</code>
                      </span>
                    )}
                  </div>
                )}

                <div className="sx-custom-lesson-actions">
                  {hasChoices && typeof picked === 'number' && (
                    <button
                      type="button"
                      className="sx-btn-primary"
                      onClick={() => {
                        const ok =
                          typeof lesson.answerIndex === 'number' && picked === lesson.answerIndex
                        setChecked(prev => ({ ...prev, [lesson.id]: true }))
                        if (ok) markCompleted(lesson.id)
                      }}
                    >
                      Check
                    </button>
                  )}

                  {!hasChoices && hasMathInput && rawMath.trim().length > 0 && (
                    <button
                      type="button"
                      className="sx-btn-primary"
                      onClick={() => {
                        const ok = checkDeclarativeMathAnswer(rawMath, lesson.acceptedAnswers!)
                        setChecked(prev => ({ ...prev, [lesson.id]: true }))
                        if (ok) markCompleted(lesson.id)
                      }}
                    >
                      Check
                    </button>
                  )}

                  {!hasChoices && !hasMathInput && !isDone && (
                    <button
                      type="button"
                      className="sx-btn-secondary sx-btn-sm"
                      onClick={() => markCompleted(lesson.id)}
                    >
                      Mark complete
                    </button>
                  )}

                  {lesson.hint && (
                    <button
                      type="button"
                      className="sx-btn-ghost sx-btn-xs"
                      onClick={() =>
                        setHintOpen(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))
                      }
                    >
                      <HelpCircle size={13} aria-hidden="true" />
                      <span>{hintOpen[lesson.id] ? 'Hide hint' : 'Hint'}</span>
                    </button>
                  )}

                  {isChecked && (
                    <span className={`sx-status-pill${isRight ? ' is-ok' : ''}`}>
                      {isRight ? 'Correct' : 'Try again'}
                    </span>
                  )}
                </div>

                {hintOpen[lesson.id] && lesson.hint && (
                  <p className="sx-custom-hint-box">{lesson.hint}</p>
                )}

                {isChecked && lesson.explanation && (
                  <p className="sx-modal-copy">{lesson.explanation}</p>
                )}
              </article>
            )
          })}
        </section>
      ))}
    </main>
  )
}
