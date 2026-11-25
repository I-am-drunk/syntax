import { useMemo, useState } from 'react'
import { HomeLeagueArt } from './HomeLeagueArt'
import { assetUrl } from '../mpm2d/assetUrl'
import { UNIT2_LESSONS } from '../mpm2d/data/unit2Course'
import { useAccount } from '../core/account'
import { useInstalledPackages } from '../core/registry'
import { PackageIcon } from '../ui/PackageIcon'
import './courses.css'

export interface HomePageProps {
  completedLessonCount?: number
  totalLessonsCount?: number
  nextMpm2dLessonId?: string
  nextMpm2dLessonTitle?: string
  followingMpm2dLessonTitle?: string
  hasMpm2dResume?: boolean
  onOpenMpm2dCourse?: () => void
  onOpenMpm2dLesson?: (lessonId: string) => void
  onOpenCustomCourse?: (courseId: string) => void
  onOpenPlugins?: () => void
}

interface HomeCourseEntry {
  id: string
  title: string
  levelLabel: string
  image?: string
  iconSvg?: string
  primaryStep: string
  secondaryStep?: string
  ctaLabel: string
  onOpenPrimary: () => void
  onOpenCourse: () => void
}

export function HomePage({
  completedLessonCount = 0,
  totalLessonsCount = UNIT2_LESSONS.length,
  nextMpm2dLessonId = UNIT2_LESSONS[0]?.id ?? 'l1-slope',
  nextMpm2dLessonTitle = UNIT2_LESSONS[0]?.title ?? 'Slope & Rate of Change',
  followingMpm2dLessonTitle = UNIT2_LESSONS[1]?.title,
  hasMpm2dResume = false,
  onOpenMpm2dCourse = () => {},
  onOpenMpm2dLesson = () => {},
  onOpenCustomCourse = () => {},
  onOpenPlugins = () => {},
}: HomePageProps = {}) {
  const account = useAccount()
  const records = useInstalledPackages()
  const [selectedCourseId, setSelectedCourseId] = useState<string>('mpm2d-analytic-geometry')

  const courses = useMemo<HomeCourseEntry[]>(() => {
    const installedCourses = records
      .filter(e => e.manifest.kind === 'course' && e.enabled)
      .map(e => e.manifest)

    const items: HomeCourseEntry[] = []
    for (const pkg of installedCourses) {
      if (pkg.id === 'mpm2d-analytic-geometry') {
        const nextObj = UNIT2_LESSONS.find(l => l.id === nextMpm2dLessonId) ?? UNIT2_LESSONS[0]
        items.push({
          id: pkg.id,
          title: 'Analytic Geometry',
          levelLabel: nextObj ? `Level ${nextObj.level}` : 'Unit 2',
          image: assetUrl('/assets/courses/Coordinate_Geometry-bgclJY.png'),
          primaryStep: nextMpm2dLessonTitle,
          secondaryStep: followingMpm2dLessonTitle,
          ctaLabel: hasMpm2dResume || completedLessonCount > 0 ? 'Continue' : 'Start',
          onOpenPrimary: () => onOpenMpm2dLesson(nextMpm2dLessonId),
          onOpenCourse: onOpenMpm2dCourse,
        })
      } else if (pkg.id === 'thinking-in-code') {
        items.push({
          id: pkg.id,
          title: 'Thinking in Code',
          levelLabel: 'Level 1',
          image: assetUrl('/assets/courses/Coordinate_Plane-TjmV5y.png'),
          iconSvg: pkg.iconSvg,
          primaryStep: 'Writing Programs',
          secondaryStep: 'Sequencing Commands',
          ctaLabel: 'Start',
          onOpenPrimary: () => onOpenCustomCourse(pkg.id),
          onOpenCourse: () => onOpenCustomCourse(pkg.id),
        })
      } else {
        const firstLesson = pkg.customCourse?.units[0]?.lessons[0]?.title ?? 'Lesson 1'
        const secondLesson = pkg.customCourse?.units[0]?.lessons[1]?.title
        items.push({
          id: pkg.id,
          title: pkg.name,
          levelLabel: 'Community',
          iconSvg: pkg.iconSvg,
          primaryStep: firstLesson,
          secondaryStep: secondLesson,
          ctaLabel: 'Start',
          onOpenPrimary: () => onOpenCustomCourse(pkg.id),
          onOpenCourse: () => onOpenCustomCourse(pkg.id),
        })
      }
    }
    return items
  }, [
    records,
    nextMpm2dLessonId,
    nextMpm2dLessonTitle,
    followingMpm2dLessonTitle,
    hasMpm2dResume,
    completedLessonCount,
    onOpenMpm2dLesson,
    onOpenMpm2dCourse,
    onOpenCustomCourse,
  ])

  const active = courses.find(c => c.id === selectedCourseId) ?? courses[0]
  const greetingName = account?.displayName?.split(' ')[0]

  return (
    <main className="home-page">
      <div className="home-layout">
        <section className="home-summary" aria-label="Your activity">
          <h1>{greetingName ? `Welcome, ${greetingName}!` : 'Welcome!'}</h1>
          <div className="home-activity">
            <div className="home-streak-count">
              {completedLessonCount}
              <span className="icon icon-lightning" aria-hidden="true" />
            </div>
            <div className="home-league-copy">
              <HomeLeagueArt />
              <div className="home-league-text">
                <h2>
                  {completedLessonCount > 0 ? 'Keep your momentum' : 'Ready to start?'}
                </h2>
                <p>
                  {completedLessonCount} of {totalLessonsCount} Unit 2 lessons completed
                </p>
              </div>
            </div>
            <button
              className="home-league-continue"
              type="button"
              onClick={active ? active.onOpenCourse : onOpenMpm2dCourse}
            >
              View course path
            </button>
          </div>
        </section>

        {active && (
          <section className="home-course" aria-label="Active course">
            <div className="home-course-rail">
              {courses.map(course => {
                const isCurrent = course.id === active.id
                return (
                  <button
                    key={course.id}
                    type="button"
                    className={isCurrent ? 'current' : ''}
                    aria-label={course.title}
                    aria-pressed={isCurrent}
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    {course.image ? (
                      <img src={course.image} alt="" />
                    ) : course.iconSvg ? (
                      <PackageIcon svg={course.iconSvg} size={isCurrent ? 88 : 44} />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="home-course-title">
              <h2>{active.title}</h2>
              <span>{active.levelLabel}</span>
            </div>

            <div className="home-course-actions">
              <div className="home-course-steps">
                <button type="button" onClick={active.onOpenPrimary}>
                  <img src={assetUrl('/assets/courses/warm-up.svg')} alt="" />
                  <strong>{active.primaryStep}</strong>
                  <i aria-hidden="true" />
                </button>
                {active.secondaryStep && (
                  <button type="button" onClick={active.onOpenCourse}>
                    <img src={assetUrl('/assets/courses/node-upcoming.svg')} alt="" />
                    <span>{active.secondaryStep}</span>
                    <i aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                className="course-button"
                type="button"
                onClick={active.onOpenPrimary}
              >
                {active.ctaLabel}
              </button>
            </div>
          </section>
        )}

        <button className="home-tutor" type="button" onClick={onOpenPlugins}>
          Manage plugins or browse community courses…
        </button>
      </div>
    </main>
  )
}
