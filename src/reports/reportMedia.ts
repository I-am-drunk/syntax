import html2canvas from 'html2canvas';
import { MAX_ATTACHMENT_BYTES } from '../../shared/reports.js';

export type Attachment = {
  id: string; name: string; original: Blob; url: string;
  preview?: Blob; previewUrl?: string; json?: object;
};
export function attachmentFrom(file: Blob, name: string): Attachment {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('Attachments must be 10 MB or smaller.');
  return { id: crypto.randomUUID(), name, original: file, url: URL.createObjectURL(file) };
}
export function releaseAttachment(item: Attachment) {
  URL.revokeObjectURL(item.url);
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}
export async function captureReportScreenshot(): Promise<Blob> {
  const canvas = await html2canvas(document.body, {
    logging: false, useCORS: true, width: innerWidth, height: innerHeight,
    x: scrollX, y: scrollY, ignoreElements: element => element.hasAttribute('data-report-host'),
    onclone: clonedDocument => {
      // html2canvas otherwise clips this boxless element to an empty rectangle.
      for (const frame of clonedDocument.querySelectorAll<HTMLElement>('.lesson-surface-inner')) {
        if (clonedDocument.defaultView?.getComputedStyle(frame).display === 'contents') frame.style.overflow = 'visible';
      }
    },
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('The screenshot could not be captured.'))));
}
export async function encodeAttachment(item: Attachment) {
  const blob = item.preview ?? item.original;
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('Attachments must be 10 MB or smaller.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
  });
  return { name: item.name, type: blob.type, data };
}
