import { useEffect, useRef, useState } from 'react';
import type { ReportContext } from '../services/reports';
import { ReportShadow } from './ReportShadow';
import { ReportForm } from './ReportForm';
import { ReportAttachments } from './ReportAttachments';
import type { AddAttachmentAction } from './ReportAttachments';
import { ReportImageEditor } from './ReportImageEditor';
import { ReportIcon } from './ReportIcon';
import { ReportCaptureBubble } from './ReportCaptureBubble';
import { captureReportScreenshot } from './reportMedia';
import type { Attachment } from './reportMedia';
import { startReportRecording } from './reportRecording';
import { useReportDraft } from './useReportDraft';

export default function ReportDialog({ context, onClose }: { context: ReportContext; onClose(): void }) {
  const [saved, setSaved] = useState(false), [small, setSmall] = useState(innerWidth <= 1024);
  const [full, setFull] = useState(false), [capturing, setCapturing] = useState(false);
  const [captureArmed, setCaptureArmed] = useState(false);
  const [recording, setRecording] = useState(false), [recordPending, setRecordPending] = useState(false);
  const draft = useReportDraft(context, () => setSaved(true));
  const fileInput = useRef<HTMLInputElement>(null), captureId = useRef(0);
  const recordingAbort = useRef<AbortController>(), stopRecording = useRef<(cancel?: boolean) => void>();
  const active = draft.items.find(item => item.id === draft.selected);
  const disabled = draft.submitting || draft.adding || capturing || captureArmed || recordPending || recording;
  useEffect(() => {
    const media = matchMedia('(max-width: 1024px)'); let active = true;
    const resize = async () => {
      try {
        if (media.matches) await draft.editor.current?.flush();
        if (active) setSmall(media.matches);
      } catch (error) { if (active) draft.fail(error); }
    };
    media.addEventListener('change', resize);
    return () => { active = false; media.removeEventListener('change', resize); captureId.current++; recordingAbort.current?.abort(); };
  }, []);
  const screenshot = async () => {
    const id = ++captureId.current; setCapturing(true); draft.setError('');
    try { const blob = await captureReportScreenshot(); if (id === captureId.current) await draft.add(blob, 'Screenshot.png', () => id === captureId.current); }
    catch (error) { if (id === captureId.current) draft.fail(error); }
    finally { if (id === captureId.current) setCapturing(false); }
  };
  useEffect(() => { void screenshot(); }, []);
  useEffect(() => {
    if (!captureArmed && !recording) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation();
      setCaptureArmed(false); if (recording) stopRecording.current?.(true);
    };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, [captureArmed, recording]);
  const addAction = (action: AddAttachmentAction) => {
    if (disabled) return;
    if (action === 'browse') { fileInput.current?.click(); return; }
    if (action === 'screenshot') { setCaptureArmed(true); return; }
    const abort = recordingAbort.current = new AbortController();
    setRecordPending(true); draft.setError('');
    void startReportRecording(abort.signal, () => { setRecordPending(false); setRecording(true); }, blob => {
      setRecording(false); setRecordPending(false); stopRecording.current = undefined;
      if (blob) void draft.add(blob, blob.type.includes('mp4') ? 'Recording.mp4' : 'Recording.webm').catch(draft.fail);
    }, error => { if (!abort.signal.aborted) { setRecording(false); setRecordPending(false); draft.fail(error); } })
      .then(stop => { if (!abort.signal.aborted) stopRecording.current = stop; })
      .catch(error => { if (!abort.signal.aborted) { setRecordPending(false); draft.fail(error); } });
  };
  const selectAttachment = async (item: Attachment) => {
    try { await draft.editor.current?.flush(); draft.setSelected(item.id); if (matchMedia('(max-width: 1024px)').matches) setFull(true); }
    catch (error) { draft.fail(error); }
  };
  const closePreview = async () => {
    try { await draft.editor.current?.flush(); setFull(false); } catch (error) { draft.fail(error); }
  };
  useEffect(() => {
    if (saved || recording || captureArmed) return;
    const app = document.getElementById('root'), previous = app?.inert;
    if (app) app.inert = true;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); if (full) void closePreview(); else onClose();
    };
    document.addEventListener('keydown', escape);
    return () => { if (app) app.inert = previous ?? false; document.removeEventListener('keydown', escape); };
  }, [saved, recording, captureArmed, full, onClose]);
  const list = (compact = false) => <ReportAttachments items={draft.items} selected={draft.selected}
    small={compact} disabled={disabled} onSelect={item => void selectAttachment(item)}
    onRemove={draft.remove} onAdd={addAction} />;
  const preview = active?.original.type.startsWith('image/') ?
    <ReportImageEditor key={active.id} ref={draft.editor} attachment={active} disabled={disabled}
      onUpdate={(blob, json) => draft.updateImage(active.id, blob, json)} onError={draft.fail} />
    : active?.original.type.startsWith('video/') ? <div className="report-video-preview"><video src={active.url} controls loop /></div>
      : <div className="report-attachments-empty"><p className="report-text-p2">{active?.name ?? 'Add an attachment'}</p></div>;
  const addFile = (file?: File) => {
    if (!file || disabled) return;
    void draft.add(file, file.name).catch(draft.fail);
  };
  return <ReportShadow>
    <div className="report-modal" onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Escape') return;
      if (recording) stopRecording.current?.(true);
      else if (full) void closePreview();
      else onClose();
    }}>
      {saved ? <div className="toast-notification" role="status">
        <p className="title-container">Report saved locally.</p>
        <button type="button" className="report-toolbar-button" aria-label="Close notification" onClick={onClose}><ReportIcon name="close" /></button>
      </div> : <>
        <input ref={fileInput} type="file" hidden onChange={event => {
          addFile(event.target.files?.[0]); event.target.value = '';
        }} />
        <div id="report-overlay" className="report-show-overlay-color" hidden={recording || capturing || captureArmed}
          role="dialog" aria-modal="true" aria-labelledby="report-title"
          onClick={event => { if (event.target === event.currentTarget) onClose(); }}
          onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFile(event.dataTransfer.files[0]); }}>
          <div id="report-content">
            <div className="report-content-left">
              <div id="report-attachments-card" className="report-card report-attachments-card-visible">
                <div className="report-attachments-page">
                  <div className="report-attachments-list-wrap">{list()}</div>
                  <div className="report-attachments-preview-wrap"><div className="report-attachments-preview">{!small && !full && preview}</div></div>
                </div>
              </div>
            </div>
            <ReportForm draft={draft} disabled={disabled} onClose={onClose}>{list(true)}</ReportForm>
          </div>
        </div>
        {full && !recording && !capturing && !captureArmed && <div className="report-image-preview-root-fs" role="dialog" aria-modal="true" aria-label="Attachment editor">
          <div className="report-image-preview-toolbar-fs">
            <button type="button" className="report-toolbar-button" aria-label="Close attachment editor" onClick={() => void closePreview()}><ReportIcon name="close" /></button>
          </div>
          <div className="report-image-preview-content-fs">{preview}</div>
        </div>}
        {capturing && <div className="report-loader-screen" role="status">
          <p className="report-text-p1">Capturing screenshot…</p>
          <button type="button" className="report-button" onClick={() => { captureId.current++; setCapturing(false); }}>Cancel</button>
        </div>}
        {recording && <ReportCaptureBubble recording onActivate={() => stopRecording.current?.()} />}
        {captureArmed && <ReportCaptureBubble onActivate={() => { setCaptureArmed(false); void screenshot(); }} />}
      </>}
    </div>
  </ReportShadow>;
}
