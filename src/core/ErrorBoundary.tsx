import { useState, type ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { AlertTriangle, Check, Copy, RotateCcw } from 'lucide-react'
import { exportLogsText, syntaxLog } from './logger'

type SyntaxErrorBoundaryProps = {
  scope: string
  pluginName?: string
  onDisablePlugin?: () => void
  onExitScope?: () => void
  exitLabel?: string
  resetKeys?: unknown[]
  children: ReactNode
}

function SyntaxCrashFallback({
  error,
  resetErrorBoundary,
  scope,
  pluginName,
  onDisablePlugin,
  onExitScope,
  exitLabel,
}: FallbackProps & {
  scope: string
  pluginName?: string
  onDisablePlugin?: () => void
  onExitScope?: () => void
  exitLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  async function handleCopyLog() {
    try {
      const report = [
        `Scope: ${scope}`,
        pluginName ? `Plugin/Course: ${pluginName}` : null,
        `Error: ${message}`,
        stack ? `\nStack:\n${stack}` : null,
        `\nRecent logs:\n${exportLogsText()}`,
      ]
        .filter(Boolean)
        .join('\n')
      await navigator.clipboard.writeText(report)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="sx-error-card" role="alert">
      <div className="sx-error-badge">
        <AlertTriangle size={14} aria-hidden="true" />
        <span>Isolated error in {scope}</span>
      </div>
      <h3>
        {pluginName ? `${pluginName} ran into a bug` : 'Something broke inside this view'}
      </h3>
      <p className="sx-error-summary">
        Syntax caught this error inside its separation layer so the rest of the app stays intact.
      </p>
      <pre className="sx-error-message">{message}</pre>
      {stack && (
        <details className="sx-disclosure">
          <summary>Stack trace</summary>
          <div className="sx-disclosure-body">
            <pre>{stack}</pre>
          </div>
        </details>
      )}
      <div className="sx-error-actions">
        <button type="button" className="sx-btn-primary" onClick={resetErrorBoundary}>
          <RotateCcw size={15} aria-hidden="true" />
          <span>Try again</span>
        </button>
        {onDisablePlugin && (
          <button
            type="button"
            className="sx-btn-danger-ghost"
            onClick={() => {
              onDisablePlugin()
              resetErrorBoundary()
            }}
          >
            Turn off {pluginName ?? 'plugin'}
          </button>
        )}
        {onExitScope && (
          <button
            type="button"
            className="sx-btn-ghost"
            onClick={() => {
              onExitScope()
              resetErrorBoundary()
            }}
          >
            {exitLabel ?? 'Back to Library'}
          </button>
        )}
        <button type="button" className="sx-btn-ghost" onClick={() => void handleCopyLog()}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy details'}</span>
        </button>
      </div>
    </div>
  )
}

export function SyntaxErrorBoundary({
  scope,
  pluginName,
  onDisablePlugin,
  onExitScope,
  exitLabel,
  resetKeys,
  children,
}: SyntaxErrorBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onError={(error, info) => {
        syntaxLog.error(scope, error instanceof Error ? error.message : String(error), {
          error: error instanceof Error ? error.stack : String(error),
          componentStack: info.componentStack,
        })
      }}
      fallbackRender={props => (
        <SyntaxCrashFallback
          {...props}
          scope={scope}
          pluginName={pluginName}
          onDisablePlugin={onDisablePlugin}
          onExitScope={onExitScope}
          exitLabel={exitLabel}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
