import { ReportIcon } from './ReportIcon';
import { ReportTypePicker } from './ReportTypePicker';
import type { useReportDraft } from './useReportDraft';
import type { ReactNode } from 'react';

export function ReportForm({ draft, disabled, children, onClose }: {
  draft: ReturnType<typeof useReportDraft>; disabled: boolean; children: ReactNode; onClose(): void;
}) {
  return <div className="report-content-right">
    <div className="report-card report-main-card">
      <button type="button" className="report-circle-button report-close-button" aria-label="Close report" onClick={onClose}><ReportIcon name="close" /></button>
      <div className="report-main-card-content">
        <div className="report-new-ticket">
          <div className="report-toolbar report-toolbar-hideable">
            <div className="report-toolbar-back-container"><button type="button" className="report-toolbar-button" aria-label="Back" onClick={onClose}><ReportIcon name="back" /></button></div>
            <button type="button" className="report-toolbar-button report-toolbar-close-button" aria-label="Close report" onClick={onClose}><ReportIcon name="close" /></button>
          </div>
          <p className="report-text-h2 report-new-ticket-title" id="report-title">New ticket</p>
          <div className="report-new-ticket-form">
            <ReportTypePicker value={draft.type} onChange={draft.setType} disabled={disabled} />
            <div className="report-textarea-container">
              <label className="report-textarea-label" htmlFor="report-description">Description</label>
              <textarea id="report-description" className="report-textarea" rows={10} maxLength={10000}
                style={{ height: 240 }} value={draft.description} disabled={disabled} aria-required="true"
                onChange={event => draft.setDescription(event.target.value)} />
              <span className="report-textarea-required-icon" title="Required"><ReportIcon name="required" /></span>
            </div>
            {children}
          </div>
          <button type="button" className="report-button-accent report-submit-button" disabled={disabled || !draft.description.trim()}
            onClick={() => void draft.submit()}><p className="report-text-accent-button">{draft.submitting ? 'Saving…' : 'Submit'}</p></button>
          {draft.error && <p className="report-text-p2 report-error" role="alert">{draft.error}</p>}
          {draft.items.length > 0 && <div className="report-text-p3" style={{ padding: '16px 4px' }}>
            Note: the screenshot probably looks different from what you see. Don't worry about it, your feedback is still very helpful to us 🙂
          </div>}
        </div>
      </div>
    </div>
  </div>;
}
