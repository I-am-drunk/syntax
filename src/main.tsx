import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './courses/courses.css'
import './lessons/lesson.css'
import './lessons/practiceExplanation.css'
import './lessons/completion.css'
import './interactives/gridView.css'
import './mpm2d/mpm2dBrilliant.css'
import './ui/syntaxPlatform.css'
import { SyntaxErrorBoundary } from './core/ErrorBoundary'
import { initGlobalErrorCapture } from './core/logger'
import { SyntaxAuthProvider } from './core/clerkAuth'
import { CourseShell } from './mpm2d/CourseShell'
import { DevChannelBadge, isDevEnvironment } from './mpm2d/components/DevChannelBadge'
import { AccountModal } from './ui/AccountModal'
import { DiagnosticsModal } from './ui/DiagnosticsModal'

initGlobalErrorCapture()

const isDevChannel = isDevEnvironment()

function SyntaxRoot() {
  const [localAuthOpen, setLocalAuthOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)

  return (
    <SyntaxErrorBoundary scope="app">
      <SyntaxAuthProvider onOpenLocalSignIn={() => setLocalAuthOpen(true)}>
        <CourseShell onOpenDevDiagnostics={isDevChannel ? () => setDiagOpen(true) : undefined} />
        <AccountModal open={localAuthOpen} onClose={() => setLocalAuthOpen(false)} />
        {isDevChannel && (
          <>
            <DevChannelBadge onOpenDiagnostics={() => setDiagOpen(true)} />
            <DiagnosticsModal open={diagOpen} onClose={() => setDiagOpen(false)} />
          </>
        )}
      </SyntaxAuthProvider>
    </SyntaxErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SyntaxRoot />
  </React.StrictMode>,
)
