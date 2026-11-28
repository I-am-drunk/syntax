import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
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
} from '../SyntaxUI'

function InteractiveLessonExample() {
  const [stage, setStage] = useState<0 | 1 | 2>(0)
  const [choice, setChoice] = useState<string | null>('b')
  const [status, setStatus] = useState<'idle' | 'correct' | 'incorrect'>('idle')

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
                ? 'Right. Comparing differences between neighboring terms exposes the +1, +2, +3, +4 rule.'
                : status === 'incorrect'
                  ? 'Try comparing each pair of adjacent values: 1 to 2, 2 to 4, 4 to 7.'
                  : undefined
            }
            primaryLabel={status === 'correct' ? 'Finish lesson' : 'Check answer'}
            primaryDisabled={!choice}
            onPrimary={() => {
              if (status === 'correct') setStage(2)
              else setStatus(choice === 'b' ? 'correct' : 'incorrect')
            }}
            secondaryLabel={status === 'incorrect' ? 'Try again' : undefined}
            onSecondary={status === 'incorrect' ? () => setStatus('idle') : undefined}
          />
        ) : undefined
      }
    >
      {stage === 0 && (
        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Badge tone="accent">Lesson 1</Badge>
            <Badge tone="neutral">Bundled SVG</Badge>
          </div>
          <p style={{ marginTop: 0 }}>
            Real-world sequences often grow by a changing step rather than a fixed amount. Compare
            adjacent nodes to uncover the rule.
          </p>
          <svg
            viewBox="0 0 420 120"
            role="img"
            aria-label="Sequence 1, 2, 4, 7 leading to ?"
            style={{ width: '100%', maxWidth: 420, display: 'block', margin: '12px 0 18px' }}
          >
            <rect x="2" y="2" width="416" height="116" rx="14" fill="var(--hover)" stroke="var(--border)" />
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
                  fill={index === 4 ? 'var(--accent)' : 'var(--surface)'}
                  stroke="var(--accent)"
                  strokeWidth="2"
                />
                <text
                  x={node.x}
                  y={74}
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="700"
                  fill={index === 4 ? '#ffffff' : 'var(--text)'}
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
              <text key={jump.label} x={jump.x} y={34} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--accent)">
                {jump.label}
              </text>
            ))}
          </svg>
          <Button variant="primary" onClick={() => setStage(1)}>
            Continue to question
          </Button>
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
              options={[
                { id: 'a', label: 'Double every value in the sequence' },
                { id: 'b', label: 'Add the next consecutive step size each time (+1, +2, +3, +4)' },
                { id: 'c', label: 'Repeat the first two numbers forever' },
              ]}
              selected={choice ? [choice] : []}
              onToggle={value => {
                setChoice(value)
                setStatus('idle')
              }}
              evaluation={status}
              correctIds={['b']}
            />
          </Card>
          <WorkedSteps
            steps={[
              { heading: 'Compare adjacent values', body: '1 to 2 adds +1, 2 to 4 adds +2, and 4 to 7 adds +3.' },
              { heading: 'Predict the next jump', body: 'Each jump grows by 1, so the next jump is +4.' },
              { heading: 'Compute the answer', body: '7 + 4 = 11.' },
            ]}
          />
        </div>
      )}

      {stage === 2 && (
        <CompletionCard
          title="Lesson complete"
          subtitle="Progress is reported cleanly to Library via ctx.reportProgress."
          stats={[{ label: 'Lessons', value: '1 / 1' }]}
          primaryLabel="Restart example"
          onPrimary={() => {
            setStage(0)
            setStatus('idle')
          }}
        />
      )}
    </LessonShell>
  )
}

const meta: Meta = {
  title: 'Examples/Starter Course Lesson',
  component: InteractiveLessonExample,
}

export default meta
type Story = StoryObj

export const InteractiveCourse: Story = {}
