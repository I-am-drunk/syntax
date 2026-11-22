import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Mousewheel } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper'
import { CourseCard, type Course } from './CourseCard'
import 'swiper/css'

export function CourseCarousel({ courses, title }: { courses: Course[]; title: string }) {
  const swiper = useRef<SwiperInstance | null>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const publish = (instance: SwiperInstance) => {
    const start = instance.isLocked || instance.isBeginning, end = instance.isLocked || instance.isEnd
    setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end })
  }
  useEffect(() => {
    const update = () => {
      const instance = swiper.current
      if (!instance || instance.destroyed) return
      instance.update()
      if (instance.isLocked) instance.slideTo(0, 0)
      publish(instance)
    }
    update()
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update); swiper.current = null }
  }, [])
  return <Swiper className="topic-course-track course-carousel" modules={[Navigation, Mousewheel]}
    slidesPerView="auto" slidesOffsetBefore={24} slidesOffsetAfter={24} spaceBetween={28}
    mousewheel={{ forceToAxis: true, thresholdDelta: 1.5 }} speed={400 + 50 * courses.length}
    onSwiper={instance => { swiper.current = instance; publish(instance) }}
    onSlideChange={publish} onReachBeginning={publish} onReachEnd={publish}>
    {courses.map(course => <SwiperSlide key={course.route} style={{ width: 150 }}>
      <CourseCard course={course} />
    </SwiperSlide>)}
    <CarouselArrow present={!edges.start} previous title={title}
      onClick={() => swiper.current?.slideTo(0)} />
    <CarouselArrow present={!edges.end} title={title}
      onClick={() => swiper.current?.slideTo(courses.length - 1)} />
  </Swiper>
}

function CarouselArrow({ present, previous = false, title, onClick }: {
  present: boolean; previous?: boolean; title: string; onClick: () => void
}) {
  const [mounted, setMounted] = useState(present)
  const node = useRef<HTMLDivElement>(null)
  const current = useRef<Animation | null>(null)
  const opacity = useRef(0)
  const desired = useRef(present)
  desired.current = present
  if (present && !mounted) setMounted(true)
  useLayoutEffect(() => {
    const element = node.current
    if (!mounted || !element) return
    const from = opacity.current, to = present ? 1 : 0
    const duration = from === to ? 0 : 300, delay = present ? 0 : 300
    current.current?.cancel()
    const startedAt = performance.now()
    const animation = element.animate([{ opacity: from }, { opacity: to }], {
      duration, delay,
      easing: 'cubic-bezier(.25,.1,.35,1)', fill: 'both',
    })
    animation.startTime = startedAt
    current.current = animation
    animation.finished.then(() => {
      if (current.current !== animation || desired.current !== present) return
      opacity.current = to
      element.style.opacity = String(to)
      current.current = null
      animation.cancel()
      if (!present) setMounted(false)
    }).catch(() => {})
    return () => {
      if (current.current === animation) {
        const elapsed = Math.max(10, performance.now() - startedAt)
        const progress = duration ? Math.max(0, Math.min(1, (elapsed - delay) / duration)) : 1
        opacity.current = Number(animation.currentTime) > 0 ? from + (to - from) * arrowEase(progress) : from
        element.style.opacity = String(opacity.current)
        current.current = null
      }
      animation.cancel()
    }
  }, [present, mounted])
  const side = previous ? ' topic-previous' : ''
  return <>
    {present && <div className={`topic-edge${side}`} aria-hidden="true" />}
    {mounted && <div className={`topic-arrow${side}`} ref={node} style={{ opacity: 0 }}>
      <button className={`topic-next${side}`} type="button" onClick={onClick}
        aria-label={`${previous ? 'Previous' : 'Next'} ${title} courses`}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d={previous
            ? 'M3 7.95711L10.9571 15.9142L12.3713 14.5L5.82843 7.95711L12.3713 1.41421L10.9571 0L3 7.95711Z'
            : 'M13.3713 7.95711L5.41421 15.9142L4 14.5L10.5429 7.95711L4 1.41421L5.41421 0L13.3713 7.95711Z'} fill="currentColor" />
        </svg>
      </button>
    </div>}
  </>
}

function arrowEase(progress: number) {
  if (progress === 0 || progress === 1) return progress
  const bezier = (t: number, a: number, b: number) => (((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t + 3 * a) * t
  let low = 0, high = 1, t = 0, error = 0, iteration = 0
  do {
    t = low + (high - low) / 2
    error = bezier(t, .25, .35) - progress
    if (error > 0) high = t
    else low = t
  } while (Math.abs(error) > 1e-7 && ++iteration < 12)
  return bezier(t, .1, 1)
}
