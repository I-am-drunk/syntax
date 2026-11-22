import { useEffect, useRef, useState } from 'react';
import type { Attachment } from './reportMedia';
import { ReportIcon } from './ReportIcon';
export type AddAttachmentAction = 'screenshot' | 'record' | 'browse';
export function ReportAttachments({ items, selected, small, disabled, onSelect, onRemove, onAdd }: {
  items: Attachment[]; selected?: string; small?: boolean; disabled: boolean;
  onSelect(item: Attachment): void; onRemove(item: Attachment): void; onAdd(action: AddAttachmentAction): void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number }>();
  const root = useRef<HTMLDivElement>(null);
  const canRecord = !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && typeof window.ontouchstart === 'undefined';
  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => { if (!event.composedPath().includes(root.current!)) setMenu(undefined); };
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  return <div className={small ? 'report-attachments-items-small' : 'report-attachments-items'} ref={root}>
    {items.map(item => {
      const type = item.original.type.split('/')[0], label = type === 'image' ? 'Image' : type === 'video' ? 'Video' : item.name;
      const thumbnail = `report-attachment-item-thumbnail${small ? '-small' : ''}`;
      return <div key={item.id} className={small ? 'report-attachment-item-small' :
        `report-attachment-item${selected === item.id ? ' report-attachment-item-selected' : ''}`}>
        <div className={small ? undefined : 'report-card report-attachment-item-card'} style={small ? { width: '100%', height: '100%' } : undefined} role="button" tabIndex={disabled ? -1 : 0}
          aria-label={`Edit ${label}`} onClick={() => { if (!disabled) onSelect(item); }}
          onKeyDown={event => { if (!disabled && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(item); } }}>
          {type === 'image' ? <img className={thumbnail} src={item.previewUrl ?? item.url} alt="" /> : type === 'video'
            ? <video className={thumbnail} src={item.url} muted />
            : <div className={`${thumbnail} report-file-thumbnail${small ? '-small' : ''}`}>{item.name}</div>}
          <button type="button" className={`report-circle-button ${small ? 'report-attachment-item-remove-small' : 'report-attachment-remove'}`}
            aria-label={`Remove ${label}`} disabled={disabled} onClick={event => { event.stopPropagation(); onRemove(item); }}><ReportIcon name="remove" /></button>
        </div>
        {!small && <div className="report-attachment-item-title"><div className="report-attachment-title-box"><p className="report-text-p3">{label}</p></div></div>}
      </div>;
    })}
    <div className={`report-attachments-add-item${small ? '-small' : ''}`}>
      <button type="button" className={`report-circle-button report-attachment-add-button${small ? '-small' : ''}`}
        aria-label="Add attachment" aria-expanded={!!menu} disabled={disabled || items.length >= 10}
        onClick={event => { const r = event.currentTarget.getBoundingClientRect();
          setMenu(menu ? undefined : { x: Math.min(r.x, innerWidth - 270), y: Math.max(10, r.y - (canRecord ? 130 : 92)) }); }}>
        <ReportIcon name="add" />
      </button>
      {menu && <div className="report-context-menu" style={{ display: 'block', left: menu.x, top: menu.y }}>
        {(['screenshot', ...(canRecord ? ['record'] : []), 'browse'] as AddAttachmentAction[]).map(action =>
          <button type="button" key={action} className="report-context-menu-item" onClick={() => { setMenu(undefined); onAdd(action); }}>
            <ReportIcon name={action} /><p className="report-text-p2">{{ screenshot: 'Grab screenshot', record: 'Record screen', browse: 'Choose from computer' }[action]}</p>
          </button>)}
      </div>}
    </div>
  </div>;
}
