import { useEffect, useRef, useState } from 'react';
import { submitReport } from '../services/reports';
import type { ReportContext, ReportPayload, ReportType } from '../services/reports';
import { attachmentFrom, encodeAttachment, releaseAttachment } from './reportMedia';
import type { Attachment } from './reportMedia';
import type { ReportEditorHandle } from './ReportImageEditor';

export function useReportDraft(context: ReportContext, onSaved: () => void) {
  const [type, setType] = useState<ReportType>('Bug'), [description, setDescription] = useState('');
  const [items, setItems] = useState<Attachment[]>([]), [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false), [selected, setSelected] = useState<string>();
  const [adding, setAdding] = useState(false), additions = useRef(0);
  const attachments = useRef(items), pending = useRef(false), alive = useRef(true);
  const attempt = useRef<{ signature: string; payload: ReportPayload }>();
  const request = useRef<AbortController>();
  const editor = useRef<ReportEditorHandle>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); attachments.current.forEach(releaseAttachment); };
  }, []);
  const changeItems = (next: Attachment[]) => { attachments.current = next; setItems(next); };
  const fail = (error: unknown) => { if (alive.current) setError(error instanceof Error ? error.message : 'This action could not be completed. Your draft is still here.'); };
  const add = async (blob: Blob, name: string, isCurrent = () => true) => {
    if (!alive.current) return;
    if (pending.current) throw new Error('Wait for the current report to finish saving.');
    additions.current++; setAdding(true);
    try {
      await editor.current?.flush();
      if (!alive.current || !isCurrent()) return;
      if (attachments.current.length >= 10) throw new Error('You can add up to 10 attachments.');
      const item = attachmentFrom(blob, name); changeItems([...attachments.current, item]); setSelected(item.id);
    } finally {
      additions.current--;
      if (alive.current) setAdding(additions.current > 0);
    }
  };
  const remove = (item: Attachment) => {
    changeItems(attachments.current.filter(other => other.id !== item.id)); releaseAttachment(item);
    if (selected === item.id) setSelected(attachments.current[0]?.id);
  };
  const updateImage = (id: string, blob: Blob, json: object) => {
    if (!alive.current || !attachments.current.some(item => item.id === id)) return;
    changeItems(attachments.current.map(item => {
      if (item.id !== id) return item;
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return { ...item, preview: blob, previewUrl: URL.createObjectURL(blob), json };
    }));
  };
  const submit = async () => {
    if (pending.current || additions.current > 0 || !description.trim()) return;
    pending.current = true; setSubmitting(true); setError('');
    const abort = request.current = new AbortController();
    try {
      await editor.current?.flush();
      const body = { type, description, context, attachments: await Promise.all(attachments.current.map(encodeAttachment)) };
      if (abort.signal.aborted) return;
      const signature = JSON.stringify(body);
      if (attempt.current?.signature !== signature) attempt.current = { signature, payload: { id: crypto.randomUUID(), ...body } };
      await submitReport(attempt.current.payload, abort.signal);
      if (alive.current && !abort.signal.aborted) {
        attachments.current.forEach(releaseAttachment); changeItems([]);
        attempt.current = undefined; setDescription(''); onSaved();
      }
    } catch {
      if (alive.current && !abort.signal.aborted) setError('Your report could not be saved. Your draft is still here. Please try again.');
    } finally {
      pending.current = false;
      if (alive.current) setSubmitting(false);
    }
  };
  return { type, setType, description, setDescription, items, selected, setSelected,
    error, setError, submitting, adding, add, remove, updateImage, submit, fail, editor };
}
