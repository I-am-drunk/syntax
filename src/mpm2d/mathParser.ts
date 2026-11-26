export type ParsedNumber =
  | { kind: 'undefined' }
  | { kind: 'value'; value: number; hasRadical: boolean; raw: string }

export type ParsedPoint = { x: number; y: number }

// Canonical line: a*x + b*y + c = 0
export type ParsedLine = {
  a: number
  b: number
  c: number
  isSlopeIntercept: boolean
  isVertical: boolean
  slope: number | null
  intercept: number | null
}

export type ParsedCircle = { rSquared: number }

export type StepAnswerSpec =
  | {
      kind: 'number'
      expected: number | 'undefined'
      exactRequired?: boolean
      tolerance?: number
      display: string
      commonMistakes?: { value: number | 'undefined'; message: string }[]
    }
  | {
      kind: 'point'
      expected: [number, number]
      tolerance?: number
      display: string
      commonMistakes?: { value: [number, number]; message: string }[]
    }
  | {
      kind: 'line'
      // ax + by + c = 0
      expected: { a: number; b: number; c: number }
      requireSlopeIntercept?: boolean
      display: string
    }
  | {
      kind: 'circle'
      expectedRadius: number
      display: string
    }
  | {
      kind: 'choice'
      options: { id: string; label: string; hint?: string }[]
      expectedId: string
      display: string
    }

export type GradeResult = {
  correct: boolean
  feedback?: string
  /** True when the input failed syntax parsing (do not burn a Check attempt) */
  isFormatError?: boolean
}

const EPS = 1e-4

function fmtFeedbackNum(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const rounded = Math.round(n * 1000) / 1000
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded))
  }
  return String(rounded)
}

/**
 * Zero-eval recursive-descent evaluator supporting +, -, *, /, unary +/-,
 * right-associative ^ (lower precedence for unary minus: -3^2 === -9),
 * parentheses, sqrt(...), and optional x/y variables.
 */
function evalSafeMathExpr(expr: string, vars?: { x: number; y: number }): number | null {
  let i = 0
  const n = expr.length
  const parsePrimary = (): number => {
    if (expr.startsWith('sqrt(', i)) {
      i += 5
      const v = parseAddSub()
      if (expr[i] !== ')') return NaN
      i += 1
      return v < 0 ? NaN : Math.sqrt(v)
    }
    if (expr[i] === '(') {
      i += 1
      const v = parseAddSub()
      if (expr[i] !== ')') return NaN
      i += 1
      return v
    }
    if (vars && (expr[i] === 'x' || expr[i] === 'y')) return vars[expr[i++] as 'x' | 'y']
    const start = i
    while (i < n && ((expr[i]! >= '0' && expr[i]! <= '9') || expr[i] === '.')) i++
    return i > start ? Number(expr.slice(start, i)) : NaN
  }
  const parsePower = (): number => {
    const base = parsePrimary()
    return expr[i] === '^' ? (i += 1, Math.pow(base, parseUnary())) : base
  }
  const parseUnary = (): number =>
    expr[i] === '+' ? (i += 1, parseUnary()) : expr[i] === '-' ? (i += 1, -parseUnary()) : parsePower()
  const parseMulDiv = (): number => {
    let v = parseUnary()
    while (expr[i] === '*' || expr[i] === '/') v = expr[i++] === '*' ? v * parseUnary() : v / parseUnary()
    return v
  }
  const parseAddSub = (): number => {
    let v = parseMulDiv()
    while (expr[i] === '+' || expr[i] === '-') v = expr[i++] === '+' ? v + parseMulDiv() : v - parseMulDiv()
    return v
  }
  const out = parseAddSub()
  return i === n && Number.isFinite(out) ? out : null
}

function normalizeSymbols(s: string): string {
  return s
    .trim()
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\s+/g, ' ')
}

/**
 * Evaluates a simple numeric expression with integers, decimals, fractions,
 * +, -, *, /, parentheses, and sqrt(...) or √...
 */
