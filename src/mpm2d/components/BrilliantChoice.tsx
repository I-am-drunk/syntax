import { useEffect } from 'react'
import type { ChoiceOption } from '../pageTypes'
import { MathText } from './MathText'

export type ChoiceEvaluation = 'unsubmitted' | 'incorrect-retry' | 'incorrect' | 'correct'

function CheckSvg() {
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" fill="none" aria-hidden="true">
      <path
        d="M1.5 5.6L4.8 9L11.5 1.8"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CrossSvg() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path
        d="M2 2L9 9M9 2L2 9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BrilliantChoice({
  options,
  selected,
  multiple = false,
  layout = 'default',
  evaluation,
  correctIds,
  active,
  onToggle,
}: {
  options: ChoiceOption[]
  selected: string[]
  multiple?: boolean
  layout?: 'default' | 'steps'
  evaluation: ChoiceEvaluation
  correctIds: string[]
  active: boolean
  onToggle: (id: string) => void
}) {
  const locked = evaluation !== 'unsubmitted'
  const isSteps = layout === 'steps'
  const maxLen = Math.max(...options.map(o => o.label.length))
  const isCompactGrid = !isSteps && !multiple && maxLen <= 14 && options.length >= 3 && options.length <= 4
  const isColumn = isSteps || multiple || !isCompactGrid

  useEffect(() => {
    if (!active || locked) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        el?.isContentEditable ||
        el?.closest('[data-pen-workspace]') ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return
      }
      const idx = Number(e.key) - 1
      if (idx >= 0 && idx < options.length) {
        e.preventDefault()
        onToggle(options[idx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, locked, options, onToggle])

  return (
    <div className="br-choice-wrap">
      {multiple && (
        <div className="br-choice-caption">Select all that apply</div>
      )}
      {isSteps && (
        <div className="br-choice-caption">Tap the step that contains the flaw</div>
      )}
      <div
        className={`br-choice-list${
          isSteps ? ' is-steps' : isCompactGrid ? ' is-grid' : isColumn ? ' is-column' : ' is-row'
        }`}
        role={multiple ? 'group' : 'radiogroup'}
      >
        {options.map((opt, idx) => {
          const isSelected = selected.includes(opt.id)
          const isRight = correctIds.includes(opt.id)
          let state: 'idle' | 'selected' | 'correct' | 'wrong' | 'missed' = 'idle'
          if (locked) {
            if (isSelected && isRight) state = 'correct'
            else if (isSelected && !isRight) state = 'wrong'
            else if (!isSelected && isRight && evaluation === 'incorrect') state = 'missed'
          } else if (isSelected) {
            state = 'selected'
          }

          return (
            <button
              key={opt.id}
              type="button"
              className={`br-choice-btn${isCompactGrid ? ' is-compact' : ''}${isSteps ? ' is-step-row' : ''}`}
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              data-slot="choice-button"
              data-selected={isSelected || undefined}
              data-state={state}
              disabled={locked}
              onClick={() => onToggle(opt.id)}
            >
              {isSteps && (
                <span className="br-step-choice-num" aria-hidden="true">
                  {idx + 1}
                </span>
              )}
              {!isSteps && multiple && (
                <span
                  className="br-checkbox"
                  data-checked={isSelected || undefined}
                  aria-hidden="true"
                >
                  {isSelected && <CheckSvg />}
                </span>
              )}
              {!isSteps && !multiple && !isCompactGrid && (
                <span
                  className="br-radio"
                  data-checked={isSelected || undefined}
                  aria-hidden="true"
                >
                  <i />
                </span>
              )}
              <span className="br-choice-label">
                <MathText text={opt.label} stackedFractions />
              </span>
              {locked && (state === 'correct' || state === 'wrong' || state === 'missed') && (
                <span className={`br-choice-badge is-${state}`} aria-hidden="true">
                  {state === 'wrong' ? <CrossSvg /> : <CheckSvg />}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
