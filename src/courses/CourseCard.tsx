import { useState } from 'react'
import type { topics } from './catalog'
import { assetUrl } from '../mpm2d/assetUrl'

export type Course = typeof topics[number]['courses'][number]

export function CourseCard({ course, layout = 'tile' }: {
  course: Course; layout?: 'tile' | 'row'
}) {
  const [pressed, setPressed] = useState(false)
  const imageWidth = layout === 'row' ? 204 : 156
  const image = assetUrl(course.image.replace('/assets/courses/', `/assets/courses/cards/${imageWidth}/`))
  const percent = course.capturedPercentComplete
  const progress = percent === 0 || percent === 100 ? null : <span className="course-progress"
    role="progressbar" aria-label={`${course.title} is ${percent}% complete`}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}%`}>
    <span style={{ width: `${percent}%` }} />
  </span>
  if (layout === 'row') return <div className="topic-course-slot"
    onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)}
    onPointerCancel={() => setPressed(false)} onPointerLeave={() => setPressed(false)}>
    <a className={`topic-course topic-course-row${pressed ? ' pressed' : ''}`} href={course.route}>
    <span className="topic-course-art"><img src={image} alt="" /></span>
    <span className="topic-course-details">
      {course.badge && <span className="course-badge">{course.badge}</span>}
      <span className="topic-course-name">{course.title}</span>
      {progress}
    </span>
    </a>
  </div>
  return <div className={`topic-course topic-course-tile${pressed ? ' pressed' : ''}`}
    onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)}
    onPointerCancel={() => setPressed(false)} onPointerLeave={() => setPressed(false)}>
    <span className="topic-course-art"><img src={image} alt="" />
      {course.badge && <span className="course-badge">{course.badge}</span>}
      {progress}
    </span>
    <a className="topic-course-name" href={course.route}>{course.title}</a>
  </div>
}