export function parseNumberExpr(input: string): ParsedNumber | null {
  let s = normalizeSymbols(input).toLowerCase()
  if (!s) return null
  // Allow optional leading variable assignment like "m = 3/2", "m_ab = -1", "d = sqrt(72)", "r = 5"
  s = s
    .replace(
      /^(?:m(?:_[a-z0-9⊥]+|⊥)?|d(?:_[a-z0-9]+)?|r|b|k|a|c|h|x|y|slope|length|radius|distance|area)\s*=\s*/i,
      '',
    )
    .trim()
  if (!s) return null
  if (
    s === 'undefined' ||
    s === 'undef' ||
    s === 'und' ||
    s === 'no slope' ||
    s === 'none' ||
    s === 'dne'
  ) {
    return { kind: 'undefined' }
  }
  // Allow optional trailing measurement units like "46.4 km", "12 units", "sqrt(50) u", "25 sq units"
  s = s
    .replace(
      /(?<=[0-9)])\s*(?:sq\.?\s*units?|square\s+units?|units?\^2|u\^2|km\^2|m\^2|cm\^2|mm\^2|units?|km|cm|mm|mi|ft|in|m|u)\.?$/i,
      '',
    )
    .trim()
  if (!s) return null

  const hasRadical = s.includes('sqrt') || s.includes('√')

  // Reject mixed numbers like "1 1/2" rather than gluing digits into "11/2"
  if (/\d\s+\d/.test(s)) return null

  // Normalize √( ... ), √72, sqrt 72, 6√2, 6sqrt(2), and implicit )( multiplication
  let expr = s
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9]+(?:\.[0-9]+)?)/g, 'sqrt($1)')
    .replace(/sqrt\s+([0-9]+(?:\.[0-9]+)?)/g, 'sqrt($1)')
    .replace(/(\d|\))\s*(sqrt\()/g, '$1*$2')
    .replace(/(\d)\s*\(/g, '$1*(')
    .replace(/\)\s*(\d)/g, ')*$1')
    .replace(/\)\s*\(/g, ')*(')
    .replace(/\s+/g, '')

  // Collapse double signs so "5 - -2" -> "5+2" instead of invalid JS decrement
  while (/[+-]{2}/.test(expr)) {
    expr = expr.replace(/--/g, '+').replace(/\+\+/g, '+').replace(/\+-|-\+/g, '-')
  }

  // Validate only safe tokens
  const stripped = expr.replace(/sqrt/g, '')
  if (!/^[0-9.+\-*/()^]+$/.test(stripped)) return null

  const val = evalSafeMathExpr(expr)
  if (val === null) return null
  return { kind: 'value', value: val, hasRadical, raw: s }
}

export function parsePointExpr(input: string): ParsedPoint | null {
  let s = normalizeSymbols(input)
  if (!s) return null
  // Allow optional point labels like M(2, -1) or P = (1/2, -3/2)
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9_']*\s*=?\s*(?=\()/, '').trim()
  if (s.startsWith('(') && s.endsWith(')')) {
    let wrapDepth = 0
    let wrapsAll = true
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') wrapDepth++
      else if (s[i] === ')') wrapDepth--
      if (wrapDepth === 0) {
        wrapsAll = false
        break
      }
    }
    if (wrapsAll) s = s.slice(1, -1).trim()
  }
  // Split on top-level comma
  let depth = 0
  let commaIdx = -1
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') depth--
    else if (s[i] === ',' && depth === 0) {
      if (commaIdx !== -1) return null
      commaIdx = i
    }
  }
  if (commaIdx === -1) return null
  const left = parseNumberExpr(s.slice(0, commaIdx))
  const right = parseNumberExpr(s.slice(commaIdx + 1))
  if (!left || !right || left.kind !== 'value' || right.kind !== 'value') return null
  return { x: left.value, y: right.value }
}

/**
 * Evaluates a linear expression in x and y at (x, y) to extract a*x + b*y + c.
 */
