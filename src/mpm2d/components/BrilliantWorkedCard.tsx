import { useEffect, useState } from 'react'
import type { WorkedPage } from '../pageTypes'
import { BrilliantGraph } from '../graph'
import { MathText } from './MathText'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥']

export function BrilliantWorkedCard({
  page,
  penMode = false,
  onStepChange,
}: {
  page: WorkedPage
  penMode?: boolean
  onStepChange?: (idx: number) => void
}) {
  const [stepIdx, setStepIdx] = useState(0)
  const [revealedSteps, setRevealedSteps] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setStepIdx(0)
    setRevealedSteps({})
    onStepChange?.(0)
  }, [page.id])

  useEffect(() => {
    onStepChange?.(stepIdx)
  }, [stepIdx, onStepChange])

  const step = page.steps[stepIdx] ?? page.steps[0]
  const priorSteps = page.steps.slice(0, stepIdx)
  const algebraVisible = Boolean(revealedSteps[stepIdx])

  return (
    <div className="br-worked">
      <div className="br-worked-meta">
        <span className="br-source-tag">{page.source}</span>
      </div>

      <div className="geo-frame">
        <BrilliantGraph mode="display" scene={step.scene} caption={step.heading} />
      </div>

      {priorSteps.length > 0 && (
        <div className="br-worked-prior" aria-label="Previous steps">
          {priorSteps.map((ps, i) => (
            <button
              key={i}
              type="button"
              className="br-worked-prior-row"
              onClick={() => setStepIdx(i)}
            >
              <span className="br-worked-prior-num">{CIRCLED[i] ?? `${i + 1}.`}</span>
              <span className="br-worked-prior-val">
                <MathText text={ps.mathLines[ps.mathLines.length - 1] ?? ps.heading} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="br-worked-step">
        <div className="br-worked-step-head">
          <span className="br-worked-step-title">
            {CIRCLED[stepIdx] ?? `${stepIdx + 1}.`} <MathText text={step.heading} />
          </span>
          <div className="br-stepper">
            <button
              type="button"
              disabled={stepIdx === 0}
              onClick={() => setStepIdx(i => Math.max(0, i - 1))}
              aria-label="Previous step"
            >
              ←
            </button>
            <span className="br-stepper-count">
              {stepIdx + 1}/{page.steps.length}
            </span>
            <button
              type="button"
              disabled={stepIdx === page.steps.length - 1}
              onClick={() => setStepIdx(i => Math.min(page.steps.length - 1, i + 1))}
              aria-label="Next step"
            >
              →
            </button>
          </div>
        </div>

        {algebraVisible ? (
          <div className="br-math-lines">
            {step.mathLines.map((line, i) => (
              <div key={i}>
                <MathText text={line} />
              </div>
            ))}
          </div>
        ) : (
          <div className="br-worked-pen-gate">
            <span className="br-worked-pen-prompt">{penMode ? "Try this step on your worksheet first" : "Work this step out on paper first"}</span>
            <button
              type="button"
              className="br-worked-reveal-btn"
              onClick={() => setRevealedSteps(prev => ({ ...prev, [stepIdx]: true }))}
            >
              Reveal algebra
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
