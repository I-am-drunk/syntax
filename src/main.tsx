import React, { Suspense, lazy, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './courses/courses.css'
import './ui/syntaxPlatform.css'
import { SyntaxErrorBoundary } from './core/ErrorBoundary'
import { initGlobalErrorCapture } from './core/logger'
import { SyntaxAuthProvider } from './core/clerkAuth'
import { isDevEnvironment } from './core/devEnv'
import { AppShell } from './shell/AppShell'
import { AccountModal } from './ui/AccountModal'

const DevToolsSuite = lazy(() =>
  import('./core/devTools').then(m => ({ default: m.DevToolsSuite })),
)

initGlobalErrorCapture()

const isDevChannel = isDevEnvironment()

function SyntaxRoot() {
  const [localAuthOpen, setLocalAuthOpen] = useState(false)

  return (
    <SyntaxErrorBoundary scope="app">
      <SyntaxAuthProvider onOpenLocalSignIn={() => setLocalAuthOpen(true)}>
        <AppShell />
        <AccountModal open={localAuthOpen} onClose={() => setLocalAuthOpen(false)} />
        {isDevChannel && (
          <Suspense fallback={null}>
            <DevToolsSuite />
          </Suspense>
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
