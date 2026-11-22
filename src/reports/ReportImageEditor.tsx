import { forwardRef, Fragment, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createReportCanvas, drawingColors } from './reportCanvas';
import type { DrawingMode } from './reportCanvas';
import type { Attachment } from './reportMedia';
import { ReportIcon } from './ReportIcon';
type Controller = Awaited<ReturnType<typeof createReportCanvas>>;
export type ReportEditorHandle = { flush(): Promise<void> };
const modes: DrawingMode[] = ['select', 'blur', 'pencil', 'ellipse', 'rect'];
function savedSettings() {
  try {
    const value = JSON.parse(localStorage.getItem('syntax.report.drawing') ?? 'null');
    if (value && modes.includes(value.mode) && drawingColors.includes(value.color)) return value as { mode: DrawingMode; color: string };
  } catch { /* Drawing preferences are optional. */ }
  return { mode: 'pencil' as DrawingMode, color: drawingColors[0] };
}
export const ReportImageEditor = forwardRef<ReportEditorHandle, {
  attachment: Attachment; disabled: boolean; onUpdate(blob: Blob, json: object): void; onError(error: unknown): void;
}>(function ReportImageEditor({ attachment, disabled, onUpdate, onError }, ref) {
  const [settings, setSettings] = useState(savedSettings), [palette, setPalette] = useState(false);
  const [ready, setReady] = useState(false), [tooltip, setTooltip] = useState<{ label: string; x: number; y: number }>();
  const holder = useRef<HTMLDivElement>(null), element = useRef<HTMLCanvasElement>(null);
  const controller = useRef<Controller>(), pending = useRef<Promise<Controller | undefined>>();
  const callbacks = useRef({ onUpdate, onError }); callbacks.current = { onUpdate, onError };
  const enabled = useRef(!disabled); enabled.current = !disabled;
  const remember = (next: typeof settings) => {
    setSettings(next);
    try { localStorage.setItem('syntax.report.drawing', JSON.stringify(next)); } catch { /* Optional. */ }
  };
  const currentSettings = useRef(settings); currentSettings.current = settings;
  useImperativeHandle(ref, () => ({ flush: async () => {
    const value = await pending.current;
    if (!value) throw new Error('The image editor is not ready.');
    await value.flush();
  } }), []);
  useLayoutEffect(() => {
    const abort = new AbortController(); setReady(false);
    pending.current = createReportCanvas(element.current!, holder.current!, attachment.url,
      { ...currentSettings.current, json: attachment.json },
      (blob, json) => callbacks.current.onUpdate(blob, json),
      mode => remember({ ...currentSettings.current, mode }),
      error => { if (!abort.signal.aborted) callbacks.current.onError(error); }, abort.signal)
      .then(value => { controller.current = value; value.setEnabled(enabled.current); setReady(true); return value; })
      .catch(error => { if (!abort.signal.aborted) callbacks.current.onError(error); return undefined; });
    return () => { abort.abort(); controller.current = undefined; };
  }, [attachment.id]);
  useLayoutEffect(() => { controller.current?.setEnabled(!disabled); }, [disabled]);
  const chooseMode = (mode: DrawingMode) => { controller.current?.setMode(mode); remember({ ...settings, mode }); };
  const tools = [
    ['clear', 'Clear'], ['select', 'Select'], ['blur', 'Blur'], ['pencil', 'Pen'],
    ['ellipse', 'Circle'], ['rect', 'Rectangle'], ['palette', 'Choose color'],
  ];
  return <div className="report-image-preview" aria-busy={!ready}>
    <div className="report-image-preview-image-container" ref={holder} tabIndex={0}
      aria-label="Attachment drawing canvas" style={{ pointerEvents: disabled || !ready ? 'none' : undefined }}
      onPointerDown={() => holder.current?.focus({ preventScroll: true })}>
      <canvas ref={element} />
      {!ready && <p className="report-text-p2" role="status">Loading image…</p>}
    </div>
    <div className="report-image-preview-toolbox-container">
      <div className="report-drawing-toolbox">
        <div className="report-drawing-toolbox-buttons" hidden={palette}>
          {tools.map(([mode, label], index) => <Fragment key={mode}>
            {[2, 3, 6].includes(index) && <div className="report-divider-vertical report-drawing-toolbox-divider" />}
            <button type="button" className="report-attachments-drawing-button" aria-label={label}
              aria-pressed={modes.includes(mode as DrawingMode) ? settings.mode === mode : undefined}
              disabled={disabled || !ready} style={{ color: settings.mode === mode ? settings.color : '#636366' }}
              onMouseEnter={event => { const r = event.currentTarget.getBoundingClientRect(); setTooltip({ label, x: r.x + r.width / 2, y: r.bottom + 14 }); }}
              onMouseLeave={() => setTooltip(undefined)} onClick={() => {
                setTooltip(undefined);
                if (mode === 'clear') void controller.current?.clear().catch(onError);
                else if (mode === 'palette') setPalette(true);
                else chooseMode(mode as DrawingMode);
              }}><ReportIcon name={mode === 'pencil' ? 'pen' : mode === 'rect' ? 'rectangle' : mode} /></button>
          </Fragment>)}
        </div>
        <div className="report-drawing-toolbox-colors" style={{ display: palette ? 'flex' : 'none' }}>
          <div className="report-palette">
            {drawingColors.map((color, index) => <button key={color} type="button" className="report-color-button"
              aria-label={['Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Grey'][index]} aria-pressed={settings.color === color}
              style={{ background: settings.color === color ? 'transparent' : color, border: settings.color === color ? `2px solid ${color}` : 'none' }}
              disabled={disabled} onClick={() => { controller.current?.setColor(color); remember({ ...settings, color }); }} />)}
            <button type="button" className="report-palette-close" aria-label="Close color palette" onClick={() => setPalette(false)}><ReportIcon name="palette-close" /></button>
          </div>
        </div>
      </div>
      {tooltip && <div className="report-tooltip-dark" style={{ display: 'block', left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}>
        <p className="report-text-tooltip report-tooltip-text-dark">{tooltip.label}</p>
      </div>}
    </div>
  </div>;
});
