import { useRef, useState } from 'react';
import { ReportIcon } from './ReportIcon';
export function ReportCaptureBubble({ recording, onActivate }: { recording?: boolean; onActivate(): void }) {
  const [position, setPosition] = useState({ x: innerWidth - 100, y: innerHeight - 100 });
  const drag = useRef<{ x: number; y: number; moved: boolean }>();
  return <button type="button" className="report-capture-bubble" aria-label={recording ? 'Stop recording' : 'Capture screenshot'}
    style={{ left: position.x, top: position.y, background: recording ? 'red' : 'white', boxShadow: `0 2px 2px ${recording ? '#d90000' : '#d3d3d3'}` }}
    onPointerDown={event => {
      const r = event.currentTarget.getBoundingClientRect();
      drag.current = { x: event.clientX - r.x, y: event.clientY - r.y, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (!drag.current) return;
      drag.current.moved ||= Math.abs(event.movementX) > 2 || Math.abs(event.movementY) > 2;
      setPosition({ x: Math.min(Math.max(0, event.clientX - drag.current.x), innerWidth - 50),
        y: Math.min(Math.max(0, event.clientY - drag.current.y), innerHeight - 50) });
    }} onPointerUp={() => { const activate = drag.current && !drag.current.moved; drag.current = undefined; if (activate) onActivate(); }}
    onPointerCancel={() => { drag.current = undefined; }} onClick={event => { if (event.detail === 0) onActivate(); }}>
    <ReportIcon name={recording ? 'stop-bubble' : 'capture-bubble'} />
  </button>;
}
