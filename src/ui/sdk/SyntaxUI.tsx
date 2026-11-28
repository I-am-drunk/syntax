import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { Sema, type SemaState } from '../../mascot/Sema'
import { Segmented, Toggle } from '../Controls'
import './syntaxUi.css'

export const SYNTAX_UI_VERSION: string = import.meta.env?.VITE_SYNTAX_UI_VERSION || '0.1.0'

export { Segmented, Toggle, Sema }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...rest },
  ref,
) {
  const classes = [
    'sx-ui-btn',
    `is-${variant}`,
    `is-${size}`,
    fullWidth ? 'is-full' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      data-syntax-ui="button"
      data-syntax-ui-version={SYNTAX_UI_VERSION}
      {...rest}
    />
  )
})

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
  tone?: 'surface' | 'secondary'
}

export function Card({
  padding = 'md',
  tone = 'surface',
  className = '',
  ...rest
}: CardProps) {
  const classes = ['sx-ui-card', `is-pad-${padding}`, `is-${tone}`, className]
    .filter(Boolean)
    .join(' ')
  return <div className={classes} data-syntax-ui="card" {...rest} />
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}

export function Badge({ tone = 'neutral', className = '', ...rest }: BadgeProps) {
  const classes = ['sx-ui-badge', `is-${tone}`, className].filter(Boolean).join(' ')
  return <span className={classes} data-syntax-ui="badge" {...rest} />
}

export interface ProgressBarProps {
  value: number
  max: number
  label?: string
  showCount?: boolean
}

export function ProgressBar({ value, max, label, showCount = false }: ProgressBarProps) {
  const safeMax = Math.max(1, max)
  const clamped = Math.max(0, Math.min(safeMax, value))
  const pct = Math.round((clamped / safeMax) * 100)
  return (
    <div className="sx-ui-progress-wrap" data-syntax-ui="progress">
      {(label || showCount) && (
        <div className="sx-ui-progress-meta">
          {label && <span className="sx-ui-progress-label">{label}</span>}
          {showCount && <span className="sx-ui-progress-count">{clamped} / {safeMax}</span>}
        </div>
      )}
      <div
        className="sx-ui-progress-track"
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
      >
        <div className="sx-ui-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export interface LessonHeaderProps {
  title: string
  subtitle?: string
  stepIndex: number
  stepCount: number
  onBack?: () => void
  backLabel?: string
  rightSlot?: ReactNode
}

export function LessonHeader({
  title,
  subtitle,
  stepIndex,
  stepCount,
  onBack,
  backLabel = 'Back',
  rightSlot,
}: LessonHeaderProps) {
  const safeCount = Math.max(1, stepCount)
  const safeStep = Math.max(1, Math.min(safeCount, stepIndex + 1))
  return (
    <header className="sx-ui-lesson-header" data-syntax-ui="lesson-header">
      <div className="sx-ui-lesson-header-top">
        <div className="sx-ui-lesson-header-left">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              {backLabel}
            </Button>
          )}
          <div className="sx-ui-lesson-title-group">
            <h1 className="sx-ui-lesson-title">{title}</h1>
            {subtitle && <p className="sx-ui-lesson-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="sx-ui-lesson-header-right">
          {rightSlot}
          <Badge tone="neutral">Step {safeStep} of {safeCount}</Badge>
        </div>
      </div>
      <ProgressBar value={safeStep} max={safeCount} label={`${title} progress`} />
    </header>
  )
}

export interface LessonShellProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  maxWidth?: number
}

export function LessonShell({ header, footer, children, maxWidth = 820 }: LessonShellProps) {
  return (
    <div
      className="sx-ui-lesson-shell"
      style={{ maxWidth: `${maxWidth}px` }}
      data-syntax-ui="lesson-shell"
      data-syntax-ui-version={SYNTAX_UI_VERSION}
    >
      {header}
      <div className="sx-ui-lesson-body">{children}</div>
      {footer && <div className="sx-ui-lesson-footer">{footer}</div>}
    </div>
  )
}

export interface ChoiceOption {
  id: string
  label: ReactNode
  detail?: ReactNode
}

