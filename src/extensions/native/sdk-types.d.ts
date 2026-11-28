declare module '@syntax/api' {
  export type SyntaxTheme = 'light' | 'dark'
  export type SyntaxSoundCue = 'correct' | 'incorrect' | 'click' | 'complete'
  export function useSyntaxTheme(): SyntaxTheme
  export function playSyntaxSound(cue: SyntaxSoundCue): void
}

declare module '@syntax/ui' {
  import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode, RefAttributes } from 'react'

  export const SYNTAX_UI_VERSION: string

  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, RefAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    fullWidth?: boolean
  }
  export function Button(props: ButtonProps): ReactElement

  export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    padding?: 'sm' | 'md' | 'lg'
    tone?: 'surface' | 'secondary'
  }
  export function Card(props: CardProps): ReactElement

  export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  }
  export function Badge(props: BadgeProps): ReactElement

  export interface ProgressBarProps {
    value: number
    max: number
    label?: string
    showCount?: boolean
  }
  export function ProgressBar(props: ProgressBarProps): ReactElement

  export function Segmented<T extends string>(props: {
    label: string
    value: T
    options: readonly { value: T; label: string }[]
    onChange: (value: T) => void
    disabled?: boolean
    loading?: boolean
  }): ReactElement

  export function Toggle(props: {
    label: string
    checked: boolean
    onChange: (value: boolean) => void
    disabled?: boolean
    loading?: boolean
  }): ReactElement

  export type SemaState = 'idle' | 'speaking' | 'guiding' | 'nodding' | 'bobbing' | 'nudge' | 'celebrate' | 'focus' | 'spinner'
  export function Sema(props: {
    state?: SemaState
    size?: number
    className?: string
  }): ReactElement

  export interface LessonHeaderProps {
    title: string
    subtitle?: string
    stepIndex: number
    stepCount: number
    onBack?: () => void
    backLabel?: string
    rightSlot?: ReactNode
  }
  export function LessonHeader(props: LessonHeaderProps): ReactElement

  export interface LessonShellProps {
    header?: ReactNode
    footer?: ReactNode
    children: ReactNode
    maxWidth?: number
  }
  export function LessonShell(props: LessonShellProps): ReactElement

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
  export function ChoiceGroup(props: ChoiceGroupProps): ReactElement

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
  export function WorkedSteps(props: WorkedStepsProps): ReactElement

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
  export function CheckBar(props: CheckBarProps): ReactElement

  export interface CompletionCardProps {
    title: string
    subtitle?: ReactNode
    stats?: readonly { label: string; value: string }[]
    primaryLabel?: string
    onPrimary?: () => void
    secondaryLabel?: string
    onSecondary?: () => void
  }
  export function CompletionCard(props: CompletionCardProps): ReactElement
}
