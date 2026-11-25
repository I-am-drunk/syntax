import { useEffect, useState } from 'react'
import {
  clearLogs,
  exportLogsText,
  useSyntaxLogs,
  type LogLevel,
} from '../core/logger'

type DiagnosticsModalProps = {
  open: boolean
  onClose: () => void
}

export function DiagnosticsModal({ open, onClose }: DiagnosticsModalProps) {
  const logs = useSyntaxLogs()
  const [filter, setFilter] = useState<'all' | LogLevel>('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const visible = filter === 'all' ? logs : logs.filter(e => e.level === filter)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportLogsText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div
      className="sx-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sx-diag-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sx-modal is-wide">
        <div className="sx-modal-head">
          <h2 id="sx-diag-title">Dev Diagnostics</h2>
          <button type="button" className="sx-icon-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sx-modal-actions">
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'error', 'warn', 'info'] as const).map(lvl => (
              <button
                key={lvl}
                type="button"
                className={filter === lvl ? 'sx-btn-primary' : 'sx-btn-ghost'}
                style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}
                onClick={() => setFilter(lvl)}
              >
                {lvl === 'all' ? `All (${logs.length})` : lvl.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="sx-btn-ghost" onClick={() => void handleCopy()}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="sx-btn-ghost" onClick={clearLogs}>
              Clear
            </button>
          </div>
        </div>

        <div className="sx-diag-list">
          {visible.length === 0 ? (
            <div className="sx-diag-row">No log entries yet.</div>
          ) : (
            visible.map(entry => (
              <div key={entry.id} className="sx-diag-row">
                <div>
                  <strong>{entry.level.toUpperCase()}</strong> [{entry.scope}]{' '}
                  {new Date(entry.ts).toISOString().slice(11, 23)} · {entry.message}
                </div>
                {entry.detail && <pre style={{ margin: '6px 0 0', overflowX: 'auto' }}>{entry.detail}</pre>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
