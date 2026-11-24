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
        <div className="sx-course-context-strip">
          <button
            type="button"
            className="sx-btn sx-btn-sm sx-btn-ghost"
            onClick={() => setActiveSlug(null)}
          >
            ← Back to Thinking in Code
          </button>
          <span className="sx-pill">Thinking in Code · {activeLesson.title}</span>
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
    <main className="sx-page">
      <div className="sx-page-header">
        <div>
          <button
            type="button"
            className="sx-btn sx-btn-sm sx-btn-ghost"
            style={{ marginBottom: 10 }}
            onClick={onBack}
          >
            ← Back to Library
          </button>
          <h1>Thinking in Code</h1>
          <p className="sx-page-subtitle">
            Interactive grid puzzles powered by the <code>grid-coding-engine</code> embedded plugin.
          </p>
        </div>
      </div>

      <div className="sx-grid">
        {THINKING_LESSONS.map((lesson, idx) => (
          <article key={lesson.slug} className="sx-card">
            <div className="sx-pill-row">
              <span className="sx-pill">Lesson {idx + 1}</span>
              <span className="sx-pill sx-pill-ext">{lesson.pages.length} pages</span>
            </div>
            <h2 className="sx-card-title">{lesson.title}</h2>
            <p className="sx-card-tagline">
              Build and run visual command blocks with live step-by-step feedback.
            </p>
            <div className="sx-card-footer">
              <span className="sx-card-author">v{lesson.version}</span>
              <button
                type="button"
                className="sx-btn sx-btn-sm sx-btn-primary"
                onClick={() => setActiveSlug(lesson.slug)}
              >
                Start Lesson
              </button>
            </div>
          </article>
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
    <main className="sx-page">
      <div className="sx-page-header">
        <div className="sx-card-top">
          <PackageIcon svg={course.iconSvg} name={course.name} size="lg" />
          <div>
            <button
              type="button"
              className="sx-btn sx-btn-sm sx-btn-ghost"
              style={{ marginBottom: 8 }}
              onClick={onBack}
            >
              ← Back to Library
            </button>
            <h1>{course.name}</h1>
            <p className="sx-page-subtitle">
              {course.customCourse?.subtitle || course.tagline} · by @{course.author.handle}
            </p>
          </div>
        </div>
      </div>

      {requiredSandboxes.map(sandboxPkg => (
        <div key={sandboxPkg.id} style={{ marginBottom: 24 }}>
          <div className="sx-section-title" style={{ marginTop: 0 }}>
            <span>
              Embedded Plugin: {sandboxPkg.name} ({sandboxPkg.extension})
            </span>
          </div>
          <PluginSandboxFrame
            pluginId={sandboxPkg.id}
            title={sandboxPkg.name}
            html={sandboxPkg.sandboxHtml!}
            theme={theme}
          />
        </div>
      ))}

      {units.length === 0 ? (
        <div className="sx-inline-note">
          This <code>.syntaxcourse</code> package has no playable lessons yet.
        </div>
      ) : (
        units.map((unit, uIdx) => (
          <section key={`${uIdx}:${unit.title}`} style={{ marginBottom: 28 }}>
            <div className="sx-section-title">
              <span>
                Unit {uIdx + 1}: {unit.title}
              </span>
            </div>
            <div className="sx-grid">
              {unit.lessons.map(lesson => {
                const picked = selectedChoice[lesson.id]
                const isChecked = Boolean(checked[lesson.id])
                const isRight =
                  isChecked &&
                  typeof lesson.answerIndex === 'number' &&
                  picked === lesson.answerIndex

                return (
                  <article key={lesson.id} className="sx-card">
                    <h2 className="sx-card-title">{lesson.title}</h2>
                    <p className="sx-card-tagline">{lesson.summary}</p>
                    {lesson.prompt && (
                      <div className="sx-inline-note" style={{ color: 'var(--sx-fg)' }}>
                        <strong>Check:</strong> {lesson.prompt}
                      </div>
                    )}
                    {lesson.choices && lesson.choices.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {lesson.choices.map((choice, cIdx) => (
                          <button
                            key={`${lesson.id}:${cIdx}`}
                            type="button"
                            className={`sx-btn sx-btn-sm${picked === cIdx ? ' sx-btn-primary' : ''}`}
                            style={{ justifyContent: 'flex-start' }}
                            onClick={() => {
                              setSelectedChoice(prev => ({ ...prev, [lesson.id]: cIdx }))
                              setChecked(prev => ({ ...prev, [lesson.id]: false }))
                            }}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}
                    {lesson.choices && typeof picked === 'number' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          type="button"
                          className="sx-btn sx-btn-sm sx-btn-primary"
                          onClick={() => setChecked(prev => ({ ...prev, [lesson.id]: true }))}
                        >
                          Check answer
                        </button>
                        {isChecked && (
                          <span
                            className="sx-pill"
                            style={{
                              color: isRight ? 'var(--sx-success)' : 'var(--sx-danger)',
                            }}
                          >
                            {isRight ? 'Correct!' : 'Try another choice'}
                          </span>
                        )}
                      </div>
                    )}
                    {isChecked && lesson.explanation && (
                      <div className="sx-inline-note">{lesson.explanation}</div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}
    </main>
  )
}
