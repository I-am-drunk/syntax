export function CoreTouchIcon({ className }: { className?: string }) {
  return (
    <span
      className={`sx-core-icon${className ? ` ${className}` : ''}`}
      title="This plugin touches core."
      aria-label="This plugin touches core."
      role="img"
    >
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
    </span>
  )
}

export function CoreTouchWarning({ reason }: { reason?: string }) {
  return (
    <div className="sx-core-notice" role="note">
      <CoreTouchIcon className="is-notice" />
      <div className="sx-core-notice-body">
        <strong>This plugin touches core.</strong>
        {reason ? <span>{reason}</span> : null}
      </div>
    </div>
  )
}
