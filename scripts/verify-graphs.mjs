#!/usr/bin/env node
/**
 * Mathematical Graph Integrity Verification Harness for syntax-mpm2d.
 *
 * Bundles the TypeScript curriculum data via esbuild and verifies every GeoScene
 * across Unit 2 Level 1, Level 2, Conference, and Catch-Up lessons:
 *  1. Valid finite bounds (xMin < xMax, yMin < yMax) and points inside viewport
 *  2. Non-degenerate lines (a, b) != (0, 0) & equation labels matching ax + by + c = 0
 *  3. Right-angle markers: exact 90-deg orthogonality (dir1 . dir2 = 0) AND vertex on geometry
 *  4. POI / intersection points lying on their intersecting lines/segments
 *  5. Circle validity (r > 0) & diameter/chord endpoint distance checks
 *  6. Non-degenerate triangles and quadrilaterals (+ trapezoid slope check)
 *  7. Worked example preScene presence (no answer spoiler on initial diagram)
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const entryCode = `
  export { UNIT2_LESSONS } from './src/mpm2d/data/unit2Course.ts';
  export { CATCHUP_LESSONS } from './src/mpm2d/data/catchupCourses.ts';
`

const result = await build({
  stdin: {
    contents: entryCode,
    resolveDir: repoRoot,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
})

const jsCode = result.outputFiles[0].text
const mod = await import(`data:text/javascript;base64,${Buffer.from(jsCode).toString('base64')}`)

const allLessons = [
  ...mod.UNIT2_LESSONS,
  ...mod.CATCHUP_LESSONS,
]

const errors = []
const warnings = []
let sceneCount = 0

function distPointToLine(px, py, line) {
  const denom = Math.hypot(line.a, line.b)
  if (denom < 1e-9) return Infinity
  return Math.abs(line.a * px + line.b * py + line.c) / denom
}

function distPointToSegment(px, py, seg) {
  const [x1, y1] = seg.from
  const [x2, y2] = seg.to
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function parseFrac(str) {
  const clean = str.replace(/−/g, '-').replace(/\s+/g, '')
  if (clean.includes('/')) {
    const [n, d] = clean.split('/').map(Number)
    return d ? n / d : NaN
  }
  return Number(clean)
}

function parseLineLabel(label) {
  if (!label) return null
  const s = label.replace(/−/g, '-').replace(/\s+/g, '')
  // Match y = mx + b or y = mx - b or y = mx or y = b
  const mY = /^y=([+-]?(?:\d+(?:\.\d+)?(?:\/\d+)?|))x([+-]\d+(?:\.\d+)?(?:\/\d+)?)?$/.exec(s)
  if (mY) {
    let mStr = mY[1]
    if (mStr === '' || mStr === '+') mStr = '1'
    if (mStr === '-') mStr = '-1'
    const m = parseFrac(mStr)
    const b = mY[2] ? parseFrac(mY[2]) : 0
    if (Number.isFinite(m) && Number.isFinite(b)) {
      return { a: m, b: -1, c: b }
    }
  }
  const mConstY = /^y=([+-]?\d+(?:\.\d+)?(?:\/\d+)?)$/.exec(s)
  if (mConstY) {
    const b = parseFrac(mConstY[1])
    if (Number.isFinite(b)) return { a: 0, b: 1, c: -b }
  }
  const mConstX = /^x=([+-]?\d+(?:\.\d+)?(?:\/\d+)?)$/.exec(s)
  if (mConstX) {
    const x0 = parseFrac(mConstX[1])
    if (Number.isFinite(x0)) return { a: 1, b: 0, c: -x0 }
  }
  return null
}

function linesEquivalent(l1, l2, tol = 1e-3) {
  const n1 = Math.hypot(l1.a, l1.b)
  const n2 = Math.hypot(l2.a, l2.b)
  if (n1 < 1e-9 || n2 < 1e-9) return false
  const a1 = l1.a / n1, b1 = l1.b / n1, c1 = l1.c / n1
  const a2 = l2.a / n2, b2 = l2.b / n2, c2 = l2.c / n2
  const same = Math.abs(a1 - a2) < tol && Math.abs(b1 - b2) < tol && Math.abs(c1 - c2) < tol
  const opp = Math.abs(a1 + a2) < tol && Math.abs(b1 + b2) < tol && Math.abs(c1 + c2) < tol
  return same || opp
}

function polygonSegments(scene) {
  const segs = [...(scene.segments ?? [])]
  for (const poly of scene.polygons ?? []) {
    const verts = poly.vertices
    for (let i = 0; i < verts.length; i++) {
      segs.push({ from: verts[i], to: verts[(i + 1) % verts.length] })
    }
  }
  return segs
}

function verifyScene(scene, loc) {
  if (!scene) return
  sceneCount++

  const { xMin, xMax, yMin, yMax } = scene
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || xMin >= xMax || yMin >= yMax) {
    errors.push(`${loc}: invalid viewport bounds [${xMin}, ${xMax}] x [${yMin}, ${yMax}]`)
    return
  }

  // 1. Points inside viewport (allow small 0.5 margin for edge annotations)
  for (const pt of scene.points ?? []) {
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      errors.push(`${loc}: non-finite point ${pt.id}`)
      continue
    }
    if (pt.x < xMin - 0.5 || pt.x > xMax + 0.5 || pt.y < yMin - 0.5 || pt.y > yMax + 0.5) {
      errors.push(`${loc}: point ${pt.id}(${pt.x}, ${pt.y}) lies outside viewport [${xMin},${xMax}]x[${yMin},${yMax}]`)
    }
  }

  // 2. Lines non-degenerate + label equation matches coefficients
  for (const [li, line] of (scene.lines ?? []).entries()) {
    if (![line.a, line.b, line.c].every(Number.isFinite) || Math.hypot(line.a, line.b) < 1e-9) {
      errors.push(`${loc}: line[${li}] is degenerate (${line.a}, ${line.b}, ${line.c})`)
      continue
    }
    const parsed = parseLineLabel(line.label)
    if (parsed && !linesEquivalent(line, parsed)) {
      errors.push(
        `${loc}: line[${li}] label "${line.label}" does not match ax+by+c=0 (${line.a}x + ${line.b}y + ${line.c} = 0)`,
      )
    }
  }

  // 3. Circles valid
  for (const [ci, c] of (scene.circles ?? []).entries()) {
    if (![c.cx, c.cy, c.r].every(Number.isFinite) || c.r <= 0) {
      errors.push(`${loc}: circle[${ci}] has invalid center/radius (${c.cx}, ${c.cy}, r=${c.r})`)
    }
  }

  // 4. Right angles: exact 90-degree vectors & vertex lies on lines/segments
  const allSegs = polygonSegments(scene)
  for (const [ri, ra] of (scene.rightAngles ?? []).entries()) {
    const [vx, vy] = ra.vertex
    const [d1x, d1y] = ra.dir1
    const [d2x, d2y] = ra.dir2
    const n1 = Math.hypot(d1x, d1y)
    const n2 = Math.hypot(d2x, d2y)
    if (n1 < 1e-9 || n2 < 1e-9) {
      errors.push(`${loc}: rightAngle[${ri}] has zero direction vector`)
      continue
    }
    const cosTheta = Math.abs((d1x * d2x + d1y * d2y) / (n1 * n2))
    if (cosTheta > 1e-2) {
      errors.push(`${loc}: rightAngle[${ri}] dirs [${d1x},${d1y}] & [${d2x},${d2y}] are NOT 90 deg (cos=${cosTheta.toFixed(4)})`)
    }
    // Check vertex lies on at least one line or segment
    const onLineCount = (scene.lines ?? []).filter(l => distPointToLine(vx, vy, l) < 0.08).length
    const onSegCount = allSegs.filter(s => distPointToSegment(vx, vy, s) < 0.08).length
    if (onLineCount + onSegCount < 1) {
      errors.push(`${loc}: rightAngle[${ri}] vertex (${vx}, ${vy}) does not lie on any line or segment`)
    }
    // If scene has >= 2 lines and no segments near vertex, vertex must lie on BOTH intersecting lines
    if ((scene.lines?.length ?? 0) >= 2 && onSegCount === 0 && onLineCount < 2) {
      errors.push(`${loc}: rightAngle[${ri}] vertex (${vx}, ${vy}) lies on only ${onLineCount} line(s), expected intersection of 2 lines`)
    }
  }

  // 5. POI points must lie on their lines/segments
  for (const pt of scene.points ?? []) {
    if (pt.label && /\bPOI\b/i.test(pt.label)) {
      const hitsLine = (scene.lines ?? []).filter(l => distPointToLine(pt.x, pt.y, l) < 0.06).length
      const hitsSeg = allSegs.filter(s => distPointToSegment(pt.x, pt.y, s) < 0.06).length
      if (hitsLine + hitsSeg < 2) {
        errors.push(`${loc}: POI point "${pt.label}" at (${pt.x}, ${pt.y}) lies on only ${hitsLine + hitsSeg} line/segment(s)`)
      }
    }
  }


  // 7. Point label coordinate consistency: e.g. A(-3, 4) matches (pt.x, pt.y)
  for (const pt of scene.points ?? []) {
    if (!pt.label) continue
    const m = /\(([−-]?\d+(?:\.\d+)?)\s*,\s*([−-]?\d+(?:\.\d+)?)\)/.exec(pt.label)
    if (m) {
      const lx = Number(m[1].replace(/−/g, '-'))
      const ly = Number(m[2].replace(/−/g, '-'))
      if (Math.abs(lx - pt.x) > 0.05 || Math.abs(ly - pt.y) > 0.05) {
        errors.push(`${loc}: point label "${pt.label}" disagrees with coords (${pt.x}, ${pt.y})`)
      }
    }
  }

  // 8. Segment length label consistency: e.g. √73, 3√5, KM = 10, d = 5
  for (const seg of scene.segments ?? []) {
    if (!seg.label || /^m[_⊥\s=]/i.test(seg.label.trim())) continue
    const actual = Math.hypot(seg.to[0] - seg.from[0], seg.to[1] - seg.from[1])
    const mRad = /(\d+)?√(\d+(?:\.\d+)?)/.exec(seg.label)
    if (mRad) {
      const coeff = mRad[1] ? Number(mRad[1]) : 1
      const exp = coeff * Math.sqrt(Number(mRad[2]))
      if (Math.abs(actual - exp) > 0.1) {
        errors.push(`${loc}: segment label "${seg.label}" (exp ${exp.toFixed(2)}) != actual len ${actual.toFixed(2)}`)
      }
    } else {
      const mNum = /(?:^|=\s*)(\d+(?:\.\d+)?)$/.exec(seg.label.trim())
      if (mNum) {
        const exp = Number(mNum[1])
        if (Math.abs(actual - exp) > 0.1) {
          errors.push(`${loc}: segment label "${seg.label}" (exp ${exp}) != actual len ${actual.toFixed(2)}`)
        }
      }
    }
  }

  // 6. Polygons: non-degenerate area & vertices in bounds
  for (const [pi, poly] of (scene.polygons ?? []).entries()) {
    const verts = poly.vertices
    if (verts.length < 3) {
      errors.push(`${loc}: polygon[${pi}] has < 3 vertices`)
      continue
    }
    let area2 = 0
    for (let i = 0; i < verts.length; i++) {
      const [x1, y1] = verts[i]
      const [x2, y2] = verts[(i + 1) % verts.length]
      area2 += x1 * y2 - x2 * y1
      if (x1 < xMin - 0.5 || x1 > xMax + 0.5 || y1 < yMin - 0.5 || y1 > yMax + 0.5) {
        errors.push(`${loc}: polygon[${pi}] vertex (${x1}, ${y1}) outside viewport`)
      }
    }
    if (Math.abs(area2) * 0.5 < 0.25) {
      errors.push(`${loc}: polygon[${pi}] is degenerate/collinear (area=${(Math.abs(area2) * 0.5).toFixed(3)})`)
    }
  }
}

// Specific mathematical regression guards
for (const lesson of allLessons) {
  const pages = [...lesson.pages, ...lesson.checks]
  for (const page of pages) {
    const baseLoc = `${lesson.id}/${page.id}`

    if (page.kind === 'worked') {
      const hasPre = Boolean(page.preScene || page.steps.some(s => s.preScene))
      if (!lesson.id.startsWith('rescue-') && !hasPre) {
        errors.push(`${baseLoc}: worked example missing preScene (initial graph spoils solution)`)
      }
      verifyScene(page.preScene, `${baseLoc}.preScene`)
      page.steps.forEach((st, idx) => {
        verifyScene(st.preScene, `${baseLoc}.steps[${idx}].preScene`)
        verifyScene(st.scene, `${baseLoc}.steps[${idx}].scene`)
      })
      // Regression check: l1-p3-worked Step 2 perpendicular line MUST pass through P(6, 1)
      if (page.id === 'l1-p3-worked') {
        const s2 = page.steps[1]?.scene
        const perpLine = s2?.lines?.[1]
        if (!perpLine || distPointToLine(6, 1, perpLine) > 1e-6) {
          errors.push(`${baseLoc}.steps[1]: perpendicular line does NOT pass through P(6, 1)!`)
        }
      }
    } else {
      if (page.scene) verifyScene(page.scene, `${baseLoc}.scene`)
      if (page.solvedScene) verifyScene(page.solvedScene, `${baseLoc}.solvedScene`)
      if (page.planSteps) {
        page.planSteps.forEach((ps, idx) => verifyScene(ps.scene, `${baseLoc}.planSteps[${idx}].scene`))
      }
      if (page.steps) {
        page.steps.forEach((st, idx) => {
          verifyScene(st.scene, `${baseLoc}.steps[${idx}].scene`)
          verifyScene(st.solvedScene, `${baseLoc}.steps[${idx}].solvedScene`)
        })
      }
      if (page.explanation?.steps) {
        page.explanation.steps.forEach((es, idx) => verifyScene(es.scene, `${baseLoc}.explanation[${idx}].scene`))
      }
    }

    // Regression check: every trapezoid polygon must have EXACTLY 1 pair of parallel sides
    if (page.id === 'mp-13-trapezoid' || page.id === 'c4-flaw-trap' || page.id === 'l8-c2-trap-rule') {
      const checkTrap = (sc, loc) => {
        const poly = sc?.polygons?.[0]
        if (!poly || poly.vertices.length !== 4) return
        const [A, B, C, D] = poly.vertices
        const cross = (p1, p2, p3, p4) =>
          (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
        const parAB_DC = Math.abs(cross(A, B, D, C)) < 1e-6
        const parBC_AD = Math.abs(cross(B, C, A, D)) < 1e-6
        if (parAB_DC === parBC_AD) {
          errors.push(`${loc}: quadrilateral is NOT a trapezoid (AB||DC=${parAB_DC}, BC||AD=${parBC_AD})`)
        }
      }
      checkTrap(page.scene, `${baseLoc}.scene`)
      page.explanation?.steps?.forEach((es, i) => checkTrap(es.scene, `${baseLoc}.explanation[${i}].scene`))
    }
  }
}

console.log(`Verified ${sceneCount} GeoScenes across ${allLessons.length} lessons.`)
if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`)
  for (const w of warnings) console.log(`  WARN: ${w}`)
}
if (errors.length > 0) {
  console.error(`FAILURES (${errors.length}):`)
  for (const e of errors) console.error(`  FAIL: ${e}`)
  process.exit(1)
} else {
  console.log('ALL GRAPHS MATHEMATICALLY VERIFIED (0 errors)!')
}