export interface ChoiceGroupProps {
  options: readonly ChoiceOption[]
  selected: readonly string[]
  multiple?: boolean
  evaluation?: 'idle' | 'correct' | 'incorrect'
  correctIds?: readonly string[]
  disabled?: boolean
  label?: string
  onToggle: (id: string) => void
}

export function ChoiceGroup({
  options,
  selected,
  multiple = false,
  evaluation = 'idle',
  correctIds = [],
  disabled = false,
  label = 'Answer choices',
  onToggle,
}: ChoiceGroupProps) {
  const locked = disabled || evaluation !== 'idle'

  useEffect(() => {
    if (locked) return
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable ||
        document.querySelector('[role="dialog"], [role="menu"]') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return
      }
      const idx = Number(e.key) - 1
      if (Number.isInteger(idx) && idx >= 0 && idx < options.length) {
        e.preventDefault()
        onToggle(options[idx].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [locked, options, onToggle])

  return (
    <div
      className="sx-ui-choice-group"
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      data-syntax-ui="choice-group"
      onKeyDown={e => {
        if (multiple || locked || options.length === 0) return
        if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return
        e.preventDefault()
        const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-choice-option]')]
        const focusedIdx = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const selectedIdx = options.findIndex(opt => selected.includes(opt.id))
        const curIdx = focusedIdx >= 0 ? focusedIdx : Math.max(0, selectedIdx)
        const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
        const nextIdx = (curIdx + dir + options.length) % options.length
        onToggle(options[nextIdx].id)
        buttons[nextIdx]?.focus()
      }}
    >
      {options.map((option, idx) => {
        const isSelected = selected.includes(option.id)
        const isRight = correctIds.includes(option.id)
        let state = 'idle'
        if (evaluation !== 'idle') {
          if (isSelected && isRight) state = 'correct'
          else if (isSelected && !isRight) state = 'wrong'
          else if (!isSelected && isRight) state = 'missed'
        } else if (isSelected) {
          state = 'selected'
        }
        const radioTabIndex = multiple
          ? 0
          : isSelected || (selected.length === 0 && idx === 0)
            ? 0
            : -1
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={isSelected}
            tabIndex={locked ? -1 : radioTabIndex}
            disabled={locked}
            data-choice-option={option.id}
            data-choice-state={state}
            className={`sx-ui-choice-btn is-${state}`}
            onClick={() => !locked && onToggle(option.id)}
          >
            <span className="sx-ui-choice-index" aria-hidden="true">{idx + 1}</span>
            <span className="sx-ui-choice-copy">
              <span className="sx-ui-choice-label">{option.label}</span>
              {option.detail && <span className="sx-ui-choice-detail">{option.detail}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export interface WorkedStepItem {
  heading: ReactNode
  summary?: ReactNode
  body: ReactNode
  visual?: ReactNode
}

export interface WorkedStepsProps {
  steps: readonly WorkedStepItem[]
  activeStep?: number
  onStepChange?: (index: number) => void
  onAllRevealed?: () => void
}

export function WorkedSteps({
  steps,
  activeStep: controlledStep,
  onStepChange,
  onAllRevealed,
}: WorkedStepsProps) {
  const [internalStep, setInternalStep] = useState(0)
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const allNotifiedRef = useRef(false)
  const stepIdx = Math.min(controlledStep ?? internalStep, Math.max(0, steps.length - 1))

  useEffect(() => {
    if (!allNotifiedRef.current && steps.length > 0 && Object.keys(revealed).length >= steps.length) {
      allNotifiedRef.current = true
      onAllRevealed?.()
    }
  }, [revealed, steps.length, onAllRevealed])

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, next))
    setInternalStep(clamped)
    onStepChange?.(clamped)
  }

  function revealCurrent() {
    setRevealed(prev => (prev[stepIdx] ? prev : { ...prev, [stepIdx]: true }))
    window.requestAnimationFrame(() => bodyRef.current?.focus())
  }

  const current = steps[stepIdx]
  if (!current) return null
  const isRevealed = Boolean(revealed[stepIdx])
  const revealedPrior = steps
    .slice(0, stepIdx)
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => Boolean(revealed[idx]))

  return (
    <Card className="sx-ui-worked" data-syntax-ui="worked-steps">
      {current.visual && <div className="sx-ui-worked-visual">{current.visual}</div>}

      {revealedPrior.length > 0 && (
        <div className="sx-ui-worked-prior" aria-label="Previous steps">
          {revealedPrior.map(({ item, idx }) => (
            <button
              key={idx}
              type="button"
              className="sx-ui-worked-prior-btn"
              onClick={() => goTo(idx)}
            >
              <span>{idx + 1}.</span>
              <span>{item.summary ?? item.heading}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sx-ui-worked-head">
        <div className="sx-ui-worked-heading">
          <Badge tone="accent">Step {stepIdx + 1} / {steps.length}</Badge>
          <strong>{current.heading}</strong>
        </div>
        <div className="sx-ui-worked-nav">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous step"
            disabled={stepIdx === 0}
            onClick={() => goTo(stepIdx - 1)}
          >
            Prev
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next step"
            disabled={stepIdx >= steps.length - 1}
            onClick={() => goTo(stepIdx + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {isRevealed ? (
        <div ref={bodyRef} tabIndex={-1} aria-live="polite" className="sx-ui-worked-body">
          {current.body}
        </div>
      ) : (
        <div className="sx-ui-worked-reveal">
          <Button variant="secondary" size="sm" onClick={revealCurrent}>
            Reveal step {stepIdx + 1}
          </Button>
        </div>
      )}
    </Card>
  )
}

export interface CheckBarProps {
  status?: 'idle' | 'correct' | 'incorrect' | 'info'
  feedback?: ReactNode
  hint?: ReactNode
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary?: () => void
  semaState?: SemaState
}

export function CheckBar({
  status = 'idle',
  feedback,
  hint,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  secondaryLabel,
  onSecondary,
  semaState,
}: CheckBarProps) {
  const resolvedSema: SemaState = semaState ?? (
    status === 'correct' ? 'celebrate' : status === 'incorrect' ? 'guiding' : 'idle'
  )
  return (
    <div className={`sx-ui-checkbar is-${status}`} data-syntax-ui="check-bar">
      <div className="sx-ui-checkbar-copy">
        <div className="sx-ui-checkbar-sema" aria-hidden="true">
          <Sema state={resolvedSema} size={34} />
        </div>
        <div className="sx-ui-checkbar-text" role="status" aria-live="polite">
          {feedback && <div className="sx-ui-checkbar-feedback">{feedback}</div>}
          {hint && <div className="sx-ui-checkbar-hint">{hint}</div>}
        </div>
      </div>
      <div className="sx-ui-checkbar-actions">
        {secondaryLabel && onSecondary && (
          <Button variant="secondary" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
        <Button variant="primary" disabled={primaryDisabled} onClick={onPrimary}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  )
}

export interface CompletionCardProps {
  title: string
  subtitle?: ReactNode
  stats?: readonly { label: string; value: string }[]
  primaryLabel?: string
  onPrimary?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

export function CompletionCard({
  title,
  subtitle,
  stats,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: CompletionCardProps) {
  return (
    <Card padding="lg" className="sx-ui-completion" data-syntax-ui="completion-card">
      <div className="sx-ui-completion-sema" aria-hidden="true">
        <Sema state="celebrate" size={64} />
      </div>
      <h2 className="sx-ui-completion-title">{title}</h2>
      {subtitle && <p className="sx-ui-completion-subtitle">{subtitle}</p>}
      {stats && stats.length > 0 && (
        <dl className="sx-ui-completion-stats">
          {stats.map(stat => (
            <div key={stat.label} className="sx-ui-completion-stat">
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="sx-ui-completion-actions">
        {secondaryLabel && onSecondary && (
          <Button variant="secondary" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
        {primaryLabel && onPrimary && (
          <Button variant="primary" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        )}
      </div>
    </Card>
  )
}

export const syntaxUiHostModule = {
  SYNTAX_UI_VERSION,
  Button,
  Card,
  Badge,
  ProgressBar,
  Segmented,
  Toggle,
  Sema,
  LessonHeader,
  LessonShell,
  ChoiceGroup,
  WorkedSteps,
  CheckBar,
  CompletionCard,
}
