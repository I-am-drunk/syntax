export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 10
export const REPORT_TYPES = ['Bug', 'Question', 'Suggestion']
const invalid = () => { throw new TypeError('Invalid report') }
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const string = (value, max) => typeof value === 'string' && value.length <= max
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key))
export function parseReport(value) {
  if (!exactKeys(value, ['id', 'type', 'description', 'context', 'attachments'])) invalid()
  if (typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.id)) invalid()
  if (!REPORT_TYPES.includes(value.type) || !string(value.description, 10000) || !value.description.trim()) invalid()
  const keys = ['contentSlug', 'contentType', 'contentVersionName', 'courseSlug', 'chapterSlug', 'asset', 'uri']
  if (!exactKeys(value.context, keys) || !keys.every(key => string(value.context[key], 2048))) invalid()
  if (!['lesson', 'practice'].includes(value.context.contentType)) invalid()
  if (!value.context.uri.startsWith('/courses/') || value.context.uri.includes('?')) invalid()
  if (!Array.isArray(value.attachments) || value.attachments.length > MAX_ATTACHMENTS) invalid()
  const attachments = value.attachments.map(file => {
    if (!exactKeys(file, ['name', 'type', 'data']) || !string(file.name, 255) || !file.name.length) invalid()
    if (!string(file.type, 128) || !string(file.data, Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4)) invalid()
    if (file.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) invalid()
    const size = file.data.length / 4 * 3 - (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0)
    if (size > MAX_ATTACHMENT_BYTES) invalid()
    return { name: file.name, type: file.type, data: file.data }
  })
  return { id: value.id, type: value.type, description: value.description,
    context: Object.fromEntries(keys.map(key => [key, value.context[key]])), attachments }
}
