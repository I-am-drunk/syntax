import { useMemo, useState } from 'react'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import type { SyntaxPackageManifest } from '../core/packages'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { PackageIcon } from '../ui/PackageIcon'

interface CustomCourseStageProps {
  course: SyntaxPackageManifest
  theme: 'light' | 'dark'
}

export default function CustomCourseStage({ course, theme }: CustomCourseStageProps) {
  const installed = useInstalledPackages()
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const units = course.customCourse?.units ?? []
  const [selectedChoice, setSelectedChoice] = useState<Record<string, number>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const requiredSandboxes = useMemo(() => {
    const byId = new Map(installed.map(r => [r.manifest.id, r]))
    return (course.requires ?? [])
      .map(dep => byId.get(dep.id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r && r.enabled && r.manifest.sandboxHtml))
      .map(r => r.manifest)
  }, [installed, course.requires])

  return (
    <main className="sx-course-page">
      <div className="sx-course-hero">
        <PackageIcon id={course.id} kind={course.kind} svg={course.iconSvg} size={52} />
        <div>
          <h1>{course.name}</h1>
          <span className="sx-modal-meta">@{course.author.handle}</span>
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
            const picked = selectedChoice[lesson.id]
            const isChecked = Boolean(checked[lesson.id])
            const isRight =
              isChecked &&
              typeof lesson.answerIndex === 'number' &&
              picked === lesson.answerIndex

            return (
              <article key={lesson.id} className="sx-course-lesson-card">
                <strong>{lesson.title}</strong>
                {lesson.prompt && <p className="sx-modal-copy">{lesson.prompt}</p>}
                {lesson.choices && lesson.choices.length > 0 && (
                  <div className="sx-course-choices">
                    {lesson.choices.map((choice, cIdx) => {
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
                {lesson.choices && typeof picked === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      className="sx-btn-primary"
                      onClick={() => setChecked(prev => ({ ...prev, [lesson.id]: true }))}
                    >
                      Check
                    </button>
                    {isChecked && (
                      <span className={`sx-status-pill${isRight ? ' is-ok' : ''}`}>
                        {isRight ? 'Correct' : 'Try again'}
                      </span>
                    )}
                  </div>
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
