import React, { Suspense, lazy, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './courses/courses.css'
import './ui/syntaxPlatform.css'
import { SyntaxErrorBoundary } from './core/ErrorBoundary'
import { initGlobalErrorCapture } from './core/logger'
import { SyntaxAuthProvider } from './core/clerkAuth'
import { AppShell } from './shell/AppShell'
import { DevChannelBadge, isDevEnvironment } from './mpm2d/components/DevChannelBadge'
import { AccountModal } from './ui/AccountModal'

const DiagnosticsModal = lazy(() =>
  import('./ui/DiagnosticsModal').then(m => ({ default: m.DiagnosticsModal })),
)

initGlobalErrorCapture()

const isDevChannel = isDevEnvironment()

function SyntaxRoot() {
  const [localAuthOpen, setLocalAuthOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)

  return (
    <SyntaxErrorBoundary scope="app">
      <SyntaxAuthProvider onOpenLocalSignIn={() => setLocalAuthOpen(true)}>
        <AppShell onOpenDevDiagnostics={isDevChannel ? () => setDiagOpen(true) : undefined} />
        <AccountModal open={localAuthOpen} onClose={() => setLocalAuthOpen(false)} />
        {isDevChannel && (
          <>
            <DevChannelBadge onOpenDiagnostics={() => setDiagOpen(true)} />
            {diagOpen && (
              <Suspense fallback={null}>
                <DiagnosticsModal open={diagOpen} onClose={() => setDiagOpen(false)} />
              </Suspense>
            )}
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
