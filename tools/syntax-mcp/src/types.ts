export type Severity = 'error' | 'warning' | 'info'

export type AuditCategory = 'math' | 'geometry' | 'pedagogy' | 'ui' | 'video'

export interface AuditFinding {
  severity: Severity
  category: AuditCategory
  lessonId: string
  pageId: string
  code: string
  message: string
  evidence?: Record<string, unknown>
}

export interface ToolResult<T = unknown> {
  ok: boolean
  summary: string
  evidence: T
  findings?: AuditFinding[]
  unknowns: string[]
}
