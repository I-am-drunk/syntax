import type { ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { exportLogsText, syntaxLog } from './logger'

type SyntaxErrorBoundaryProps = {
  scope: string
  pluginName?: string
  onDisablePlugin?: () => void
  resetKeys?: unknown[]
  children: ReactNode
}

function SyntaxCrashFallback({
  error,
  resetErrorBoundary,
  scope,
  pluginName,
  onDisablePlugin,
}: FallbackProps & {
  scope: string
  pluginName?: string
  onDisablePlugin?: () => void
}) {
  const message = error instanceof Error ? error.message : String(error)

  async function handleCopyLog() {
    try {
      await navigator.clipboard.writeText(exportLogsText())
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="sx-error-card" role="alert">
      <div className="sx-error-badge">Recovered from crash</div>
      <h3>{pluginName ? `${pluginName} ran into a problem` : 'Something went wrong in this view'}</h3>
      <p className="sx-error-summary">
        Syntax isolated this error inside <code>{scope}</code> so your work stays safe.
      </p>
      <pre className="sx-error-message">{message}</pre>
      <div className="sx-error-actions">
        <button type="button" className="sx-btn sx-btn-primary" onClick={resetErrorBoundary}>
          Try again
        </button>
        {onDisablePlugin && (
          <button
            type="button"
            className="sx-btn sx-btn-danger"
            onClick={() => {
              onDisablePlugin()
              resetErrorBoundary()
            }}
          >
            Turn off {pluginName ?? 'plugin'}
          </button>
        )}
        <button type="button" className="sx-btn sx-btn-ghost" onClick={handleCopyLog}>
          Copy error log
        </button>
      </div>
    </div>
  )
}

export function SyntaxErrorBoundary({
  scope,
  pluginName,
  onDisablePlugin,
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
        />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
