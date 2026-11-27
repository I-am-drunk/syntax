import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Dialog } from '@base-ui/react/dialog'
import { Sema, type SemaShapeName, type SemaTailName } from '../mascot/Sema'
import './onboarding.css'

export function OnboardingModal({
  open,
  theme,
  semaShape = 'jenson',
  semaTail = 'jenson',
  onSelectTheme,
  onFinish,
}: {
  open: boolean
  theme: 'light' | 'dark'
  semaShape?: SemaShapeName
  semaTail?: SemaTailName
  onSelectTheme: (next: 'light' | 'dark') => void
  onFinish: () => void
}) {
  const [beat, setBeat] = useState<0 | 1>(0)

  useEffect(() => {
    if (open) {
      setBeat(0)
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
            {[0, 1].map(i => (
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
                    Hi, I&rsquo;m Sema
                  </div>
                  <Sema
                    state="idle"
                    expression="happy"
                    shape={semaShape}
                    tail={semaTail}
                    size={84}
                    interactive
                    ariaLabel="Sema greeting you"
                  />
                </div>
              </motion.div>
              <Dialog.Title className="ob-title">Welcome to Syntax</Dialog.Title>
              <p className="ob-copy">
                Meet Sema. Customize your workspace, install extensions, and build at your own pace.
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
                <Sema
                  state="idle"
                  expression="curious"
                  shape={semaShape}
                  tail={semaTail}
                  size={54}
                  interactive
                  ariaLabel="Sema theme preview"
                />
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
                <button type="button" className="ob-primary" onClick={onFinish}>
                  Get started
                </button>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
