export function LessonReport({ onReport }: { onReport(): void }) {
  return <div className="lesson-report-toolbar">
    <button className="lesson-report-control" type="button" aria-label="report a problem" onClick={onReport}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M19.3574 15.1815C21.406 14.714 23.5632 15.1601 25.2373 16.3973C26.6313 17.4277 28.4458 17.7598 30.1309 17.2928C30.7151 17.1308 31.293 17.5702 31.293 18.1765V25.9229C31.293 26.2535 31.0725 26.5434 30.7539 26.6317L30.5391 26.6903C28.4032 27.2822 26.1039 26.8624 24.3369 25.5565C23.0161 24.5803 21.3136 24.2277 19.6973 24.5965C19.4836 24.6451 19.332 24.835 19.332 25.0541V32.4393C19.332 32.881 18.9739 33.2391 18.5322 33.2391C18.0905 33.2391 17.7324 32.881 17.7324 32.4393V26.0459C17.7324 26.0454 17.7319 26.0451 17.7314 26.0453C17.731 26.0455 17.7305 26.0452 17.7305 26.0447V16.1404C17.7305 15.7966 17.9685 15.4987 18.3037 15.4227L19.3574 15.1815Z" />
      </svg>
    </button>
  </div>;
}
export function MobileCheckReport({ onReport }: { onReport(): void }) {
  return <button type="button" className="lesson-check-report" aria-label="Report problem" onClick={onReport}>
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ overflow: 'hidden' }}>
      <path fill="currentColor" d="M1 17V0H10L10.4 2H16V12H9L8.6 10H3V17H1ZM10.65 10H14V4H8.75L8.35 2H3V8H10.25L10.65 10Z" />
    </svg>
  </button>;
}
