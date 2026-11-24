import { execSync } from 'node:child_process'
import { REPO_ROOT } from './loader.js'
import { auditAll } from './audit.js'
import type { ToolResult } from './types.js'

export async function runVerify(suite: 'all' | 'build' | 'graphs' | 'video' = 'all'): Promise<ToolResult> {
  const results: Record<string, { ok: boolean; output: string }> = {}
  const unknowns: string[] = []
  let allOk = true

  if (suite === 'all' || suite === 'build') {
    try {
      const out = execSync('npm run build', { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' })
      results.build = { ok: true, output: out.trim().slice(-800) }
    } catch (err: unknown) {
      allOk = false
      const e = err as { stdout?: string; stderr?: string; message?: string }
      results.build = {
        ok: false,
        output: `${e.stdout ?? ''}\n${e.stderr ?? e.message ?? ''}`.trim().slice(-1200),
      }
    }
  }

  if (suite === 'all' || suite === 'graphs') {
    const audit = await auditAll()
    results.graphs = { ok: audit.ok, output: audit.summary }
    if (!audit.ok) allOk = false
  }

  if (suite === 'all' || suite === 'video') {
    try {
      const out = execSync('python manim-pipeline/render.py --verify-only', {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      results.video = { ok: true, output: out.trim().slice(-800) }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      const msg = `${e.stdout ?? ''}\n${e.stderr ?? e.message ?? ''}`.trim()
      if (/No module named 'manim'|Docker is required|not recognized/i.test(msg)) {
        unknowns.push('Local Manim/Docker environment not available; video verifier skipped locally.')
        results.video = { ok: true, output: 'SKIPPED (Docker/Manim not available locally)' }
      } else {
        allOk = false
        results.video = { ok: false, output: msg.slice(-1200) }
      }
    }
  }

  return {
    ok: allOk,
    summary: `Verification (${suite}): ${allOk ? 'PASSED' : 'FAILED'}.`,
    evidence: results,
    unknowns,
  }
}
