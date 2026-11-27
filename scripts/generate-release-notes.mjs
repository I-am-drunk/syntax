#!/usr/bin/env node
/**
 * T3 Code-inspired automated release notes generator for Syntax.
 *
 * Output format:
 *   **v0.3.0** · 18 changes from 2 contributors
 *
 *   - **Feature Name.** Plain-English user outcome sentence (<= 20 words).
 *
 *   ### Plus 12 more bug fixes.
 *
 *   <details>
 *   <summary>Full changelog</summary>
 *
 *   ...GitHub generated PR changelog...
 *
 *   </details>
 *
 * Provider cascade ($0/mo by default in GitHub Actions):
 *   1. OPENAI_API_KEY (if set) -> OpenAI Responses API
 *   2. GEMINI_API_KEY (if set) -> Gemini GenerateContent API
 *   3. GH_TOKEN / GITHUB_TOKEN -> GitHub Models free endpoint (models: read)
 *   4. Deterministic conventional-commit fallback (never fails a release)
 */

import { execFileSync } from 'node:child_process'
import { renameSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const PULL_REQUEST_NUMBER = /\(#(\d+)\)$/
const PULL_REQUEST_BODY_LIMIT = 300

const SUMMARY_INSTRUCTIONS = `Write up to 7 bullet points for the Syntax release notes.

Give a feature a bullet only when it lets learners or extension authors do something they could not do before, removes a real limitation they hit in normal use, or meaningfully improves the core learning app, extension system, Sema, or cloud sync. Judge the real user outcome, regardless of commit prefix.

Lead with new capabilities. Give a bug fix its own bullet only when it prevented data loss, fixed a security hole, or fixed a core workflow learners could not complete. Leave routine fixes, small polish, and isolated edge cases in the remaining bug-fix count. Skip internal CI work, refactors, docs-only edits, tests, and dependency bumps. Group related commits into one bullet when they deliver the same user outcome. Seven is a ceiling; stop when qualifying changes run out, even if that leaves zero bullets.

Each bullet has a short feature name and one sentence of at most 20 words describing what now works. Use plain product names learners see in Syntax (Syntax, Extensions, Courses, Library, Sema, Community Hub, Cloud Sync) and omit internal implementation details. No title, headings, introduction, PR numbers, hype, or em dashes.

Return valid JSON only with a "highlights" array. Each item must have:
- "label": plain text feature name without trailing period
- "detail": one plain-English sentence
- "commits": non-empty array of integer 1-based bracketed commit numbers it covers`

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = 'true'
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

function runCmd(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
}

function extractPrNumber(subject) {
  const match = PULL_REQUEST_NUMBER.exec(subject.trim())
  return match ? Number(match[1]) : undefined
}

function trimPullRequestBody(body, limit = PULL_REQUEST_BODY_LIMIT) {
  if (!body) return ''
  const [prose = ''] = body.split(/\n#+\s*(?:Verification|Test|Testing|Screenshots|Checklist)\b/i)
  const text = prose
    .split('\n')
    .filter(line => line.trim() !== '' && !/^\s*[!|#<]/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function readCommits(previousTag, ref) {
  const range = previousTag ? `${previousTag}..${ref}` : ref
  const raw = runCmd('git', ['log', '--reverse', '--no-merges', '--format=%s%x1f%an', range])
  return raw
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      const [subject = '', authorName = ''] = line.split('\x1f')
      return { subject: subject.trim(), authorName: authorName.trim() }
    })
}

function readPullRequests(repository, numbers) {
  const map = new Map()
  if (!repository || numbers.length === 0) return map
  const [owner, name] = repository.split('/')
  if (!owner || !name) return map

  for (let start = 0; start < numbers.length; start += 80) {
    const batch = numbers.slice(start, start + 80)
    const fields = batch
      .map(
        n =>
          `pr${n}: pullRequest(number: ${n}) { body additions deletions changedFiles author { __typename login ... on User { name } } }`,
      )
      .join('\n')
    const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`
    try {
      const raw = runCmd('gh', [
        'api',
        'graphql',
        '-f',
        `query=${query}`,
        '-f',
        `owner=${owner}`,
        '-f',
        `name=${name}`,
      ])
      const parsed = JSON.parse(raw)
      const repoData = parsed?.data?.repository ?? {}
      for (const [alias, pr] of Object.entries(repoData)) {
        if (pr) map.set(Number(alias.slice(2)), pr)
      }
    } catch (err) {
      console.warn('[release-notes] Could not fetch PR metadata via GraphQL:', err.message)
    }
  }
  return map
}

function readFullChangelog({ repository, tag, ref, previousTag }) {
  if (!repository) return ''
  try {
    const args = [
      'api',
      `repos/${repository}/releases/generate-notes`,
      '-f',
      `tag_name=${tag}`,
      '-f',
      `target_commitish=${ref}`,
    ]
    if (previousTag) {
      args.push('-f', `previous_tag_name=${previousTag}`)
    }
    const raw = runCmd('gh', args)
    return JSON.parse(raw)?.body ?? ''
  } catch (err) {
    console.warn('[release-notes] Falling back to git log changelog:', err.message)
    return ''
  }
}

export function countContributors(commits, pullRequests) {
  const people = new Set()
  const prAuthorNames = new Set()
  const directAuthors = []

  for (const commit of commits) {
    const prNum = extractPrNumber(commit.subject)
    const author = prNum !== undefined ? pullRequests.get(prNum)?.author : undefined
    if (!author) {
      directAuthors.push(commit.authorName)
      continue
    }
    if (author.__typename === 'Bot' || author.login?.endsWith('[bot]')) continue
    people.add(author.login)
    prAuthorNames.add(commit.authorName)
    if (author.name) prAuthorNames.add(author.name)
  }

  for (const name of directAuthors) {
    if (name && !name.endsWith('[bot]') && !prAuthorNames.has(name)) {
      people.add(name)
    }
  }
  return Math.max(people.size, commits.length > 0 ? 1 : 0)
}

function buildSummaryInput(commits, pullRequests) {
  return commits
    .map((commit, idx) => {
      const source = `[${idx + 1}] ${commit.subject}`
      const prNum = extractPrNumber(commit.subject)
      const pr = prNum !== undefined ? pullRequests.get(prNum) : undefined
      if (!pr) return source
      const line = `${source} [+${pr.additions} -${pr.deletions}, ${pr.changedFiles} files]`
      const body = trimPullRequestBody(pr.body)
      return body ? `${line}\n  > ${body}` : line
    })
    .join('\n')
}

function parseHighlightsJson(text) {
  if (!text) return null
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!parsed || !Array.isArray(parsed.highlights)) return null
    const valid = []
    for (const item of parsed.highlights) {
      if (
        item &&
        typeof item.label === 'string' &&
        item.label.trim() &&
        typeof item.detail === 'string' &&
        item.detail.trim() &&
        Array.isArray(item.commits) &&
        item.commits.length > 0 &&
        item.commits.every(n => Number.isInteger(n) && n >= 1)
      ) {
        valid.push({
          label: item.label.trim().replace(/\u2014/g, ', ').replace(/\.$/, ''),
          detail: item.detail.trim().replace(/\u2014/g, ', '),
          commits: item.commits,
        })
      }
    }
    return valid
  } catch {
    return null
  }
}

async function summarizeWithOpenAI(input) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.SYNTAX_RELEASE_MODEL || 'gpt-4.1-mini'
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: SUMMARY_INSTRUCTIONS,
      text: { format: { type: 'json_object' } },
      input: `Choose highlights as JSON from these commits:\n${input}`,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = await res.json()
  const text = (data.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(part => part.type === 'output_text' && part.text)
    .map(part => part.text)
    .join('')
  return parseHighlightsJson(text)
}

async function summarizeWithGemini(input) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const model = process.env.SYNTAX_RELEASE_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SUMMARY_INSTRUCTIONS }] },
      generationConfig: { responseMimeType: 'application/json' },
      contents: [{ parts: [{ text: `Choose highlights as JSON from these commits:\n${input}` }] }],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  return parseHighlightsJson(text)
}

async function summarizeWithGitHubModels(input) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!token) return null
  const model = process.env.SYNTAX_RELEASE_MODEL || 'openai/gpt-4.1-mini'
  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SUMMARY_INSTRUCTIONS },
        { role: 'user', content: `Choose highlights as JSON from these commits:\n${input}` },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`GitHub Models HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  return parseHighlightsJson(text)
}

function summarizeDeterministically(commits) {
  const highlights = []
  for (let i = 0; i < commits.length && highlights.length < 7; i++) {
    const subject = commits[i].subject
    const m = /^(feat|security)(?:\(([^)]+)\))?!?:\s*(.+)$/i.exec(subject)
    if (!m) continue
    const scope = (m[2] || (m[1].toLowerCase() === 'security' ? 'Security' : 'Update'))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    const cleanDetail = m[3]
      .replace(/\s*\(#\d+\)\s*$/, '')
      .replace(/\u2014/g, ', ')
      .trim()
    const sentence = cleanDetail.charAt(0).toUpperCase() + cleanDetail.slice(1)
    highlights.push({
      label: scope,
      detail: sentence.endsWith('.') ? sentence : `${sentence}.`,
      commits: [i + 1],
    })
  }
  return highlights
}

export function formatReleaseSummary(commits, selected) {
  const highlights = selected.slice(0, 7).filter(h =>
    h.commits.every(id => id >= 1 && id <= commits.length),
  )
  const covered = new Set(highlights.flatMap(h => h.commits))
  const bullets = highlights.map(
    ({ label, detail }) => `- **${label.replace(/\.$/, '')}.** ${detail}`,
  )

  const remaining = []
  commits.forEach(({ subject }, idx) => {
    if (covered.has(idx + 1)) return
    const match = /^(fix|perf|security|revert)(?:\([^)]*\))?!?:/i.exec(subject)
    if (match) {
      remaining.push(match[1].toLowerCase() === 'perf' ? 'perf' : 'fix')
    }
  })

  if (remaining.length === 0) return bullets.join('\n')

  const count = remaining.length
  const hasFix = remaining.includes('fix')
  const hasPerf = remaining.includes('perf')
  let kind = 'bug fixes and performance improvements'
  if (hasFix && !hasPerf) kind = count === 1 ? 'bug fix' : 'bug fixes'
  if (!hasFix && hasPerf) {
    kind = count === 1 ? 'performance improvement' : 'performance improvements'
  }

  return bullets.length
    ? `${bullets.join('\n')}\n\n### Plus ${count} more ${kind}.`
    : `**${count} ${kind}.**`
}

function buildReleaseHeader(version, changes, contributors) {
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
  return `**v${version.replace(/^v/, '')}** · ${plural(changes, 'change')} from ${plural(contributors, 'contributor')}`
}

function assembleReleaseNotes(header, summary, fullChangelog) {
  const parts = [header, summary].filter(Boolean)
  if (fullChangelog.trim()) {
    parts.push(`<details>\n<summary>Full changelog</summary>\n\n${fullChangelog.trim()}\n\n</details>`)
  }
  return `${parts.join('\n\n')}\n`
}

async function generateHighlights(commits, input) {
  if (!input.trim()) return []
  const providers = [
    ['OpenAI', summarizeWithOpenAI],
    ['Gemini', summarizeWithGemini],
    ['GitHub Models', summarizeWithGitHubModels],
  ]
  for (const [name, fn] of providers) {
    try {
      const result = await fn(input)
      if (result !== null) {
        console.log(`[release-notes] Summarized ${commits.length} commits via ${name} (${result.length} highlights).`)
        return result
      }
    } catch (err) {
      console.warn(`[release-notes] ${name} unavailable (${err.message}); trying next provider.`)
    }
  }
  console.log('[release-notes] Using deterministic conventional-commit summary fallback.')
  return summarizeDeterministically(commits)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const repository = args.repository || ''
  const tag = args.tag || 'v0.0.0'
  const ref = args.ref || 'HEAD'
  const previousTag = args['previous-tag'] || ''
  const version = args.version || tag.replace(/^v/, '')
  const output = args.output || ''
  const dryRun = args['dry-run'] === 'true'

  const commits = readCommits(previousTag, ref)
  if (commits.length === 0) {
    console.warn(`[release-notes] Empty commit range (${previousTag || 'root'}..${ref}).`)
    process.exit(0)
  }

  const prNumbers = [...new Set(commits.map(c => extractPrNumber(c.subject)).filter(Boolean))]
  const pullRequests = readPullRequests(repository, prNumbers)
  const fullChangelog = readFullChangelog({ repository, tag, ref, previousTag })

  const header = buildReleaseHeader(
    version,
    commits.length,
    countContributors(commits, pullRequests),
  )
  const summaryInput = buildSummaryInput(commits, pullRequests)
  const selected = await generateHighlights(commits, summaryInput)
  const summary = formatReleaseSummary(commits, selected)
  const body = assembleReleaseNotes(header, summary, fullChangelog)

  if (dryRun || !output) {
    process.stdout.write(body)
    return
  }

  writeFileSync(`${output}.tmp`, body, 'utf8')
  renameSync(`${output}.tmp`, output)
  console.log(`[release-notes] Wrote release notes to ${output}.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[release-notes] Fatal error:', err)
    process.exit(1)
  })
}
