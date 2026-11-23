import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Arrow } from '../../lessons/LessonControls'
import type { GeoExplanation } from '../pageTypes'
import { BrilliantGraph } from '../graph'
import { MathText } from './MathText'

function Caret({ direction }: { direction: 'left' | 'right' | 'down' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 12 8"
      aria-hidden="true"
      style={{ rotate: `${direction === 'down' ? 180 : direction === 'left' ? -90 : 90}deg` }}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.7071 6.14644L10.2929 7.56065L6.00001 3.26776L1.70712 7.56065L0.292908 6.14644L6.00001 0.439331L11.7071 6.14644Z"
      />
    </svg>
  )
}

export function GeoExplanationContent({
  explanation,
  isLast,
  title = 'Explanation',
  inline = false,
  canContinue = true,
  onClose,
  onContinue,
}: {
  explanation: GeoExplanation
  isLast: boolean
  title?: string
  inline?: boolean
  canContinue?: boolean
  onClose: () => void
  onContinue: () => void
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [explanation])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable ||
        target?.closest('[data-pen-workspace]')
      ) {
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex(i => Math.min(explanation.steps.length - 1, i + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex(i => Math.max(0, i - 1))
      } else if (e.key === 'Escape' && inline) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explanation.steps.length, inline, onClose])

  const step = explanation.steps[index] ?? explanation.steps[0]
  const last = index === explanation.steps.length - 1

  return (
    <>
      <header className="explanation-header">
        {inline ? (
          <h2 className="explanation-title">{title}</h2>
        ) : (
          <Dialog.Title className="explanation-title">{title}</Dialog.Title>
        )}
        {inline ? (
          <button type="button" className="explanation-close" aria-label="Close explanation" onClick={onClose}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <Dialog.Close className="explanation-close" aria-label="Close explanation">
            <span className="explanation-desktop-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </span>
            <span className="explanation-mobile-icon">
              <Caret direction="down" />
            </span>
          </Dialog.Close>
        )}
      </header>

      <div className="explanation-body geo-explanation-body">
        <div className="geo-explanation-canvas">
          <BrilliantGraph mode="display" scene={step.scene} />
        </div>
        <div className="geo-explanation-copy" aria-live="polite">
          <p>
            <MathText text={step.text} />
          </p>
          {step.math && (
            <div className="geo-explanation-math">
              <MathText text={step.math} />
            </div>
          )}
        </div>
      </div>

      <footer className="explanation-footer" data-last={last}>
        <div className="explanation-previous-wrap">
          <button
            type="button"
            className="explanation-step-button"
            aria-label="Previous"
            disabled={index === 0}
            onClick={() => setIndex(i => Math.max(0, i - 1))}
          >
            <span className="explanation-desktop-icon">
              <Caret direction="left" />
            </span>
            <span className="explanation-mobile-icon">
              <Arrow />
            </span>
          </button>
        </div>

        <div className="explanation-dots" aria-label={`Step ${index + 1} of ${explanation.steps.length}`}>
          {index > 0 && (
            <button type="button" aria-label="Previous step" onClick={() => setIndex(i => i - 1)}>
              {Array.from({ length: index }, (_, i) => (
                <i key={i} />
              ))}
            </button>
          )}
          <i className="explanation-current-dot" />
          {!last && (
            <button type="button" aria-label="Next step" onClick={() => setIndex(i => i + 1)}>
              {Array.from({ length: explanation.steps.length - index - 1 }, (_, i) => (
                <i key={i} />
              ))}
            </button>
          )}
        </div>

        <div className="explanation-next-wrap">
          <button
            type="button"
            className="explanation-step-button explanation-next"
            aria-label="Next"
            disabled={last}
            onClick={() => setIndex(i => Math.min(explanation.steps.length - 1, i + 1))}
          >
            <span className="explanation-desktop-icon">
              <Caret direction="right" />
            </span>
            <span className="explanation-mobile-icon">
              <Arrow right />
            </span>
          </button>
        </div>

        {last && (
          <button
            type="button"
            className="lesson-action explanation-advance"
            onClick={() => {
              onClose()
              if (canContinue) onContinue()
            }}
          >
            <span>{!canContinue ? 'Done' : isLast ? 'Finish' : 'Continue'}</span>
          </button>
        )}
      </footer>
    </>
  )
}

export function GeoExplanationModal({
  explanation,
  open,
  isLast,
  canContinue = true,
  onClose,
  onContinue,
}: {
  explanation: GeoExplanation
  open: boolean
  isLast: boolean
  canContinue?: boolean
  onClose: () => void
  onContinue: () => void
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={value => {
        if (!value) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="explanation-backdrop" />
        <Dialog.Popup className="practice-explanation geo-explanation-popup" initialFocus={false}>
          {open && (
            <GeoExplanationContent
              explanation={explanation}
              isLast={isLast}
              canContinue={canContinue}
              onClose={onClose}
              onContinue={onContinue}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
