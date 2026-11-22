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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CourseShell />
  </React.StrictMode>,
)
