import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './courses/courses.css'
import './lessons/lesson.css'
import './lessons/practiceExplanation.css'
import './lessons/completion.css'
import './interactives/gridView.css'
import './mpm2d/mpm2dBrilliant.css'
import { CourseShell } from './mpm2d/CourseShell'
import { DevChannelBadge } from './mpm2d/components/DevChannelBadge'

const isDevChannel = import.meta.env.VITE_CHANNEL === 'dev'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CourseShell />
    {isDevChannel ? <DevChannelBadge /> : null}
  </React.StrictMode>,
)
