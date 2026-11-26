/**
 * Pure-TypeScript SemVer 2.0.0 parser, comparator, and range evaluator.
 * Zero external dependencies — runs identically in browser SPA and Node CLI.
 */

export type ParsedSemver = {
  major: number
  minor: number
  patch: number
  pre: string[]
}

type Op = '=' | '>' | '>=' | '<' | '<='
type Comparator = { op: Op; v: ParsedSemver }

const STRICT_RE =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/
const PARTIAL_RE =
  /^(>=|<=|>|<|=|\^|~)?v?(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/
const WILDCARD = new Set(['*', 'x', 'X'])

export function parseSemver(raw: string): ParsedSemver | null {
  if (typeof raw !== 'string') return null
  const m = STRICT_RE.exec(raw.trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.') : [],
  }
}

export function isValidSemver(raw: string): boolean {
  return parseSemver(raw) !== null
}

export function compareParsedSemver(a: ParsedSemver, b: ParsedSemver): -1 | 0 | 1 {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1
  if (a.pre.length === 0 && b.pre.length > 0) return 1
  if (a.pre.length > 0 && b.pre.length === 0) return -1
  const len = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < len; i++) {
    const ia = a.pre[i]
    const ib = b.pre[i]
    if (ia === undefined) return -1
    if (ib === undefined) return 1
    if (ia === ib) continue
    const aNum = /^\d+$/.test(ia)
    const bNum = /^\d+$/.test(ib)
    if (aNum && bNum) return Number(ia) > Number(ib) ? 1 : -1
    if (aNum) return -1
    if (bNum) return 1
    return ia > ib ? 1 : -1
  }
  return 0
}

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) {
    // Graceful fallback if comparing malformed legacy strings
    return a === b ? 0 : a > b ? 1 : -1
  }
  return compareParsedSemver(pa, pb)
}

const mk = (major: number, minor = 0, patch = 0, pre: string[] = []): ParsedSemver => ({
  major,
  minor,
  patch,
  pre,
})

function expandToken(token: string): Comparator[] | null {
  const m = PARTIAL_RE.exec(token)
  if (!m) return null
  const [, rawOp, sMaj, sMin, sPat, sPre] = m
  const majWild = WILDCARD.has(sMaj)
  const minWild = sMin === undefined || WILDCARD.has(sMin)
  const patWild = sPat === undefined || WILDCARD.has(sPat)

  // Reject malformed mixed wildcards like "1.x.2" or "*.1"
  if ((majWild && (!minWild || !patWild)) || (minWild && !patWild)) return null
  if (majWild) {
    if (rawOp && rawOp !== '=' && rawOp !== '>=' && rawOp !== '<=') return null
    return [{ op: '>=', v: mk(0, 0, 0) }]
  }

  const M = Number(sMaj)
  const min = minWild ? undefined : Number(sMin)
  const pat = patWild ? undefined : Number(sPat)
  const pre = sPre ? sPre.split('.') : []

  if (rawOp === '^') {
    const lower = mk(M, min ?? 0, pat ?? 0, pre)
    const upper =
      M > 0
        ? mk(M + 1, 0, 0)
        : min === undefined
          ? mk(1, 0, 0)
          : min > 0
            ? mk(0, min + 1, 0)
            : pat === undefined
              ? mk(0, 1, 0)
              : mk(0, 0, pat + 1)
    return [
      { op: '>=', v: lower },
      { op: '<', v: upper },
    ]
  }

  if (rawOp === '~') {
    const lower = mk(M, min ?? 0, pat ?? 0, pre)
    const upper = min === undefined ? mk(M + 1, 0, 0) : mk(M, min + 1, 0)
    return [
      { op: '>=', v: lower },
      { op: '<', v: upper },
    ]
  }

  const op: Op = (rawOp as Op | undefined) ?? '='
  if (min === undefined) {
    if (op === '=') return [{ op: '>=', v: mk(M, 0, 0) }, { op: '<', v: mk(M + 1, 0, 0) }]
    if (op === '<=') return [{ op: '<', v: mk(M + 1, 0, 0) }]
    if (op === '>') return [{ op: '>=', v: mk(M + 1, 0, 0) }]
    return [{ op, v: mk(M, 0, 0) }]
  }
  if (pat === undefined) {
    if (op === '=') return [{ op: '>=', v: mk(M, min, 0) }, { op: '<', v: mk(M, min + 1, 0) }]
    if (op === '<=') return [{ op: '<', v: mk(M, min + 1, 0) }]
    if (op === '>') return [{ op: '>=', v: mk(M, min + 1, 0) }]
    return [{ op, v: mk(M, min, 0) }]
  }
  return [{ op, v: mk(M, min, pat, pre) }]
}

function parseRange(range: string): Comparator[][] | null {
  if (typeof range !== 'string') return null
  const trimmed = range.trim()
  if (!trimmed) return null
  const clauses: Comparator[][] = []
  for (const rawClause of trimmed.split('||')) {
    const normalized = rawClause.trim().replace(/([<>]=?|=|\^|~)\s+/g, '$1')
    if (!normalized) return null
    const comps: Comparator[] = []
    for (const tok of normalized.split(/\s+/)) {
      const expanded = expandToken(tok)
      if (!expanded) return null
      comps.push(...expanded)
    }
    clauses.push(comps)
  }
  return clauses
}

export function isValidSemverRange(range: string): boolean {
  return parseRange(range) !== null
}

function testComp(v: ParsedSemver, c: Comparator): boolean {
  const d = compareParsedSemver(v, c.v)
  if (c.op === '=') return d === 0
  if (c.op === '>') return d > 0
  if (c.op === '>=') return d >= 0
  if (c.op === '<') return d < 0
  return d <= 0
}

export function satisfiesRange(
  version: string,
  range: string,
  options?: { includePrerelease?: boolean },
): boolean {
  const v = parseSemver(version)
  const clauses = parseRange(range)
  if (!v || !clauses) return false
  const allowPre = Boolean(options?.includePrerelease)

  return clauses.some(clause => {
    if (!clause.every(c => testComp(v, c))) return false
    if (v.pre.length === 0 || allowPre) return true
    return clause.some(
      c =>
        c.v.pre.length > 0 &&
        c.v.major === v.major &&
        c.v.minor === v.minor &&
        c.v.patch === v.patch,
    )
  })
}
