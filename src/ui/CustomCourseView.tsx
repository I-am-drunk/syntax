import { useMemo, useState } from 'react'
import { useInstalledPackages } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import type { SyntaxPackageManifest } from '../core/packages'
import { LessonSession } from '../lessons/LessonSession'
import { writingPrograms } from '../lessons/writingPrograms'
import { writingPractice } from '../lessons/writingPractice'
import { sequencingCommands } from '../lessons/sequencingCommands'
import { repeatingPatterns } from '../lessons/repeatingPatterns'
import { debuggingPrograms } from '../lessons/debuggingPrograms'
import { playLessonSound } from '../services/lessonSounds'
import { PackageIcon } from './PackageIcon'

const THINKING_LESSONS = [
  writingPrograms,
  writingPractice,
  sequencingCommands,
  repeatingPatterns,
  debuggingPrograms,
]

export function ThinkingInCodeCourseView({ onBack }: { onBack: () => void }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const activeLesson = THINKING_LESSONS.find(l => l.slug === activeSlug)

  if (activeLesson) {
    return (
      <div>
        <div className="sx-course-page" style={{ marginBlock: '16px 0' }}>
          <button type="button" className="sx-btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setActiveSlug(null)}>
            ← Thinking in Code
          </button>
        </div>
        <LessonSession
          key={`${activeLesson.slug}:${activeLesson.version}`}
          lesson={activeLesson}
          onSound={cue => playLessonSound(cue)}
        />
      </div>
    )
  }

  return (
    <main className="sx-course-page">
      <button type="button" className="sx-btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        ← Back
      </button>
      <div className="sx-course-hero">
        <h1>Thinking in Code</h1>
      </div>
      <div className="preference-rows">
        {THINKING_LESSONS.map((lesson, idx) => (
          <div key={lesson.slug} className="preference-row">
            <div>
              <strong>
                {idx + 1}. {lesson.title}
              </strong>
              <span className="sx-modal-meta" style={{ marginLeft: 10 }}>
                {lesson.pages.length} pages
              </span>
            </div>
            <button type="button" className="sx-btn-primary" onClick={() => setActiveSlug(lesson.slug)}>
              Start
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}

type CustomCourseViewProps = {
  course: SyntaxPackageManifest
  theme: 'light' | 'dark'
  onBack: () => void
}

export function CustomCourseView({ course, theme, onBack }: CustomCourseViewProps) {
  const installed = useInstalledPackages()
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
      <button type="button" className="sx-btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        ← Back
      </button>

      <div className="sx-course-hero">
        <PackageIcon svg={course.iconSvg} size={52} />
        <div>
          <h1>{course.name}</h1>
          <span className="sx-modal-meta">@{course.author.handle}</span>
        </div>
      </div>

      {requiredSandboxes.map(sandboxPkg => (
        <PluginSandboxFrame
          key={sandboxPkg.id}
          pluginId={sandboxPkg.id}
          title={sandboxPkg.name}
          html={sandboxPkg.sandboxHtml!}
          theme={theme}
        />
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
                          className={`sx-course-choice${cls}`}
                          style={
                            !isChecked && picked === cIdx
                              ? { borderColor: '#456dff' }
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