function parseLinearSide(side: string): { a: number; b: number; c: number } | null {
  let expr = normalizeSymbols(side).toLowerCase()
  if (!expr) return null

  // Reject exponents or disallowed variables
  if (expr.includes('^') || expr.includes('sqrt') || expr.includes('√')) return null
  if (/[^0-9xy.+\-*/()\s]/.test(expr)) return null

  // Insert implicit multiplication & normalize double signs
  expr = expr
    .replace(/\s+/g, '')
    .replace(/\)\(/g, ')*(')
    .replace(/(\d|\))([xy])/g, '$1*$2')
    .replace(/([xy])(\d|\()/g, '$1*$2')
    .replace(/(\d)\(/g, '$1*(')
  while (/[+-]{2}/.test(expr)) {
    expr = expr.replace(/--/g, '+').replace(/\+\+/g, '+').replace(/\+-|-\+/g, '-')
  }

  const evalAt = (x: number, y: number): number | null => evalSafeMathExpr(expr, { x, y })

  const f00 = evalAt(0, 0)
  const f10 = evalAt(1, 0)
  const f01 = evalAt(0, 1)
  const f23 = evalAt(2, 3)
  if (f00 === null || f10 === null || f01 === null || f23 === null) return null

  const c = f00
  const a = f10 - f00
  const b = f01 - f00

  // Verify linearity at (2, 3)
  if (Math.abs(a * 2 + b * 3 + c - f23) > 1e-6) return null
  return { a, b, c }
}

export function parseLineExpr(input: string): ParsedLine | null {
  const s = normalizeSymbols(input).replace(/\bf\s*\(\s*x\s*\)/gi, 'y')
  const parts = s.split('=')
  if (parts.length !== 2) return null
  const lhs = parseLinearSide(parts[0])
  const rhs = parseLinearSide(parts[1])
  if (!lhs || !rhs) return null

  // Move everything to lhs - rhs = 0
  const a = lhs.a - rhs.a
  const b = lhs.b - rhs.b
  const c = lhs.c - rhs.c
  if (Math.abs(a) < EPS && Math.abs(b) < EPS) return null

  const lhsTrim = parts[0].trim().toLowerCase()
  const rhsTrim = parts[1].trim().toLowerCase()
  const isVertical = Math.abs(b) < EPS
  const isSlopeIntercept =
    !isVertical &&
    ((lhsTrim === 'y' && Math.abs(rhs.b) < EPS) ||
      (rhsTrim === 'y' && Math.abs(lhs.b) < EPS))
  const slope = isVertical ? null : -a / b
  const intercept = isVertical ? null : -c / b

  return { a, b, c, isSlopeIntercept, isVertical, slope, intercept }
}

export function parseCircleExpr(input: string): ParsedCircle | null {
  const s = normalizeSymbols(input).toLowerCase().replace(/\s+/g, '')
  const parts = s.split('=')
  if (parts.length !== 2) return null
  const [lhs, rhs] = parts
  if (!lhs || !rhs) return null
  const prep = (rawSide: string): string | null => {
    let e = rawSide
      .replace(/√\s*\(/g, 'sqrt(')
      .replace(/√\s*([0-9]+(?:\.[0-9]+)?)/g, 'sqrt($1)')
      .replace(/sqrt\s+([0-9]+(?:\.[0-9]+)?)/g, 'sqrt($1)')
    const stripped = e.replace(/sqrt/g, '')
    if (/[^0-9xy.+\-*/()^]/.test(stripped)) return null
    e = e
      .replace(/(\d|\)|[xy])(sqrt\()/g, '$1*$2')
      .replace(/\)\(/g, ')*(')
      .replace(/(\d|\))([xy])/g, '$1*$2')
      .replace(/([xy])(\d|\()/g, '$1*$2')
      .replace(/(\d)\(/g, '$1*(')
    while (/[+-]{2}/.test(e)) {
      e = e.replace(/--/g, '+').replace(/\+\+/g, '+').replace(/\+-|-\+/g, '-')
    }
    return e
  }
  const eL = prep(lhs)
  const eR = prep(rhs)
  if (!eL || !eR) return null
  const evalDiff = (x: number, y: number): number | null => {
    const l = evalSafeMathExpr(eL, { x, y })
    const r = evalSafeMathExpr(eR, { x, y })
    if (l === null || r === null) return null
    const v = l - r
    return Number.isFinite(v) ? v : null
  }
  const f00 = evalDiff(0, 0)
  const f10 = evalDiff(1, 0)
  const fm10 = evalDiff(-1, 0)
  const f01 = evalDiff(0, 1)
  const f0m1 = evalDiff(0, -1)
  const f23 = evalDiff(2, 3)
  if (f00 === null || f10 === null || fm10 === null || f01 === null || f0m1 === null || f23 === null) return null
  const ax = (f10 + fm10 - 2 * f00) / 2
  const ay = (f01 + f0m1 - 2 * f00) / 2
  const bx = (f10 - fm10) / 2
  const by = (f01 - f0m1) / 2
  if (Math.abs(ax) < EPS || Math.abs(ax - ay) > 1e-5 || Math.abs(bx) > 1e-5 || Math.abs(by) > 1e-5) return null
  // Verify pure quadratic ax*(x^2+y^2) + f00 at (2, 3)
  if (Math.abs(ax * (4 + 9) + f00 - f23) > 1e-4) return null
  const rSquared = -f00 / ax
  if (!Number.isFinite(rSquared) || rSquared <= 0) return null
  return { rSquared }
}

function linesEqual(p: { a: number; b: number; c: number }, q: { a: number; b: number; c: number }): boolean {
  const np = Math.hypot(p.a, p.b)
  const nq = Math.hypot(q.a, q.b)
  if (np < EPS || nq < EPS) return false
  const sp = (p.a > EPS || (Math.abs(p.a) <= EPS && p.b > 0)) ? 1 : -1
  const sq = (q.a > EPS || (Math.abs(q.a) <= EPS && q.b > 0)) ? 1 : -1
  const pa = (p.a / np) * sp
  const pb = (p.b / np) * sp
  const pc = (p.c / np) * sp
  const qa = (q.a / nq) * sq
  const qb = (q.b / nq) * sq
  const qc = (q.c / nq) * sq
  return Math.abs(pa - qa) < 1e-3 && Math.abs(pb - qb) < 1e-3 && Math.abs(pc - qc) < 1e-2
}

export function gradeAnswer(raw: string, spec: StepAnswerSpec): GradeResult {
  if (spec.kind === 'choice') {
    if (raw === spec.expectedId) return { correct: true }
    const picked = spec.options.find(o => o.id === raw)
    return {
      correct: false,
      feedback: picked?.hint ?? 'Look closely at what the diagram and numbers tell us, and try again.',
    }
  }

  if (spec.kind === 'number') {
    const parsed = parseNumberExpr(raw)
    if (!parsed) {
      return {
        correct: false,
        isFormatError: true,
        feedback: 'Type a number, fraction (like -3/2), square root (like sqrt(73)), or "undefined".',
      }
    }
    if (spec.expected === 'undefined') {
      if (parsed.kind === 'undefined') return { correct: true }
      if (parsed.kind === 'value' && Math.abs(parsed.value) < EPS) {
        return {
          correct: false,
          feedback: 'A slope of 0 is a horizontal line. A vertical line has Δx = 0, so we cannot divide by zero, so its slope is undefined.',
        }
      }
      return { correct: false, feedback: 'Check Δx = x₂ − x₁. What happens when you divide by 0?' }
    }
    if (parsed.kind === 'undefined') {
      const undefMistake = spec.commonMistakes?.find(m => m.value === 'undefined')
      if (undefMistake) {
        return { correct: false, feedback: undefMistake.message }
      }
      return {
        correct: false,
        feedback: 'This answer is a finite number, not undefined. Check your calculation.',
      }
    }

    const tol = spec.tolerance ?? 1e-3
    if (Math.abs(parsed.value - spec.expected) <= tol) {
      if (spec.exactRequired && !Number.isInteger(spec.expected) && !parsed.hasRadical) {
        const isSimpleDec = Math.abs(spec.expected * 1000 - Math.round(spec.expected * 1000)) < 1e-6
        const isExactFrac = raw.includes('/') && Math.abs(parsed.value - spec.expected) < 1e-9
        if (!isSimpleDec && !isExactFrac) {
          return {
            correct: false,
            isFormatError: true,
            feedback: `Right value! Because the question asks for the exact length, leave it as a square root using sqrt(...) instead of rounding.`,
          }
        }
      }
      return { correct: true }
    }

    // Check explicit common mistakes
    if (spec.commonMistakes) {
      for (const m of spec.commonMistakes) {
        if (m.value !== 'undefined' && Math.abs(parsed.value - m.value) <= 1e-2) {
          return { correct: false, feedback: m.message }
        }
      }
    }

    // Generic sign flip check
    if (Math.abs(parsed.value + spec.expected) <= tol && Math.abs(spec.expected) > EPS) {
      return {
        correct: false,
        feedback: 'The size is right, but the sign is flipped. Double-check your negative signs.',
      }
    }

    // Generic reciprocal check (very common for slopes!)
    if (Math.abs(spec.expected) > EPS && Math.abs(parsed.value - 1 / spec.expected) <= 1e-2) {
      return {
        correct: false,
        feedback: 'Your fraction is upside down. Remember slope is rise over run: (y₂ − y₁) / (x₂ − x₁).',
      }
    }

    // Forgot square root on length? Only fire for radical/length specs (not plain slopes like 2 vs 4)
    const isLikelyLengthRadical =
      Boolean(spec.exactRequired) || spec.display.includes('√') || spec.display.toLowerCase().includes('sqrt')
    if (
      isLikelyLengthRadical &&
      spec.expected > 1 &&
      Math.abs(parsed.value - spec.expected * spec.expected) <= 1e-2
    ) {
      return {
        correct: false,
        feedback: `That's d² (before taking the square root). Take the square root: type sqrt(${Math.round(parsed.value)}).`,
      }
    }

    return { correct: false, feedback: 'Not quite. Double-check your signs and arithmetic, then try again.' }
  }

  if (spec.kind === 'point') {
    const parsed = parsePointExpr(raw)
    if (!parsed) {
      return {
        correct: false,
        isFormatError: true,
        feedback: 'Enter coordinates as two numbers separated by a comma, like (-5, -1) or (1/2, 3/2).',
      }
    }
    const tol = spec.tolerance ?? 1e-2
    const [ex, ey] = spec.expected
    if (Math.abs(parsed.x - ex) <= tol && Math.abs(parsed.y - ey) <= tol) {
      return { correct: true }
    }
    if (spec.commonMistakes) {
      for (const m of spec.commonMistakes) {
        if (Math.abs(parsed.x - m.value[0]) <= tol && Math.abs(parsed.y - m.value[1]) <= tol) {
          return { correct: false, feedback: m.message }
        }
      }
    }
    if (Math.abs(parsed.x - ey) <= tol && Math.abs(parsed.y - ex) <= tol && Math.abs(ex - ey) > tol) {
      return {
        correct: false,
        feedback: 'Your x and y values are swapped. Remember a point is always written (x, y).',
      }
    }
    if (Math.abs(parsed.x - ex) <= tol) {
      return {
        correct: false,
        feedback: `Your x-coordinate (${fmtFeedbackNum(parsed.x)}) is right. Double-check your y-coordinate.`,
      }
    }
    if (Math.abs(parsed.y - ey) <= tol) {
      return {
        correct: false,
        feedback: `Your y-coordinate (${fmtFeedbackNum(parsed.y)}) is right. Double-check your x-coordinate.`,
      }
    }
    return {
      correct: false,
      feedback: 'Not quite. Check both coordinates (watch negative signs carefully).',
    }
  }

  if (spec.kind === 'line') {
    const parsed = parseLineExpr(raw)
    if (!parsed) {
      return {
        correct: false,
        isFormatError: true,
        feedback: 'Write a full equation with an equals sign, like y = -1/2x + 3 or x = 2.',
      }
    }
    if (linesEqual(parsed, spec.expected)) {
      if (spec.requireSlopeIntercept && !parsed.isSlopeIntercept && Math.abs(spec.expected.b) > EPS) {
        return {
          correct: false,
          isFormatError: true,
          feedback: 'That is the exact same line! Now isolate y so it is written in slope y-intercept form (y = mx + b).',
        }
      }
      return { correct: true }
    }

    const expVertical = Math.abs(spec.expected.b) < EPS
    if (!expVertical && !parsed.isVertical) {
      const expM = -spec.expected.a / spec.expected.b
      const expB = -spec.expected.c / spec.expected.b
      if (parsed.slope !== null && Math.abs(parsed.slope - expM) < 1e-2) {
        return {
          correct: false,
          feedback: 'Your slope is right, but the y-intercept b is off. Plug the known point into y = mx + b and solve for b.',
        }
      }
      if (parsed.slope !== null && Math.abs(parsed.slope + expM) < 1e-2 && Math.abs(expM) > EPS) {
        return {
          correct: false,
          feedback: 'Check the sign on your slope; it looks flipped (did you forget to negate?).',
        }
      }
      if (parsed.slope !== null && Math.abs(expM) > EPS && Math.abs(parsed.slope + 1 / expM) < 1e-2) {
        return {
          correct: false,
          feedback: 'Your slope is perpendicular to the target line. Did you forget to flip and negate (or flip when you did not need to)?',
        }
      }
      if (parsed.slope !== null && Math.abs(expM) > EPS && Math.abs(parsed.slope - 1 / expM) < 1e-2 && Math.abs(expM - 1) > 1e-2 && Math.abs(expM + 1) > 1e-2) {
        return {
          correct: false,
          feedback: 'Your slope fraction looks upside down (check rise over run, or flip and switch the sign for 90°).',
        }
      }
      if (parsed.intercept !== null && Math.abs(parsed.intercept - expB) < 1e-2) {
        return {
          correct: false,
          feedback: 'Your y-intercept matches, so double-check the slope.',
        }
      }
    }
    if (expVertical && !parsed.isVertical) {
      return {
        correct: false,
        feedback: 'Look at the two points on this line: they have the same x-value, so this is a vertical line of the form x = number.',
      }
    }

    return {
      correct: false,
      feedback: 'That line does not match yet. Check the slope first, then check which point the line passes through.',
    }
  }

  if (spec.kind === 'circle') {
    const parsed = parseCircleExpr(raw)
    if (!parsed) {
      return {
        correct: false,
        isFormatError: true,
        feedback: 'Write the circle equation in the form x^2 + y^2 = r^2 (for example, x^2 + y^2 = 25).',
      }
    }
    const targetR2 = spec.expectedRadius * spec.expectedRadius
    if (Math.abs(parsed.rSquared - targetR2) < 1e-3) {
      return { correct: true }
    }
    if (Math.abs(parsed.rSquared - spec.expectedRadius) < 1e-3) {
      const rSqHint =
        Math.abs(spec.expectedRadius - Math.round(spec.expectedRadius)) < 1e-6
          ? `${Math.round(spec.expectedRadius)}²`
          : Math.abs(targetR2 - Math.round(targetR2)) < 1e-4
            ? `(√${Math.round(targetR2)})²`
            : `${fmtFeedbackNum(spec.expectedRadius)}²`
      return {
        correct: false,
        feedback: `Almost! Remember the formula is x² + y² = r², so you need to square the radius: ${rSqHint}.`,
      }
    }
    return {
      correct: false,
      feedback: 'Remember a circle centred at (0, 0) has equation x² + y² = r². Check your r² value.',
    }
  }

  return { correct: false, feedback: 'Check your entry and try again.' }
}

/**
 * Formats typed math nicely for live preview beneath the keyboard input.
 */
export function formatMathPreview(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return trimmed
    .replace(/sqrt\(([^)]*)\)/gi, '√($1)')
    .replace(/√\((\d+(?:\.\d+)?)\)/g, '√$1')
    .replace(/\^2/g, '²')
    .replace(/-/g, '−')
}

export type GhostGeometry =
  | { kind: 'point'; x: number; y: number }
  | { kind: 'line'; a: number; b: number; c: number }
  | { kind: 'circle'; r: number }
  | null

export function parseGhostGeometry(raw: string, expectedKind: StepAnswerSpec['kind']): GhostGeometry {
  if (!raw.trim()) return null
  if (expectedKind === 'point') {
    const p = parsePointExpr(raw)
    if (p && Math.abs(p.x) < 100 && Math.abs(p.y) < 100) return { kind: 'point', ...p }
  }
  if (expectedKind === 'line') {
    const l = parseLineExpr(raw)
    if (l) return { kind: 'line', a: l.a, b: l.b, c: l.c }
  }
  if (expectedKind === 'circle') {
    const c = parseCircleExpr(raw)
    if (c && c.rSquared > 0 && c.rSquared < 10000) return { kind: 'circle', r: Math.sqrt(c.rSquared) }
  }
  return null
}
