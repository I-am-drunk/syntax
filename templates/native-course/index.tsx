import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CheckBar,
  ChoiceGroup,
  CompletionCard,
  LessonHeader,
  LessonShell,
  WorkedSteps,
} from '@syntax/ui'
import type { NativeExtensionContext } from './syntax-api'

type StarterCourseState = {
  completed: boolean
  bestStep: number
}

const CHOICES = [
  { id: 'a', label: 'Always double every number in the sequence' },
  { id: 'b', label: 'Add the next consecutive step size each time (+1, +2, +3, +4)' },
  { id: 'c', label: 'Repeat the first two numbers forever' },
]

const WORKED_STEPS = [
  { heading: 'Compare neighboring values', body: 'From 1 to 2 adds +1. From 2 to 4 adds +2. From 4 to 7 adds +3.' },
  { heading: 'Predict the next jump', body: 'The jump grows by 1 each time, so the next jump is +4.' },
  { heading: 'Compute the next value', body: '7 + 4 = 11. Checking the jump rule works across numbers, layouts, and schedules.' },
]

/**
 * Bundled lesson diagram: ships inside the course package download so the lesson
 * works offline and stays independent from Community Hub listing screenshots.
 */
function PatternDiagram() {
  return (
    <figure style={{ margin: 0 }} data-starter-course-asset="bundled-svg">
      <svg
        viewBox="0 0 420 120"
        role="img"
        aria-label="Sequence nodes 1, 2, 4, 7 with jumps +1, +2, +3 leading to ?"
        style={{ width: '100%', maxWidth: 420, height: 'auto', display: 'block' }}
      >
        <rect x="2" y="2" width="416" height="116" rx="14" fill="var(--surface-2, #f3f5f8)" stroke="var(--border, #d8dee6)" />
        {[
          { x: 48, label: '1' },
          { x: 132, label: '2' },
          { x: 216, label: '4' },
          { x: 300, label: '7' },
          { x: 376, label: '?' },
        ].map((node, index) => (
          <g key={node.label}>
            <circle
              cx={node.x}
              cy={68}
              r={20}
              fill={index === 4 ? 'var(--accent, #2563eb)' : 'var(--surface, #ffffff)'}
              stroke="var(--accent, #2563eb)"
              strokeWidth="2"
            />
            <text
              x={node.x}
              y={74}
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill={index === 4 ? '#ffffff' : 'var(--ink, #111827)'}
            >
              {node.label}
            </text>
          </g>
        ))}
        {[
          { x: 90, label: '+1' },
          { x: 174, label: '+2' },
          { x: 258, label: '+3' },
          { x: 338, label: '+4' },
        ].map(jump => (
          <text
            key={jump.label}
            x={jump.x}
            y={34}
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill="var(--accent, #2563eb)"
          >
            {jump.label}
          </text>
        ))}
      </svg>
    </figure>
  )
}

function StarterLesson({ ctx }: { ctx: NativeExtensionContext }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [choice, setChoice] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle')
  const [saved, setSaved] = useState<StarterCourseState>({ completed: false, bestStep: 0 })
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void ctx.loadData().then(raw => {
      if (!active || !raw || typeof raw !== 'object') return
      const data = raw as Partial<StarterCourseState>
      setSaved({
        completed: Boolean(data.completed),
        bestStep: typeof data.bestStep === 'number' ? data.bestStep : 0,
      })
    }).catch(() => undefined)
    return () => { active = false }
  }, [ctx])

  async function persistCompletion() {
    setSaveError(null)
    const next: StarterCourseState = { completed: true, bestStep: 2 }
    try {
      await ctx.saveData(next)
      await ctx.reportProgress({ completed: 1, total: 1, label: '1 / 1 lesson complete' })
      setSaved(next)
      setStage(2)
      ctx.playSound('complete')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save lesson progress.')
    }
  }

  function handleCheck() {
    if (!choice) return
    if (choice === 'b') {
      setStatus('correct')
      ctx.playSound('correct')
    } else {
      setStatus('incorrect')
      ctx.playSound('incorrect')
    }
  }

  return (
    <LessonShell
      header={
        <LessonHeader
          title="Spotting Growing Patterns"
          subtitle="Starter Course"
          stepIndex={stage}
          stepCount={3}
        />
      }
      footer={
        stage === 1 ? (
          <CheckBar
            status={status}
            feedback={
              status === 'correct'
                ? 'Right. Checking differences between neighbors reveals the +1, +2, +3, +4 rule.'
                : status === 'incorrect'
                  ? 'Look at the gap between 1 and 2 (+1), 2 and 4 (+2), and 4 and 7 (+3).'
                  : undefined
            }
            primaryLabel={status === 'correct' ? 'Finish lesson' : 'Check answer'}
            primaryDisabled={!choice}
            onPrimary={() => {
              if (status === 'correct') {
                void persistCompletion()
              } else {
                handleCheck()
              }
            }}
            secondaryLabel={status === 'incorrect' ? 'Try again' : undefined}
            onSecondary={status === 'incorrect' ? () => setStatus('idle') : undefined}
          />
        ) : undefined
      }
    >
      {saveError && (
        <Card>
          <p role="alert" style={{ margin: 0 }}>{saveError}</p>
        </Card>
      )}

      {stage === 0 && (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <Badge tone="accent">Lesson 1</Badge>
            {saved.completed && <Badge tone="success">Completed</Badge>}
          </div>
          <p style={{ marginTop: 0 }}>
            Many real-world systems do not grow by the same fixed amount every step. Comparing the
            difference between neighboring steps makes changing growth easy to spot.
          </p>
          <PatternDiagram />
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => setStage(1)}>
              Continue to question
            </Button>
          </div>
        </Card>
      )}

      {stage === 1 && (
        <div style={{ display: 'grid', gap: 16 }}>
          <Card>
            <p style={{ marginTop: 0, fontWeight: 600 }}>
              Which rule explains the pattern 1, 2, 4, 7, 11?
            </p>
            <ChoiceGroup
              label="Pattern rule choices"
              options={CHOICES}
              selected={choice ? [choice] : []}
              onToggle={value => {
                setChoice(value)
                if (status !== 'idle') setStatus('idle')
              }}
              evaluation={status}
              correctIds={['b']}
            />
          </Card>
          <WorkedSteps steps={WORKED_STEPS} />
        </div>
      )}

      {stage === 2 && (
        <CompletionCard
          title="Lesson complete"
          subtitle="You spotted the growing-step rule and recorded 1 / 1 lesson progress in Library."
          stats={[{ label: 'Lessons', value: '1 / 1' }]}
          primaryLabel="Review lesson"
          onPrimary={() => {
            setStage(0)
            setChoice(null)
            setStatus('idle')
          }}
        />
      )}
    </LessonShell>
  )
}

export function activate(ctx: NativeExtensionContext): void {
  ctx.registerScreen({
    id: 'lesson-1',
    title: 'Spotting Growing Patterns',
    kind: 'course',
    subtitle: 'A subject-neutral starter course with one interactive lesson and bundled diagram.',
    component: () => <StarterLesson ctx={ctx} />,
  })
  ctx.registerCommand({
    id: 'open-starter-course',
    title: 'Open Starter Course',
    run: () => ctx.openScreen('lesson-1'),
  })
}
