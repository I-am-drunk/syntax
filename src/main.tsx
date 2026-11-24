import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './courses/courses.css'
import './lessons/lesson.css'
import './lessons/practiceExplanation.css'
import './lessons/completion.css'
import './interactives/gridView.css'
import './mpm2d/mpm2dBrilliant.css'
import { initGlobalErrorCapture } from './core/logger'
import { SyntaxApp } from './ui/SyntaxApp'
import { DevChannelBadge, isDevEnvironment } from './mpm2d/components/DevChannelBadge'

initGlobalErrorCapture()

const isDevChannel = isDevEnvironment()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SyntaxApp />
    {isDevChannel ? <DevChannelBadge /> : null}
  </React.StrictMode>,
)
