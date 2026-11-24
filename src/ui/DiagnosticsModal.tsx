import { useEffect, useState } from 'react'
import {
  clearLogs,
  exportLogsText,
  getRegisteredSinkCounts,
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

  const sinks = getRegisteredSinkCounts()
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
          <div>
            <h2 id="sx-diag-title">Diagnostics &amp; Event Log</h2>
            <p className="sx-page-subtitle" style={{ marginTop: 4, fontSize: 13 }}>
              Every runtime error, plugin event, and install action is captured here. External sinks
              connected: {sinks.errorSinks} error (Sentry-ready), {sinks.analyticsSinks} analytics
              (PostHog-ready).
            </p>
          </div>
          <button type="button" className="sx-btn sx-btn-sm sx-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="sx-toolbar" style={{ marginBottom: 0 }}>
          <div className="sx-tabs" role="tablist">
            {(['all', 'error', 'warn', 'info'] as const).map(lvl => (
              <button
                key={lvl}
                type="button"
                role="tab"
                aria-selected={filter === lvl}
                className={`sx-tab${filter === lvl ? ' is-active' : ''}`}
                onClick={() => setFilter(lvl)}
              >
                {lvl === 'all' ? `All (${logs.length})` : lvl.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="sx-btn sx-btn-sm" onClick={() => void handleCopy()}>
              {copied ? 'Copied!' : 'Copy bug report'}
            </button>
            <button type="button" className="sx-btn sx-btn-sm sx-btn-ghost" onClick={clearLogs}>
              Clear
            </button>
          </div>
        </div>

        <div className="sx-log-list">
          {visible.length === 0 ? (
            <div className="sx-inline-note">No log entries match this filter yet.</div>
          ) : (
            visible.map(entry => (
              <div
                key={entry.id}
                className={`sx-log-row${entry.level === 'error' ? ' is-error' : entry.level === 'warn' ? ' is-warn' : ''}`}
              >
                <div className="sx-log-meta">
                  <span>{new Date(entry.ts).toISOString().slice(11, 23)}</span>
                  <strong>{entry.level.toUpperCase()}</strong>
                  <span>[{entry.scope}]</span>
                </div>
                <div>{entry.message}</div>
                {entry.detail && (
                  <pre className="sx-code" style={{ marginTop: 6 }}>
                    {entry.detail}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
