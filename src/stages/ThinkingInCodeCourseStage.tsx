import { useEffect, useMemo, useState } from 'react'
import { Layers } from 'lucide-react'
import '../lessons/lesson.css'
import '../lessons/practiceExplanation.css'
import '../lessons/completion.css'
import '../interactives/gridView.css'
import { useHostSlots } from '../core/hostSlots'
import { CourseOutline } from '../courses/CourseOutline'
import { LessonSession } from '../lessons/LessonSession'
import { writingPrograms } from '../lessons/writingPrograms'
import { writingPractice } from '../lessons/writingPractice'
import { sequencingCommands } from '../lessons/sequencingCommands'
import { repeatingPatterns } from '../lessons/repeatingPatterns'
import { debuggingPrograms } from '../lessons/debuggingPrograms'
import { playLessonSound, preloadLessonSounds } from '../services/lessonSounds'
import { CS_PROGRESS_EVENT } from '../services/progress'

const THINKING_LESSONS = [
  writingPrograms,
  writingPractice,
  sequencingCommands,
  repeatingPatterns,
  debuggingPrograms,
]

export interface ThinkingInCodeCourseStageProps {
  initialLessonId?: string | null
  soundOn: boolean
  onBackToLibrary: () => void
  onLessonRouteChange: (lessonId: string | null) => void
  onProgressChanged?: () => void
}

export default function ThinkingInCodeCourseStage({
  initialLessonId = null,
  soundOn,
  onBackToLibrary,
  onLessonRouteChange,
  onProgressChanged,
}: ThinkingInCodeCourseStageProps) {
  const { setContribution, clearContribution, setFullscreenLesson } = useHostSlots()
  const [activeSlug, setActiveSlug] = useState<string | null>(() =>
    initialLessonId && THINKING_LESSONS.some(l => l.slug === initialLessonId)
      ? initialLessonId
      : null,
  )
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    preloadLessonSounds()
  }, [])

  useEffect(() => {
    if (initialLessonId && THINKING_LESSONS.some(l => l.slug === initialLessonId)) {
      setActiveSlug(initialLessonId)
    } else {
      setActiveSlug(null)
    }
  }, [initialLessonId])

  useEffect(() => {
    const onSaved = () => {
      onProgressChanged?.()
    }
    window.addEventListener(CS_PROGRESS_EVENT, onSaved)
    return () => window.removeEventListener(CS_PROGRESS_EVENT, onSaved)
  }, [onProgressChanged])

  useEffect(() => {
    setContribution({
      courseNavTabs: [
        {
          id: 'cs-outline',
          label: 'Thinking in Code',
          icon: <Layers size={15} strokeWidth={1.9} className="nav-svg-icon" aria-hidden="true" />,
          active: true,
          onClick: () => {
            const scroller = document.querySelector<HTMLElement>('.course-outline')
            scroller?.scrollTo({ top: 0, behavior: 'smooth' })
          },
        },
      ],
    })
    return () => clearContribution()
  }, [setContribution, clearContribution])

  const activeLesson = useMemo(
    () => THINKING_LESSONS.find(l => l.slug === activeSlug) ?? null,
    [activeSlug],
  )

  useEffect(() => {
    setFullscreenLesson(Boolean(activeLesson))
    return () => setFullscreenLesson(false)
  }, [activeLesson, setFullscreenLesson])

  function launchLesson(slug: string) {
    setActiveSlug(slug)
    onLessonRouteChange(slug)
  }

  function closeLesson() {
    setActiveSlug(null)
    setReloadNonce(n => n + 1)
    onLessonRouteChange(null)
    onProgressChanged?.()
  }

  if (activeLesson) {
    return (
      <div className="sx-fullscreen-lesson-layer">
        <LessonSession
          key={`${activeLesson.slug}:${activeLesson.version}`}
          lesson={activeLesson}
          onClose={closeLesson}
          onSound={cue => {
            if (soundOn) playLessonSound(cue)
          }}
        />
      </div>
    )
  }

  return (
    <CourseOutline
      reloadNonce={reloadNonce}
      onLaunchLesson={launchLesson}
      onBackToLibrary={onBackToLibrary}
    />
  )
}
