import { useMemo, useState } from 'react'
import { HomeLeagueArt } from './HomeLeagueArt'
import { assetUrl } from '../mpm2d/assetUrl'
import {
  MPM2D_LESSON_INDEX,
  THINKING_IN_CODE_LESSONS,
  readMpm2dProgressSummary,
  readThinkingInCodeProgressSummary,
  type Mpm2dProgressSummary,
  type ThinkingInCodeProgressSummary,
} from '../packages/courseMeta'
import { useAccount } from '../core/account'
import { useInstalledPackages } from '../core/registry'
import { PackageIcon } from '../ui/PackageIcon'
import './courses.css'

export interface HomePageProps {
  mpm2dSummary?: Mpm2dProgressSummary
  csSummary?: ThinkingInCodeProgressSummary
  totalCompletedLessons?: number
  onOpenMpm2dCourse?: () => void
  onOpenMpm2dLesson?: (lessonId: string) => void
  onOpenCsCourse?: () => void
  onOpenCsLesson?: (lessonId: string) => void
  onOpenCustomCourse?: (courseId: string) => void
  onOpenLibrary?: () => void
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
  completedCount: number
  totalLessons: number
  onOpenPrimary: () => void
  onOpenCourse: () => void
}

export function HomePage({
  mpm2dSummary,
  csSummary,
  totalCompletedLessons,
  onOpenMpm2dCourse = () => {},
  onOpenMpm2dLesson = () => {},
  onOpenCsCourse = () => {},
  onOpenCsLesson = () => {},
  onOpenCustomCourse = () => {},
  onOpenLibrary = () => {},
}: HomePageProps = {}) {
  const account = useAccount()
  const records = useInstalledPackages()
  const [selectedCourseId, setSelectedCourseId] = useState<string>('mpm2d-analytic-geometry')

  const mpm2d = useMemo(() => mpm2dSummary ?? readMpm2dProgressSummary(), [mpm2dSummary])
  const cs = useMemo(() => csSummary ?? readThinkingInCodeProgressSummary(), [csSummary])
  const combinedCompleted = totalCompletedLessons ?? mpm2d.completedCount + cs.completedCount

  const courses = useMemo<HomeCourseEntry[]>(() => {
    const installedCourses = records
      .filter(e => e.manifest.kind === 'course' && e.enabled)
      .map(e => e.manifest)

    const items: HomeCourseEntry[] = []
    for (const pkg of installedCourses) {
      if (pkg.id === 'mpm2d-analytic-geometry') {
        const nextObj =
          MPM2D_LESSON_INDEX.find(l => l.id === mpm2d.nextLessonId) ?? MPM2D_LESSON_INDEX[0]
        items.push({
          id: pkg.id,
          title: 'Analytic Geometry',
          levelLabel: nextObj ? `Level ${nextObj.level}` : 'Unit 2',
          image: assetUrl('/assets/courses/Coordinate_Geometry-bgclJY.png'),
          primaryStep: mpm2d.nextLessonTitle,
          secondaryStep: mpm2d.followingLessonTitle,
          ctaLabel:
            mpm2d.completedCount >= mpm2d.totalLessons
              ? 'Review'
              : mpm2d.hasResume || mpm2d.completedCount > 0
                ? 'Continue'
                : 'Start',
          completedCount: mpm2d.completedCount,
          totalLessons: mpm2d.totalLessons,
          onOpenPrimary: () => onOpenMpm2dLesson(mpm2d.nextLessonId),
          onOpenCourse: onOpenMpm2dCourse,
        })
      } else if (pkg.id === 'thinking-in-code') {
        const nextCsId = cs.nextLessonId || THINKING_IN_CODE_LESSONS[0]!.id
        items.push({
          id: pkg.id,
          title: 'Thinking in Code',
          levelLabel: 'Level 1',
          image: assetUrl('/assets/courses/thinking-in-code-DolooX.png'),
          iconSvg: pkg.iconSvg,
          primaryStep: cs.nextLessonTitle,
          secondaryStep: cs.followingLessonTitle,
          ctaLabel:
            cs.completedCount >= cs.totalLessons
              ? 'Review'
              : cs.completedCount > 0
                ? 'Continue'
                : 'Start',
          completedCount: cs.completedCount,
          totalLessons: cs.totalLessons,
          onOpenPrimary: () => onOpenCsLesson(nextCsId),
          onOpenCourse: onOpenCsCourse,
        })
      } else {
        const firstLesson = pkg.customCourse?.units[0]?.lessons[0]?.title ?? 'Lesson 1'
        const secondLesson = pkg.customCourse?.units[0]?.lessons[1]?.title
        const total =
          pkg.customCourse?.units.reduce((acc, u) => acc + u.lessons.length, 0) ?? 0
        items.push({
          id: pkg.id,
          title: pkg.name,
          levelLabel: 'Community',
          iconSvg: pkg.iconSvg,
          primaryStep: firstLesson,
          secondaryStep: secondLesson,
          ctaLabel: 'Start',
          completedCount: 0,
          totalLessons: total,
          onOpenPrimary: () => onOpenCustomCourse(pkg.id),
          onOpenCourse: () => onOpenCustomCourse(pkg.id),
        })
      }
    }
    return items
  }, [
    records,
    mpm2d,
    cs,
    onOpenMpm2dLesson,
    onOpenMpm2dCourse,
    onOpenCsLesson,
    onOpenCsCourse,
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
              {combinedCompleted}
              <span className="icon icon-lightning" aria-hidden="true" />
            </div>
            <div className="home-league-copy">
              <HomeLeagueArt />
              <div className="home-league-text">
                <h2>{combinedCompleted > 0 ? 'Keep your momentum' : 'Ready to start?'}</h2>
                <p>
                  {active && active.totalLessons > 0
                    ? `${active.completedCount} of ${active.totalLessons} lessons completed`
                    : `${courses.length} installed ${courses.length === 1 ? 'course' : 'courses'} ready in your Library`}
                </p>
              </div>
            </div>
            <button
              className="home-league-continue"
              type="button"
              onClick={active ? active.onOpenCourse : onOpenLibrary}
            >
              {active ? 'Open course' : 'Open Library'}
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
                      <PackageIcon
                        id={course.id}
                        kind="course"
                        svg={course.iconSvg}
                        size={isCurrent ? 88 : 44}
                      />
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

        <button className="home-tutor" type="button" onClick={onOpenLibrary}>
          Open your Library to switch courses&hellip;
        </button>
      </div>
    </main>
  )
}
