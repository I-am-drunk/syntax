import { useEffect, useRef, useState } from 'react';
import type { ReportType } from '../services/reports';
import { ReportIcon } from './ReportIcon';
const options: [ReportType, string, string][] = [
  ['Bug', 'Bug report', 'bug'], ['Question', 'Question', 'question'], ['Suggestion', 'Improvement suggestion', 'suggestion'],
];
export function ReportTypePicker({ value, disabled, onChange }: {
  value: ReportType; disabled: boolean; onChange(value: ReportType): void;
}) {
  const [open, setOpen] = useState<'dropdown' | 'sheet'>(), root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!event.composedPath().includes(root.current!)) setOpen(undefined); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} onKeyDown={event => {
    if (open && event.key === 'Escape') { event.stopPropagation(); setOpen(undefined); }
  }}>
    <button type="button" className={`report-select-dropdown${open ? ' active' : ''}`}
      aria-label="Ticket type" aria-haspopup="listbox" aria-expanded={!!open} disabled={disabled}
      onClick={() => setOpen(open ? undefined : innerWidth > 1024 ? 'dropdown' : 'sheet')}>
      <span className="report-select-dropdown-label">Ticket type</span>
      <span className="report-select-dropdown-chosen">{options.find(option => option[0] === value)![1]}</span>
      <span className="report-dropdown-icon"><ReportIcon name="chevron" /></span>
    </button>
    {open === 'dropdown' && <div className="report-select-options" role="listbox" aria-label="Ticket type" style={{ display: 'block' }}>
      {options.map(([type, label]) => <button key={type} type="button" className="report-picker-option"
        role="option" aria-selected={type === value} disabled={disabled} onClick={() => { onChange(type); setOpen(undefined); }}>
        <span className="report-picker-option-text">{label}</span>
      </button>)}
    </div>}
    {open === 'sheet' && <div className="report-sheet-background" onClick={event => {
      if (event.target === event.currentTarget) setOpen(undefined);
    }}>
      <div className="report-sheet" id="report-sheet" role="listbox" aria-label="Ticket type">
        <p className="report-text-p1">Ticket type</p>
        <div className="report-sheet-list">
          {options.map(([type, label, icon]) => <button key={type} type="button" className="report-sheet-item"
            role="option" aria-selected={type === value} disabled={disabled} onClick={() => { onChange(type); setOpen(undefined); }}>
            <ReportIcon name={icon} /><span className="report-text-p1 report-sheet-item-text">{label}</span>
          </button>)}
        </div>
      </div>
    </div>}
  </div>;
}
