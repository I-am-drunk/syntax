export type ReportType = 'Bug' | 'Question' | 'Suggestion';
export type ReportContext = {
  contentSlug: string; contentType: 'lesson' | 'practice'; contentVersionName: string;
  courseSlug: string; chapterSlug: string; asset: string; uri: string;
};
export type ReportAttachment = { name: string; type: string; data: string };
export type ReportPayload = {
  id: string; type: ReportType; description: string;
  context: ReportContext; attachments: ReportAttachment[];
};
export const MAX_ATTACHMENT_BYTES: number;
export const MAX_ATTACHMENTS: number;
export const REPORT_TYPES: readonly ReportType[];
export function parseReport(value: unknown): ReportPayload;
