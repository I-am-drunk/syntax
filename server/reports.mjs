import { mkdir, writeFile, readFile, link, unlink, realpath } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReport } from '../shared/reports.js'

export async function saveReport(input) {
  const report = parseReport(input)
  let directory = resolve(process.env.SYNTAX_REPORTS_DIR ?? join(homedir(), '.local/share/syntax/reports'))
  const app = await realpath(fileURLToPath(new URL('../', import.meta.url)))
  if (directory === app || directory.startsWith(app + sep)) throw new Error('Report storage must be outside the app')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  directory = await realpath(directory)
  if (directory === app || directory.startsWith(app + sep)) throw new Error('Report storage must be outside the app')
  const destination = join(directory, `${report.id}.json`)
  const temporary = join(directory, `.pending-${randomUUID()}`)
  const record = { acceptedAt: new Date().toISOString(), report }
  try {
    await writeFile(temporary, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 })
    await link(temporary, destination)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const existing = JSON.parse(await readFile(destination, 'utf8'))
    if (JSON.stringify(existing.report) !== JSON.stringify(report)) {
      const conflict = new Error('Submission id already belongs to another report')
      conflict.code = 'REPORT_CONFLICT'; throw conflict
    }
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
  return { accepted: true, id: report.id }
}
