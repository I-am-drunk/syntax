import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from '@base-ui/react/dialog'
import { Sema, type SemaShapeName, type SemaTailName } from '../mascot/Sema'
import './onboarding.css'

export function OnboardingModal({
  open,
  theme,
  drawMode,
  semaShape = 'jenson',
  semaTail = 'jenson',
  onSelectTheme,
  onSelectDrawMode,
  onFinish,
}: {
  open: boolean
  theme: 'light' | 'dark'
  drawMode: boolean
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  onSelectTheme: (next: 'light' | 'dark') => void
  onSelectDrawMode: (next: boolean) => void
  onFinish: () => void
}) {
  const [beat, setBeat] = useState<0 | 1 | 2>(0)
  const [penDetected, setPenDetected] = useState(false)
  const autoDetectedRef = useRef(false)
  const onSelectDrawModeRef = useRef(onSelectDrawMode)
  onSelectDrawModeRef.current = onSelectDrawMode

  useEffect(() => {
    if (!open) return
    const onPtr = (e: PointerEvent) => {
      if (e.pointerType === 'pen' && !autoDetectedRef.current) {
        const target = e.target as HTMLElement | null
        if (target?.closest('.ob-choice-card, .ob-actions, button')) return
        autoDetectedRef.current = true
        setPenDetected(true)
        onSelectDrawModeRef.current(true)
      }
    }
    window.addEventListener('pointerdown', onPtr, { passive: true })
    return () => window.removeEventListener('pointerdown', onPtr)
  }, [open])

  useEffect(() => {
    if (open) {
      setBeat(0)
      setPenDetected(false)
      autoDetectedRef.current = false
    }
  }, [open])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={v => {
        if (!v) onFinish()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="ob-backdrop" />
        <Dialog.Popup className="ob-popup">
          <div className="ob-dots" aria-hidden="true">
            {[0, 1, 2].map(i => (
              <span key={i} className={`ob-dot${beat === i ? ' is-active' : ''}`} />
            ))}
          </div>

          {beat === 0 && (
            <div className="ob-beat">
              <motion.div
                className="ob-sema-stage"
                initial={{ y: -28, scale: 0.72, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              >
                <div className="sema-bubble-anchor">
                  <div className="sema-speech-bubble" data-placement="top" aria-hidden="true">
                    Hi, I’m Sema
                  </div>
                  <Sema state="idle" expression="happy" shape={semaShape} tail={semaTail} size={84} interactive ariaLabel="Sema greeting you" />
                </div>
              </motion.div>
              <Dialog.Title className="ob-title">Welcome to Syntax</Dialog.Title>
              <p className="ob-copy">
                Meet Sema. Poke or drag them anytime, tap <strong>?</strong> during any problem for a live guided walkthrough, and learn Unit 2 at your own pace.
              </p>
              <div className="ob-actions">
                <button type="button" className="ob-skip" onClick={onFinish}>
                  Skip
                </button>
                <button type="button" className="ob-primary" onClick={() => setBeat(1)}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {beat === 1 && (
            <div className="ob-beat">
              <div className="ob-sema-mini">
                <Sema state="idle" expression="curious" shape={semaShape} tail={semaTail} size={54} interactive ariaLabel="Sema theme preview" />
              </div>
              <Dialog.Title className="ob-title">Pick your look</Dialog.Title>
              <p className="ob-copy">Switch anytime from the top bar.</p>
              <div className="ob-card-grid">
                <button
                  type="button"
                  aria-pressed={theme === 'light'}
                  className={`ob-choice-card is-light${theme === 'light' ? ' is-selected' : ''}`}
                  onClick={() => onSelectTheme('light')}
                >
                  <div className="ob-mini-preview is-light">
                    <span className="ob-mini-bar" />
                    <span className="ob-mini-graph" />
                    <span className="ob-mini-btn" />
                  </div>
                  <strong>Light</strong>
                </button>
                <button
                  type="button"
                  aria-pressed={theme === 'dark'}
                  className={`ob-choice-card is-dark${theme === 'dark' ? ' is-selected' : ''}`}
                  onClick={() => onSelectTheme('dark')}
                >
                  <div className="ob-mini-preview is-dark">
                    <span className="ob-mini-bar" />
                    <span className="ob-mini-graph" />
                    <span className="ob-mini-btn" />
                  </div>
                  <strong>Dark</strong>
                </button>
              </div>
              <div className="ob-actions">
                <button type="button" className="ob-skip" onClick={() => setBeat(0)}>
                  Back
                </button>
                <button type="button" className="ob-primary" onClick={() => setBeat(2)}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {beat === 2 && (
            <div className="ob-beat">
              <div className="ob-sema-mini">
                <Sema state={drawMode ? 'checkbox' : 'wink'} shape={semaShape} tail={semaTail} size={54} interactive ariaLabel="Sema mode preview" />
              </div>
              <Dialog.Title className="ob-title">How do you want to check answers?</Dialog.Title>
              <p className="ob-copy">
                Use Draw Mode to sketch checkmarks to submit (great with a stylus or mouse), or classic tap & keyboard.
              </p>
              <div className="ob-card-grid">
                <button
                  type="button"
                  aria-pressed={drawMode}
                  className={`ob-choice-card${drawMode ? ' is-selected' : ''}`}
                  onClick={() => onSelectDrawMode(true)}
                >
                  <div className="ob-mode-icon">
                    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 19 L14 27 L29 8" />
                    </svg>
                  </div>
                  <strong>
                    Draw Mode
                    {penDetected && <span className="ob-pen-badge">Pen detected</span>}
                  </strong>
                  <span>Draw checkmarks to check & continue</span>
                </button>
                <button
                  type="button"
                  aria-pressed={!drawMode}
                  className={`ob-choice-card${!drawMode ? ' is-selected' : ''}`}
                  onClick={() => onSelectDrawMode(false)}
                >
                  <div className="ob-mode-icon">
                    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="8" width="26" height="18" rx="4" />
                      <line x1="9" y1="14" x2="13" y2="14" />
                      <line x1="16" y1="14" x2="20" y2="14" />
                      <line x1="23" y1="14" x2="25" y2="14" />
                      <line x1="10" y1="20" x2="24" y2="20" />
                    </svg>
                  </div>
                  <strong>Keyboard & Tap</strong>
                  <span>Classic Check & Enter flow</span>
                </button>
              </div>
              <div className="ob-actions">
                <button type="button" className="ob-skip" onClick={() => setBeat(1)}>
                  Back
                </button>
                <button type="button" className="ob-primary" onClick={onFinish}>
                  Start learning
                </button>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
