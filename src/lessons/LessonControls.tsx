import { assetUrl } from '../mpm2d/assetUrl';
import { LessonXp } from './LessonXp';
import { MobileCheckReport } from './LessonReport';

export function ResetIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path fill="currentColor" d="M2 0H0V6H6V4H3.52759C4.62698 2.77158 6.22386 2 8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8H0C0 12.4183 3.58172 16 8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C5.60964 0 3.46514 1.04855 2 2.70857V0Z" />
  </svg>;
}

export function Arrow({ right = false }: { right?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
    style={{ transform: `rotate(${right ? 90 : -90}deg)` }}>
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd"
      d="M1.89614 8.94751L0.474304 7.52568L8 -1.55877e-05L15.5257 7.52568L14.1039 8.94751L9.00541 3.84905L9.00541 16L6.99464 16L6.99463 3.84902L1.89614 8.94751Z" />
  </svg>;
}

export function LessonNavigation({ page, total, furthest, xp, closeHref, onNavigate, checkIndex, checkEvaluations }: {
  page: number; total: number; furthest: number; xp: number; closeHref: string;
  onNavigate(offset: number): void;
  checkIndex?: number; checkEvaluations?: readonly ('unsubmitted' | 'incorrect-retry' | 'incorrect' | 'correct')[];
}) {
  return <header className="lesson-navigation">
    <a className="lesson-close" href={closeHref} aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor"
        d="M8.00006 6.58577L3.05027 1.63599L1.63606 3.0502L6.58585 7.99999L1.63605 12.9498L3.05026 14.364L8.00006 9.4142L12.9498 14.3639L14.364 12.9497L9.41427 7.99999L14.364 3.05029L12.9498 1.63608L8.00006 6.58577Z" />
      </svg>
    </a>
    <nav className="lesson-progress-navigation" aria-label={checkIndex === undefined ? 'Lesson pages' : 'Lesson checks'}>
      {checkIndex === undefined && <>
      <button className="lesson-page-arrow" type="button" aria-label="Previous page" disabled={page === 0}
        onClick={() => onNavigate(-1)}><Arrow /></button>
      <div className="lesson-progress-track" role="progressbar" aria-label="Lesson progress"
        aria-valuemin={0} aria-valuemax={total - 1} aria-valuenow={page}>
        <div style={{ width: `${page / (total - 1) * 100}%` }} />
      </div>
      </>}
      <div className="lesson-check-progress" aria-label={checkIndex === undefined ? undefined : `Check ${checkIndex + 1} of ${checkEvaluations?.length ?? 3}`}>
        {(checkEvaluations ?? ['unsubmitted', 'unsubmitted', 'unsubmitted']).map((evaluation, index) => <i key={index}
          data-current={checkIndex === index} data-evaluation={evaluation} />)}
      </div>
      {checkIndex === undefined &&
      <button className="lesson-page-arrow" type="button" aria-label="Next page" disabled={page >= furthest}
        onClick={() => onNavigate(1)}><Arrow right /></button>}
    </nav>
    <LessonXp value={xp} />
  </header>;
}

export function LessonFooter({ evaluation, isProblem, isLast, isCheck = false, canCheck, onCheck, onRetry, onContinue, onReport, onExplain, explanationSeen = false, allowWhyOnRetry = false }: {
  evaluation: 'unsubmitted' | 'incorrect-retry' | 'incorrect' | 'correct';
  isProblem: boolean; isLast: boolean; canCheck: boolean;
  isCheck?: boolean;
  onCheck(): void; onRetry(): void; onContinue(): void;
  onReport?(): void;
  onExplain?(): void; explanationSeen?: boolean;
  allowWhyOnRetry?: boolean;
}) {
  const feedback = isProblem && evaluation !== 'unsubmitted';
  const retry = feedback && evaluation === 'incorrect-retry';
  const emphasizeWhy = !!onExplain && evaluation === 'incorrect' && !explanationSeen;
  const label = retry ? 'Try again' : isProblem && !feedback ? 'Check' : isLast ? 'Finish' : 'Continue';
  return <footer className="lesson-footer" data-feedback={feedback || undefined}
    data-evaluation={evaluation} data-initial-check={isProblem && !feedback || undefined}>
    <span className="visually-hidden" role="status">{feedback ? evaluation === 'correct' ? 'Correct!' : isCheck ? 'Incorrect' : 'That’s incorrect.' : ''}</span>
    {isCheck && feedback && <div className="lesson-check-feedback">
      <img src={assetUrl(`/assets/lesson/check-${evaluation === 'correct' ? 'correct' : 'incorrect'}.svg`)} width="32" height="32" alt="" />
      <span aria-hidden="true">{evaluation === 'correct' ? 'Correct!' : 'Incorrect'}</span>
      {onReport && <MobileCheckReport onReport={onReport} />}
    </div>}
    <div className="lesson-footer-buttons">
      {feedback && onExplain && (!retry || allowWhyOnRetry) && <button type="button"
        className={`lesson-action lesson-action-secondary lesson-why${emphasizeWhy ? '' : ' explanation-secondary-action'}`}
        onClick={onExplain}><span>Why?</span></button>}
      {feedback && !isCheck && !onExplain && <button type="button" className="lesson-action lesson-action-secondary" disabled
        title="Tutor help is not available in this preview."><span>{retry ? 'Get help' : 'Why?'}</span></button>}
      <button type="button" className={`lesson-action${emphasizeWhy ? ' explanation-secondary-action' : ''}`} disabled={isProblem && !feedback && !canCheck}
        onClick={retry ? onRetry : isProblem && !feedback ? onCheck : onContinue}>
        <span><span className="lesson-action-content">{label}</span></span></button>
    </div>
  </footer>;
}
