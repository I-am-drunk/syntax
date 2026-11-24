import * as fs from 'node:fs'
import * as path from 'node:path'
import { REPO_ROOT, loadSyntaxApp } from './loader.js'
import type { ToolResult } from './types.js'

export async function inspectVideoStatus(pageId?: string): Promise<ToolResult> {
  const app = await loadSyntaxApp()
  const walkthroughsDir = path.join(REPO_ROOT, 'public/assets/walkthroughs')
  const qaDir = path.join(REPO_ROOT, 'manim-pipeline/.cache/qa')
  const unknowns: string[] = []

  const renderedPages: string[] = fs.existsSync(walkthroughsDir)
    ? fs.readdirSync(walkthroughsDir).filter(f => fs.statSync(path.join(walkthroughsDir, f)).isDirectory())
    : []

  const contactSheets: string[] = fs.existsSync(qaDir)
    ? fs.readdirSync(qaDir).filter(f => /\.(png|jpg|jpeg)$/i.test(f)).map(f => path.join(qaDir, f))
    : []

  if (pageId) {
    const wt = app.getWalkthroughForPage(pageId)
    const hasRendered = renderedPages.includes(pageId)
    if (!wt) unknowns.push(`No walkthroughData.ts entry for "${pageId}".`)
    if (!hasRendered) unknowns.push(`No packaged MP4 assets found under public/assets/walkthroughs/${pageId}/`)
    return {
      ok: Boolean(wt),
      summary: `Video status for "${pageId}": metadata=${Boolean(wt)}, rendered=${hasRendered}.`,
      evidence: { pageId, walkthrough: wt ?? null, hasRendered, contactSheets },
      unknowns,
    }
  }

  return {
    ok: true,
    summary: `Found ${renderedPages.length} rendered walkthrough page(s) and ${contactSheets.length} QA contact sheet(s).`,
    evidence: { renderedPages, contactSheets },
    unknowns,
  }
}
