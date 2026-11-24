#!/usr/bin/env node
import { inspectCourses, inspectLesson, inspectPage, findSourceMaterial } from './inspect.js'
import { auditAll, auditLesson, auditPage } from './audit.js'
import { inspectVideoStatus } from './video.js'
import { runVerify } from './verify.js'

async function main() {
  const [cmd, arg] = process.argv.slice(2)
  let res: unknown

  switch (cmd) {
    case 'courses':
      res = await inspectCourses()
      break
    case 'lesson':
      if (!arg) throw new Error('Usage: syntax-cli lesson <lessonId>')
      res = await inspectLesson(arg)
      break
    case 'page':
      if (!arg) throw new Error('Usage: syntax-cli page <pageId>')
      res = await inspectPage(arg)
      break
    case 'sources':
      res = await findSourceMaterial(arg ?? '')
      break
    case 'audit':
      res = arg ? await auditLesson(arg) : await auditAll()
      break
    case 'audit-page':
      if (!arg) throw new Error('Usage: syntax-cli audit-page <pageId>')
      res = await auditPage(arg)
      break
    case 'video':
      res = await inspectVideoStatus(arg)
      break
    case 'verify':
      res = await runVerify((arg as 'all' | 'build' | 'graphs' | 'video') ?? 'all')
      break
    default:
      console.error('Usage: syntax-cli <courses|lesson|page|sources|audit|audit-page|video|verify> [arg]')
      process.exit(1)
  }

  console.log(JSON.stringify(res, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
