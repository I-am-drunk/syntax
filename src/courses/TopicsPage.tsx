import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTopics } from './useTopics'
import { useTopicToasts } from './useTopicToasts'
import { AnimatePresence, motion } from 'framer-motion'
import { topics } from './catalog'
import { CourseCard } from './CourseCard'
import { CourseCarousel } from './CourseCarousel'
import { ArchivedCourses } from './ArchivedCourses'
import { archivedCourses } from './archiveCatalog'
import './courses.css'
import './topicStarring.css'

type Topic = typeof topics[number]
const catalogGroups = [
  { heading: 'Math', entries: topics.slice(0, 8) },
  { heading: 'Programming & CS', entries: topics.slice(8, 11) },
  { heading: 'Data & Science', entries: topics.slice(11) },
]
const shortNames: Record<string, string> = { 'computer-science': 'CS', 'data-analysis': 'Data',
  'foundational-math': 'Math', algebra: 'Basic Algebra', 'intermediate-algebra': 'Algebra',
  'advanced-algebra': 'Adv Algebra', 'advanced-math': 'Adv Math', 'logical-reasoning': 'Logic',
  'everyday-math': 'Everyday Math', 'mind-bending-math': 'Math Fun' }

function TopicChevron({ expanded }: { expanded: boolean }) {
  return <span className="topic-chevron" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
}

function TopicSection({ topic, expanded, toggle, pinned, ready, onStar, carousel = false }: {
  topic: Topic; expanded: boolean; toggle?: () => void; pinned: boolean; ready: boolean;
  onStar: (button: HTMLButtonElement) => void; carousel?: boolean
}) {
  const id = useId(), collapsible = !!toggle && carousel, open = !collapsible || expanded
  return <section data-topic={topic.id} className={`topic-section ${open ? 'expanded' : ''}`}>
    <div className="topic-heading">
      <div className="topic-heading-main">
        <img src={topic.image} alt="" /><div className="topic-heading-text">
          <span className="topic-level">{topic.level}</span>
          <h3 className="topic-title" id={`${id}-heading`}>
            {collapsible ? <span className="topic-title-row"><span>{topic.title}</span>
              {topic.isNew && <small>New</small>}<TopicChevron expanded={open} /></span>
              : <>{topic.title}{topic.isNew && <small>New</small>}</>}
          </h3>
          <span className="topic-description">{topic.description}</span>
        </div>
      </div>
      <button type="button" className={`topic-star ${pinned ? 'saved' : ''}`}
        aria-label={`${pinned ? 'Unstar' : 'Star'} learning path`} aria-pressed={pinned} disabled={!ready}
        onClick={event => { event.stopPropagation(); onStar(event.currentTarget) }}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M9.1726 1.3349C9.5538 0.7217 10.4462 0.7217 10.8274 1.3349L13.3816 5.4429C13.5157 5.6586 13.7288 5.8134 13.9754 5.8743L18.6716 7.034C19.3726 7.2071 19.6484 8.0558 19.183 8.6079L16.0654 12.3065C15.9016 12.5007 15.8202 12.7512 15.8385 13.0046L16.1868 17.8293C16.2388 18.5495 15.5168 19.074 14.848 18.802L10.367 16.9799C10.1317 16.8842 9.8683 16.8842 9.633 16.9799L5.152 18.802C4.4832 19.074 3.7612 18.5495 3.8132 17.8293L4.1615 13.0046C4.1797 12.7512 4.0984 12.5007 3.9346 12.3065L0.817 8.6079C0.3516 8.0558 0.6274 7.2071 1.3283 7.034L6.0246 5.8743C6.2712 5.8134 6.4843 5.6586 6.6184 5.4429L9.1726 1.3349Z" /></svg>
      </button>
      <p className="topic-mobile-description">{topic.description}</p>
      {collapsible && <button type="button" className="topic-heading-toggle" onClick={toggle}
        aria-expanded={open} aria-controls={`${id}-courses`} aria-labelledby={`${id}-heading`} />}
    </div>
    <div id={`${id}-courses`} aria-hidden={!open} {...(!open ? { inert: '' } : {})}>
    <AnimatePresence initial={false}>
    {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
      <div className="topic-course-list">
      {carousel ? <CourseCarousel courses={topic.courses} title={topic.title} />
        : <div className="topic-course-track">
          {topic.courses.map((course, index) => <Fragment key={course.route}>
            {index > 0 && <div className="topic-course-connector" aria-hidden="true" />}
            <CourseCard course={course} layout="row" />
          </Fragment>)}
        </div>}
      </div>
    </motion.div>}
    </AnimatePresence>
    </div>
  </section>
}

