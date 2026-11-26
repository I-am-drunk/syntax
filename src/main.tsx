import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './styles.css'
import './courses/courses.css'
import './ui/syntaxPlatform.css'
import { SyntaxErrorBoundary } from './core/ErrorBoundary'
import { initGlobalErrorCapture } from './core/logger'
import { SyntaxAuthProvider } from './core/clerkAuth'
import { AppShell } from './shell/AppShell'
import { AccountModal } from './ui/AccountModal'

initGlobalErrorCapture()

function SyntaxRoot() {
  const [localAuthOpen, setLocalAuthOpen] = useState(false)

  function handleCloseLocalAuth() {
    setLocalAuthOpen(false)
    window.dispatchEvent(new CustomEvent('syntax:auth-modal-closed'))
  }

  return (
    <MotionConfig reducedMotion="user">
      <SyntaxErrorBoundary scope="app">
        <SyntaxAuthProvider onOpenLocalSignIn={() => setLocalAuthOpen(true)}>
          <AppShell />
          <AccountModal open={localAuthOpen} onClose={handleCloseLocalAuth} />
        </SyntaxAuthProvider>
      </SyntaxErrorBoundary>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SyntaxRoot />
  </React.StrictMode>,
)
