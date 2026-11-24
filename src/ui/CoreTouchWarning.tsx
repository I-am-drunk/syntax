type CoreTouchWarningProps = {
  reason?: string
  variant?: 'badge' | 'banner'
}

function WarningTriangleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

/**
 * Unmistakable core-touch UI warning displaying the exact required text:
 * "This plugin touches core."
 */
export function CoreTouchWarning({ reason, variant = 'badge' }: CoreTouchWarningProps) {
  if (variant === 'badge') {
    return (
      <span className="sx-core-touch-badge" title={reason || 'This plugin touches core.'}>
        <WarningTriangleIcon />
        <span>This plugin touches core.</span>
      </span>
    )
  }

  return (
    <div className="sx-core-touch-banner" role="note">
      <span className="sx-core-touch-banner-icon">
        <WarningTriangleIcon />
      </span>
      <div>
        <strong>This plugin touches core.</strong>
        {reason ? (
          <p>{reason}</p>
        ) : (
          <p>
            This plugin integrates directly into core Syntax surfaces instead of running only inside
            an isolated course frame.
          </p>
        )}
      </div>
    </div>
  )
}
