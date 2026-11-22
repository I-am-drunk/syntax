import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CourseCard, type Course } from './CourseCard'
import { CourseCarousel } from './CourseCarousel'
import './archivedCourses.css'

export function ArchivedCourses({ courses, desktop }: { courses: Course[]; desktop: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <section className="archived-courses" aria-label="Archived courses">
    <div className="archive-heading">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        Archived courses
        <svg width="16" height="16" viewBox="0 0 12 8" fill="currentColor" aria-hidden="true"
          style={{ rotate: open ? '0deg' : '180deg' }}>
          <path fillRule="evenodd" clipRule="evenodd" d="M11.7071 6.14644L10.2929 7.56065L6.00001 3.26776L1.70712 7.56065L0.292908 6.14644L6.00001 0.439331L11.7071 6.14644Z" />
        </svg>
      </button>
      <div className="archive-divider" />
    </div>
    <div id={id} aria-hidden={!open} {...(!open ? { inert: '' } : {})}>
      <AnimatePresence>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
          <ArchiveRail courses={courses} desktop={desktop} />
        </motion.div>}
      </AnimatePresence>
    </div>
  </section>
}

function ArchiveRail({ courses, desktop }: { courses: Course[]; desktop: boolean }) {
  const priorOverscroll = useRef<string | null>(null)
  useEffect(() => () => {
    if (priorOverscroll.current !== null && document.body.style.overscrollBehaviorX === 'none')
      document.body.style.overscrollBehaviorX = priorOverscroll.current
  }, [])
  return <div className="topic-course-list archive-course-list"
    onMouseEnter={() => {
      priorOverscroll.current = document.body.style.overscrollBehaviorX
      document.body.style.overscrollBehaviorX = 'none'
    }}
    onMouseLeave={() => {
      document.body.style.overscrollBehaviorX = 'auto'
      priorOverscroll.current = null
    }}>
    {desktop ? <CourseCarousel courses={courses} title="Archived" />
      : <div className="topic-course-track">
        {courses.map((course, index) => <Fragment key={course.route}>
          {index > 0 && <div className="topic-course-connector" aria-hidden="true" />}
          <CourseCard course={course} layout="row" />
        </Fragment>)}
      </div>}
  </div>
}
