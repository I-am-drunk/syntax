import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import '../lessons/lesson.css'
import '../lessons/practiceExplanation.css'
import '../lessons/completion.css'
import '../interactives/gridView.css'
import { LessonSession } from '../lessons/LessonSession'
import { writingPrograms } from '../lessons/writingPrograms'
import { writingPractice } from '../lessons/writingPractice'
import { sequencingCommands } from '../lessons/sequencingCommands'
import { repeatingPatterns } from '../lessons/repeatingPatterns'
import { debuggingPrograms } from '../lessons/debuggingPrograms'
import { playLessonSound, preloadLessonSounds } from '../services/lessonSounds'
import { assetUrl } from '../mpm2d/assetUrl'

const THINKING_LESSONS = [
  writingPrograms,
  writingPractice,
  sequencingCommands,
  repeatingPatterns,
  debuggingPrograms,
]

export default function ThinkingInCodeCourseStage({ soundOn }: { soundOn: boolean }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const activeLesson = THINKING_LESSONS.find(l => l.slug === activeSlug)

  useEffect(() => {
    preloadLessonSounds()
  }, [])

  if (activeLesson) {
    return (
      <div>
        <div className="sx-course-page" style={{ marginBlock: '16px 0' }}>
          <button
            type="button"
            className="sx-btn-ghost"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setActiveSlug(null)}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Thinking in Code</span>
          </button>
        </div>
        <LessonSession
          key={`${activeLesson.slug}:${activeLesson.version}`}
          lesson={activeLesson}
          onSound={cue => {
            if (soundOn) playLessonSound(cue)
          }}
        />
      </div>
    )
  }

  return (
    <main className="sx-course-page">
      <div className="sx-course-hero">
        <img
          src={assetUrl('/assets/courses/thinking-in-code-DolooX.png')}
          alt=""
          width={64}
          height={64}
        />
        <div>
          <h1>Thinking in Code</h1>
          <span className="sx-modal-meta">5 interactive lessons</span>
        </div>
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
            <button
              type="button"
              className="sx-btn-primary"
              onClick={() => setActiveSlug(lesson.slug)}
            >
              Start
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}
