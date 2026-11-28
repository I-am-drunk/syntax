import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge, Button, Card } from '../SyntaxUI'

function ToolScratchpadExample() {
  const [notes, setNotes] = useState('Slope m = (y2 - y1) / (x2 - x1)\nMidpoint M = ((x1 + x2)/2, (y1 + y2)/2)')
  const [savedLabel, setSavedLabel] = useState('Saved')

  return (
    <div style={{ maxWidth: 640 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Quick Notes Example</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
              Standalone tool screen built with @syntax/ui and autosaved via ctx.saveData.
            </p>
          </div>
          <Badge tone="success">{savedLabel}</Badge>
        </div>
        <textarea
          aria-label="Study notes"
          rows={5}
          value={notes}
          onChange={e => {
            setNotes(e.target.value)
            setSavedLabel('Saved')
          }}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 14,
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button
            variant="secondary"
            onClick={() => {
              setNotes('')
              setSavedLabel('Cleared')
            }}
          >
            Clear notes
          </Button>
        </div>
      </Card>
    </div>
  )
}

const meta: Meta = {
  title: 'Examples/Standalone Tool',
  component: ToolScratchpadExample,
}

export default meta
type Story = StoryObj

export const QuickNotesTool: Story = {}
