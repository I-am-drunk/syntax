import { useEffect, useState } from 'react'
import type { WorkedPage } from '../pageTypes'
import { BrilliantGraph } from '../graph'
import { MathText } from './MathText'
import { WinBoxWindow } from './WinBoxWindow'

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
  const [solutionGraphOpen, setSolutionGraphOpen] = useState(false)

  useEffect(() => {
    setStepIdx(0)
    setRevealedSteps({})
    setSolutionGraphOpen(false)
    onStepChange?.(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id])

  const safeStepIdx = Math.min(stepIdx, Math.max(0, page.steps.length - 1))

  useEffect(() => {
    setSolutionGraphOpen(false)
    onStepChange?.(safeStepIdx)
  }, [safeStepIdx, onStepChange])

  const step = page.steps[safeStepIdx] ?? page.steps[0]
  const priorSteps = page.steps.slice(0, safeStepIdx)
  const algebraVisible = Boolean(revealedSteps[safeStepIdx])
  const preScene = step.preScene ?? page.preScene
  const hasSeparateSolutionGraph = Boolean(preScene)
  const mainScene = preScene ?? step.scene

  return (
    <div className="br-worked">
      <div className="geo-frame">
        <BrilliantGraph
          mode="display"
          scene={mainScene}
          caption={hasSeparateSolutionGraph ? 'Given setup' : step.heading}
        />
      </div>

      {hasSeparateSolutionGraph && (
        <div className="br-worked-graph-bar">
          <span className="br-worked-graph-hint">
            {algebraVisible
              ? 'Given diagram shown above. Open the full plotted solution when ready.'
              : 'Given diagram only. Reveal algebra to unlock the solution graph.'}
          </span>
          {algebraVisible && (
            <button
              type="button"
              className="br-worked-solution-btn"
              onClick={() => setSolutionGraphOpen(true)}
            >
              Show solution graph
            </button>
          )}
        </div>
      )}

      {(() => {
        const revealedPrior = priorSteps
          .map((ps, i) => ({ ps, i }))
          .filter(({ i }) => Boolean(revealedSteps[i]))
        if (revealedPrior.length === 0) return null
        return (
          <div className="br-worked-prior" aria-label="Revealed previous steps">
            {revealedPrior.map(({ ps, i }) => (
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
        )
      })()}

      <div className="br-worked-step">
        <div className="br-worked-step-head">
          <span className="br-worked-step-title">
            {CIRCLED[safeStepIdx] ?? `${safeStepIdx + 1}.`} <MathText text={step.heading} />
          </span>
          <div className="br-stepper">
            <button
              type="button"
              disabled={safeStepIdx === 0}
              onClick={() => setStepIdx(Math.max(0, safeStepIdx - 1))}
              aria-label="Previous step"
            >
              ←
            </button>
            <span className="br-stepper-count">
              {safeStepIdx + 1}/{page.steps.length}
            </span>
            <button
              type="button"
              disabled={safeStepIdx === page.steps.length - 1}
              onClick={() => setStepIdx(Math.min(page.steps.length - 1, safeStepIdx + 1))}
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
            <span className="br-worked-pen-prompt">
              {penMode ? 'Try this step on your worksheet first' : 'Work this step out on paper first'}
            </span>
            <button
              type="button"
              className="br-worked-reveal-btn"
              onClick={() => setRevealedSteps(prev => ({ ...prev, [safeStepIdx]: true }))}
            >
              Reveal algebra
            </button>
          </div>
        )}
      </div>

      {hasSeparateSolutionGraph && solutionGraphOpen && (
        <WinBoxWindow
          id={`worked-solution-graph-${page.id}`}
          eyebrow={`Step ${safeStepIdx + 1}`}
          title={step.heading}
          defaultWidth={560}
          defaultHeight={490}
          minWidth={360}
          minHeight={340}
          onClose={() => setSolutionGraphOpen(false)}
        >
          <div className="br-worked-winbox-body">
            <BrilliantGraph mode="display" scene={step.scene} caption={step.heading} />
          </div>
        </WinBoxWindow>
      )}
    </div>
  )
}
