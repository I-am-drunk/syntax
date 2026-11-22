import { useEffect } from 'react'
import { Header } from './Header'
import { PreferencesPage } from '../settings/PreferencesPage'
import { usePreferences } from '../settings/usePreferences'
import { useAppearance } from '../settings/useAppearance'
import { LessonSession } from '../lessons/LessonSession'
import { writingPrograms } from '../lessons/writingPrograms'
import { writingPractice } from '../lessons/writingPractice'
import { sequencingCommands } from '../lessons/sequencingCommands'
import { repeatingPatterns } from '../lessons/repeatingPatterns'
import { debuggingPrograms } from '../lessons/debuggingPrograms'
import { playLessonSound, preloadLessonSounds } from '../services/lessonSounds'
import { HomePage } from '../courses/HomePage'
import { TopicsPage } from '../courses/TopicsPage'
import { CourseOutline } from '../courses/CourseOutline'
import { topics } from '../courses/catalog'
import { archivedCourses } from '../courses/archiveCatalog'
import { useReportDialog } from '../reports/useReportDialog'
import { YouPage } from '../you/YouPage'

const footerLinks = [['About us', '/about/'], ['Careers', '/careers/'], ['Educators', '/educators/'],
  ['Help', '/help/'], ['Legal', '/terms/'], ['Privacy', '/privacy/']]

export function App() {
  const settings = usePreferences()
  const report = useReportDialog()
  useAppearance(settings.preferences)
  useEffect(preloadLessonSounds, [])
  const route = location.pathname.replace(/\/?$/, '/')
  const preferences = route === '/settings/preferences/'
  const home = route === '/' || route === '/home/'
  const catalog = route === '/courses/'
  const outline = route === '/courses/thinking-in-code/'
  const you = route === '/you/'
  const lesson = [writingPrograms, writingPractice, sequencingCommands, repeatingPatterns, debuggingPrograms].find(item => item.route === route)
  const course = [...topics.flatMap(topic => topic.courses), ...archivedCourses].find(item => item.route === route)
  useEffect(() => {
    if (!lesson) document.title = `${home ? 'Home' : catalog ? 'Topics' : preferences ? 'Preferences' : you ? 'You' : course?.title || 'Syntax'} | Syntax`
  }, [lesson, home, catalog, preferences, you, course?.title])
  if (lesson) return <><LessonSession
    key={`${lesson.slug}:${lesson.version}`} lesson={lesson}
    onReport={report.open}
    onSound={cue => { if (settings.preferences?.soundEffects ?? true) playLessonSound(cue) }} />{report.dialog}</>
  return <>
    <Header />
    {home ? <HomePage /> : catalog ? <TopicsPage /> : outline ? <CourseOutline />
      : you ? <YouPage /> : preferences ? <PreferencesPage settings={settings} /> : <main className="unavailable-page">
      <h1>{course?.title || 'Syntax'}</h1>
      <p>This page is not available in the current preview.</p>
      <p>This preview includes the Writing Programs lesson. Other lessons and tutor help are still being reconstructed.</p>
      <p><a href="/courses/" className="plain-button">Browse topics</a></p>
      <p><a href={writingPrograms.route} className="plain-button">Open Writing Programs</a></p>
      <a href="/settings/preferences/" className="plain-button">Open preferences</a>
    </main>}
    {!home && !catalog && !outline && !you && <footer className="app-footer">{footerLinks.map(([name, href]) => <a key={href} href={href}>{name}</a>)}</footer>}
    {settings.message && <div className="toast" role="status">{settings.message}</div>}
    {settings.error && settings.preferences && <div className="toast error" role="alert">{settings.error}</div>}
  </>
}
