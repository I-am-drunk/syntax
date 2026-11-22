import { useEffect, useRef } from 'react'
import { formatMathPreview, type StepAnswerSpec } from '../mathParser'
import type { ChoiceEvaluation } from './BrilliantChoice'
import { MathText } from './MathText'

export function BrilliantMathInput({
  value,
  spec,
  placeholder,
  evaluation,
  feedback,
  pinnedHint,
  active,
  onChange,
  onSubmit,
}: {
  value: string
  spec: Exclude<StepAnswerSpec, { kind: 'choice' }>
  placeholder?: string
  evaluation: ChoiceEvaluation
  feedback?: string
  /** Diagnostic hint that stays visible while editing after an incorrect-retry */
  pinnedHint?: string
  active: boolean
  onChange: (next: string) => void
  onSubmit: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Keep editable on incorrect-retry so the student never has to click "Try again" just to fix a sign
  const locked = evaluation === 'correct' || evaluation === 'incorrect'

  useEffect(() => {
    if (active && !locked) {
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [active, locked])

  const insertToken = (token: string, cursorBack = 0) => {
    const el = inputRef.current
    if (!el) {
      onChange(value + token)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length - cursorBack
      el.setSelectionRange(pos, pos)
    })
  }

  const chips: { label: string; token: string; back?: number }[] =
    spec.kind === 'number'
      ? [
          { label: '√', token: 'sqrt()', back: 1 },
          { label: '/', token: '/' },
          { label: '−', token: '-' },
        ]
      : spec.kind === 'circle'
        ? [
            { label: 'x²', token: 'x^2' },
            { label: 'y²', token: 'y^2' },
            { label: '=', token: ' = ' },
          ]
        : spec.kind === 'line'
          ? [
              { label: 'y =', token: 'y = ' },
              { label: 'x =', token: 'x = ' },
              { label: '/', token: '/' },
              { label: '−', token: '-' },
            ]
          : [
              { label: '( , )', token: '(, )', back: 3 },
              { label: '/', token: '/' },
              { label: '−', token: '-' },
            ]

  const preview = formatMathPreview(value)
  const showPreview = value.trim().length > 0 && preview !== value.trim()
  const activeHint =
    evaluation !== 'correct' ? feedback ?? (evaluation === 'unsubmitted' ? pinnedHint : undefined) : undefined

  return (
    <div className="br-math-wrap">
      <div className="br-math-box" data-evaluation={evaluation}>
        <input
          ref={inputRef}
          type="text"
          className="br-math-input"
          value={value}
          disabled={locked}
          placeholder={placeholder ?? 'Type your answer'}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {showPreview && (
          <span className="br-math-preview" aria-live="polite">
            {preview}
          </span>
        )}
      </div>

      {!locked && (
        <div className="br-math-chips">
          {chips.map(c => (
            <button
              key={c.label}
              type="button"
              className="br-math-chip"
              tabIndex={-1}
              onMouseDown={e => e.preventDefault()}
              onClick={() => insertToken(c.token, c.back ?? 0)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {evaluation === 'correct' && (
        <div className="br-inline-note is-correct">
          Answer: <strong><MathText text={spec.display} /></strong>
        </div>
      )}

      {activeHint && (
        <div className="br-inline-note is-hint">
          <MathText text={activeHint} />
        </div>
      )}
    </div>
  )
}
