import type { SavedActivity } from '../services/activity'
import { writingPrograms } from '../lessons/writingPrograms'
import { sequencingCommands } from '../lessons/sequencingCommands'
import { repeatingPatterns } from '../lessons/repeatingPatterns'
import { debuggingPrograms } from '../lessons/debuggingPrograms'
import { assetUrl } from '../mpm2d/assetUrl'

export function YouCourseProgress({ activity }: { activity: SavedActivity }) {
  const completed = [writingPrograms, sequencingCommands, repeatingPatterns, debuggingPrograms].filter(lesson =>
    activity.records.some(({ progress }) => progress.contents.some(c =>
      c.kind === 'lesson' && c.courseSlug === 'thinking-in-code' && c.slug === lesson.slug
      && c.version === lesson.version && c.completed)))
  return <section className="you-course-progress" aria-labelledby="you-progress-heading">
    <h2 id="you-progress-heading">Your learning progress</h2>
    {completed.length > 0 ? <div className="you-course-card">
      <div className="you-course-top">
        <a className="you-course-title" href="#/course/thinking-in-code">
          <img src={assetUrl('/assets/courses/thinking-in-code-DolooX.png')} width="48" height="48" alt="" />
          <div><p>Programming &amp; CS</p><h3>Thinking in Code</h3></div>
        </a>
        <span className="you-course-count">{completed.length} {completed.length === 1 ? 'lesson' : 'lessons'} completed</span>
      </div>
      <div className="you-course-lessons"><h4>Lessons completed</h4>
        <p><strong>Level 1</strong><span> · Taking the First Steps</span></p>
        {completed.map(lesson => <a key={lesson.slug} href={lesson.route}>{lesson.title} <span aria-hidden="true">✓</span></a>)}
      </div>
    </div> : <p className="you-empty">No course progress yet.</p>}
  </section>
}
