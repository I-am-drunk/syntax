import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  Segmented,
  Sema,
  Toggle,
} from '../SyntaxUI'

function ControlsShowcase() {
  const [mode, setMode] = useState<'explore' | 'practice' | 'review'>('explore')
  const [hints, setHints] = useState(true)

  return (
    <div style={{ maxWidth: 680, display: 'grid', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Complete</Badge>
          <Badge tone="warning">Caution</Badge>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete Data</Button>
        </div>
        <ProgressBar value={65} max={100} label="Course completion progress" showCount />
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Segmented
            label="Study mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'explore', label: 'Explore' },
              { value: 'practice', label: 'Practice' },
              { value: 'review', label: 'Review' },
            ]}
          />
          <Toggle
            checked={hints}
            onChange={setHints}
            label="Show worked hints"
          />
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Sema state="idle" size={44} />
          <Sema state="guiding" size={44} />
          <Sema state="celebrate" size={44} />
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>
            Shared host Sema companion expressions exposed via @syntax/ui
          </span>
        </div>
      </Card>
    </div>
  )
}

const meta: Meta = {
  title: 'Syntax UI/Controls',
  component: ControlsShowcase,
}

export default meta
type Story = StoryObj

export const AllControls: Story = {}
