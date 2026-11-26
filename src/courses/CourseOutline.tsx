import { useEffect, useRef, useState } from 'react'
import { writingPrograms } from '../lessons/writingPrograms'
import { writingPractice } from '../lessons/writingPractice'
import { sequencingCommands } from '../lessons/sequencingCommands'
import { repeatingPatterns } from '../lessons/repeatingPatterns'
import { debuggingPrograms } from '../lessons/debuggingPrograms'
import { ResetIcon } from '../lessons/LessonControls'
import { readCourseProgress } from '../services/progress'
import { assetUrl } from '../mpm2d/assetUrl'
import { levels } from './thinkingInCode'
import './courses.css'

export interface CourseOutlineProps {
  onLaunchLesson?: (slug: string) => void
  onBackToLibrary?: () => void
  reloadNonce?: number
}

export function CourseOutline({
  onLaunchLesson,
  onBackToLibrary,
  reloadNonce = 0,
}: CourseOutlineProps = {}) {
  const [selected, setSelected] = useState([0, 0])
  const [notice, setNotice] = useState('')
  const [completedLessons, setCompletedLessons] = useState<{ slug: string; version: string }[] | null>(null)
  const [progressError, setProgressError] = useState(false)
  const [load, setLoad] = useState(0)
  const nodes = useRef(new Map<string, HTMLButtonElement>())

  const title = levels[selected[0]].lessons[selected[1]]
  const lesson =
    selected[0] === 0
      ? [writingPrograms, sequencingCommands, repeatingPatterns, debuggingPrograms][selected[1]]
      : undefined
  const complete =
    completedLessons === null
      ? null
      : !!lesson &&
        completedLessons.some(item => item.slug === lesson.slug && item.version === lesson.version)
  const practice = lesson === writingPrograms ? writingPractice : undefined

  useEffect(() => {
    const request = new AbortController()
    setProgressError(false)
    void readCourseProgress('thinking-in-code', request.signal)
      .then(progress => {
        if (!request.signal.aborted) setCompletedLessons(progress.completedLessons)
      })
      .catch(() => {
        if (!request.signal.aborted) setProgressError(true)
      })
    return () => request.abort()
  }, [load, reloadNonce])

  function select(level: number, node: number) {
    setSelected([level, node])
    setNotice('')
    nodes.current.get(`${level}:${node}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <main className="course-outline">
      <aside className="course-summary">
        <img
          src={assetUrl('/assets/courses/thinking-in-code-DolooX.png')}
          width="100"
          height="100"
          alt=""
        />
        <h1>Thinking in Code</h1>
        <p>Build solid foundations for computational problem solving.</p>
        <div className="course-counts">
          <span>
            <img src={assetUrl('/assets/courses/lessons.svg')} alt="" />
            48 Lessons
          </span>
          <span>
            <img src={assetUrl('/assets/courses/exercises.svg')} alt="" />
            618 Exercises
          </span>
        </div>
      </aside>

      <div className="course-path">
        {levels.map((level, li) => (
          <section className="outline-level" key={li} aria-labelledby={`level-${li}`}>
            <div className="outline-level-heading" id={`level-${li}`}>
              <span>Level {li + 1}</span>
              <h2>{level.title}</h2>
            </div>
            <div className="outline-nodes">
              {level.lessons.map((name, ni) => {
                const current = li === selected[0] && ni === selected[1]
                const review = name === 'Level Review'
                const nodeLesson =
                  li === 0
                    ? [writingPrograms, sequencingCommands, repeatingPatterns, debuggingPrograms][ni]
                    : undefined
                const completed =
                  !!nodeLesson &&
                  !!completedLessons?.some(
                    item => item.slug === nodeLesson.slug && item.version === nodeLesson.version,
                  )
                const icon = completed
                  ? current
                    ? 'complete-selected'
                    : 'complete'
                  : review
                    ? 'review'
                    : current
                      ? 'selected'
                      : 'lesson'

                return (
                  <button
                    type="button"
                    key={ni}
                    className="outline-node"
                    ref={node => {
                      if (node) nodes.current.set(`${li}:${ni}`, node)
                      else nodes.current.delete(`${li}:${ni}`)
                    }}
                    style={{ transform: `translateX(${[0, -1, 0, 1][ni % 4] * 12}%)` }}
                    aria-label={`${name}, level ${li + 1}${completed ? ', complete' : ''}`}
                    aria-pressed={current}
                    onClick={() => select(li, ni)}
                  >
                    <img src={assetUrl(`/assets/courses/node-${icon}.svg`)} alt="" />
                    <span className="outline-node-label">{name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        <div className="course-up-next">
          <span>Up next</span>
          <h2>Programming with Variables</h2>
          <p>Supercharge your programming skills with variables and loops.</p>
          {onBackToLibrary ? (
            <button type="button" className="plain-button" onClick={onBackToLibrary}>
              Back to Library
            </button>
          ) : (
            <a className="plain-button" href="#/library">
              Back to Library
            </a>
          )}
        </div>

        <div className="outline-action">
          <button
            className="outline-practice"
            aria-label="Open personalized practice"
            type="button"
            onClick={() => setNotice('Personalized practice unlocks after completing Level 1.')}
          >
            <img src={assetUrl('/assets/courses/practice.svg')} alt="" />
          </button>
          <h2>{title}</h2>
          {lesson ? (
            progressError ? (
              <div className="preview-unavailable" role="alert">
                <p>Saved course progress could not be loaded.</p>
                <button
                  type="button"
                  className="plain-button"
                  onClick={() => setLoad(value => value + 1)}
                >
                  Retry
                </button>
              </div>
            ) : complete === null ? (
              <button type="button" className="course-button" disabled aria-busy="true">
                Loading&hellip;
              </button>
            ) : (
              <div className="outline-course-actions">
                {onLaunchLesson ? (
                  <button
                    type="button"
                    className="course-button"
                    onClick={() => onLaunchLesson(complete && practice ? practice.slug : lesson.slug)}
                  >
                    {complete ? (practice ? 'Practice' : 'Re-do lesson') : 'Start'}
                  </button>
                ) : (
                  <a
                    className="course-button"
                    href={complete && practice ? practice.route : lesson.route}
                  >
                    {complete ? (practice ? 'Practice' : 'Re-do lesson') : 'Start'}
                  </a>
                )}
                {complete && practice && (
                  onLaunchLesson ? (
                    <button
                      type="button"
                      className="outline-redo"
                      aria-label="Re-do lesson"
                      title="Re-do lesson"
                      onClick={() => onLaunchLesson(lesson.slug)}
                    >
                      <ResetIcon />
                    </button>
                  ) : (
                    <a
                      className="outline-redo"
                      href={lesson.route}
                      aria-label="Re-do lesson"
                      title="Re-do lesson"
                    >
                      <ResetIcon />
                    </a>
                  )
                )}
              </div>
            )
          ) : (
            <p className="preview-unavailable" role="status">
              This {title === 'Level Review' ? 'review' : 'lesson'} is coming soon.
            </p>
          )}
          {notice && (
            <p className="preview-unavailable" role="status">
              {notice}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