export function TopicsPage() {
  const { pinned: favorites, ready, error, toggle: toggleSaved, retry } = useTopics()
  const { notify, toaster } = useTopicToasts()
  const catalog = useRef<HTMLDivElement>(null), focusFrame = useRef(0)
  const mobileGroupStarts = new Set(catalogGroups.map(group =>
    group.entries.find(topic => !favorites.includes(topic.id))?.id))
  useEffect(() => () => cancelAnimationFrame(focusFrame.current), [])
  const [active, setActive] = useState('computer-science')
  const [desktop, setDesktop] = useState(() => matchMedia('(min-width: 769px)').matches)
  const nav = useRef<HTMLElement>(null)
  const tabs = useRef<HTMLDivElement>(null)
  const anchors = useRef(new Map<string, HTMLDivElement>())
  const scrolling = useRef(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const [closedGroups, setClosedGroups] = useState<string[]>([])
  const ordered = [...favorites.map(id => topics.find(t => t.id === id)!), ...topics.filter(t => !favorites.includes(t.id))]
  if (!favorites.length) mobileGroupStarts.delete(ordered[0]?.id)
  const toggle = (id: string) => setExpanded(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  const toggleGroup = (id: string) => setClosedGroups(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])
  function starTopic(topic: Topic, personal: boolean, button: HTMLButtonElement) {
    if (!ready) return
    if (personal && favorites.includes(topic.id) && document.activeElement === button) {
      if (desktop) {
        const group = catalogGroups.find(item => item.entries.some(entry => entry.id === topic.id))!
        if (closedGroups.includes(group.heading))
          flushSync(() => setClosedGroups(groups => groups.filter(name => name !== group.heading)))
        catalog.current?.querySelector<HTMLButtonElement>(`[data-topic-catalog] [data-topic="${topic.id}"] .topic-star`)?.focus({ preventScroll: true })
      } else {
        cancelAnimationFrame(focusFrame.current)
        focusFrame.current = requestAnimationFrame(() =>
          anchors.current.get(topic.id)?.querySelector<HTMLButtonElement>('.topic-star')?.focus({ preventScroll: true }))
      }
    } else if (!desktop && !favorites.includes(topic.id) && document.activeElement === button) button.blur()
    const pinned = toggleSaved(topic.id)
    if (pinned !== undefined) notify(pinned)
  }
  const behavior = () => document.documentElement.dataset.reducedMotion === 'true' ? 'auto' : 'smooth'
  useEffect(() => {
    const media = matchMedia('(min-width: 769px)')
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  function selectTopic(id: string) {
    const anchor = anchors.current.get(id)
    if (!anchor) return
    const top = scrollY + anchor.getBoundingClientRect().top - 64 - (nav.current?.offsetHeight ?? 0) - 12
    setActive(id)
    if (Math.abs(top - scrollY) >= 1) {
      scrolling.current = true
      window.scrollTo({ top, behavior: behavior() })
    }
  }
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function update() {
      if (matchMedia('(min-width: 769px)').matches) return
      const offset = 64 + (nav.current?.offsetHeight ?? 0) + 16
      const orderedAnchors = [...anchors.current].sort((a, b) => a[1].getBoundingClientRect().top - b[1].getBoundingClientRect().top)
      const passed = orderedAnchors.filter(([, node]) => node.getBoundingClientRect().top <= offset)
      setActive(passed.at(-1)?.[0] ?? orderedAnchors[0]?.[0] ?? '')
    }
    function onScroll() {
      if (!scrolling.current) return update()
      clearTimeout(timer)
      timer = setTimeout(() => { scrolling.current = false; update() }, 150)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      clearTimeout(timer)
      scrolling.current = false
    }
  }, [favorites, desktop])
  useEffect(() => {
    const tab = tabs.current?.querySelector<HTMLButtonElement>('[aria-current="location"]')
    if (tab && tabs.current) tabs.current.scrollTo({ behavior: behavior(),
      left: tab.offsetLeft - (tabs.current.clientWidth - tab.offsetWidth) / 2 })
  }, [active, favorites])
  return <main className="topics-page">
    <h1 className="visually-hidden">Topics</h1>
    {error && <p role="alert">{error} <button type="button" onClick={retry}>Retry</button></p>}
    <nav className="topic-tabs" aria-label="Learning plans" ref={nav}>
      <div className="topic-tab-track" ref={tabs}>
      {ordered.map((topic, index) => <div key={topic.id} className="topic-tab" data-color-family={topic.capturedTabFamily}>
        {favorites.length > 0 && index === favorites.length && <span className="topic-tab-divider" aria-hidden="true" />}
        <button type="button" aria-current={active === topic.id ? 'location' : undefined}
          onClick={() => selectTopic(topic.id)}>
          <span className="topic-tab-chip"><img src={topic.image} alt="" width={32} height={32} loading="lazy" /></span>
          <span className="topic-tab-label">{shortNames[topic.id] || topic.title}</span>
          <span className="topic-tab-underline" aria-hidden="true"
            style={active === topic.id ? { backgroundColor: topic.capturedTabUnderline } : undefined} />
        </button>
      </div>)}
      </div>
    </nav>
    <div className="topics-mobile">
      {ordered.map(topic => <div key={topic.id} data-mobile-plan-anchor={topic.id}
        data-group-start={mobileGroupStarts.has(topic.id) || undefined}
        ref={node => { if (node) anchors.current.set(topic.id, node); else anchors.current.delete(topic.id) }}>
        <TopicSection topic={topic} expanded pinned={favorites.includes(topic.id)} ready={ready}
          onStar={button => starTopic(topic, favorites.includes(topic.id), button)} />
      </div>)}
    </div>
    <div className="topics-desktop" ref={catalog} data-no-pins={!favorites.length || undefined}>
      {favorites.length > 0 && <h2>Your topics</h2>}
      {favorites.map(id => <TopicSection key={id} topic={topics.find(t => t.id === id)!}
        expanded pinned ready={ready} onStar={button => starTopic(topics.find(t => t.id === id)!, true, button)} carousel={desktop} />)}
      {catalogGroups.map(({ heading, entries }, index) => {
        const open = !desktop || !closedGroups.includes(heading), groupId = `topic-group-${index}`
        return <div className="topic-group" data-topic-catalog key={heading}>
        <h2><button type="button" className="topic-group-toggle" aria-expanded={open}
          aria-controls={groupId} onClick={() => toggleGroup(heading)}>
          {heading}<TopicChevron expanded={open} /></button></h2>
        <motion.div id={groupId} aria-hidden={!open} initial={false}
          animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} style={{ overflow: 'hidden' }}>
        <div className="topic-group-list" {...(!open ? { inert: '' } : {})}>
        {entries.map(topic => <TopicSection key={topic.id} topic={topic}
          expanded={expanded.includes(topic.id)} toggle={() => toggle(topic.id)} pinned={favorites.includes(topic.id)} ready={ready}
          onStar={button => starTopic(topic, false, button)}
          carousel={desktop} />)}
        </div>
        </motion.div>
      </div>})}
    </div>
    {ready && archivedCourses.length > 0 && <ArchivedCourses courses={archivedCourses} desktop={desktop} />}
    {toaster}
  </main>
}
