import type { ReactNode } from 'react'

/**
 * Clean typographic renderer for inline and display Grade 10 analytic geometry notation:
 * - **bold** spans
 * - Stacked fractions like 3/4, -4/3, −24/7 when `stackedFractions` is enabled
 * - Subscripts: m_AB, m_BC, m_⊥, m⊥, x₁, y₂, m₁, m₂
 * - Superscripts: x², y², r², a², b², c², ^2
 */
function renderMathTokens(text: string, stackedFractions: boolean, keyPrefix: string): ReactNode[] {
  // Match signed numeric fractions (e.g. -3/4, −4/3, 5/7), subscripted m_XX / m⊥, or ^2
  const pattern = stackedFractions
    ? /([−-]?\d+\/\d+)|(m_[A-Za-z⊥]+)|(m⊥)|([A-Za-z])_([A-Za-z0-9⊥]+)|(\^[0-9])/g
    : /(m_[A-Za-z⊥]+)|(m⊥)|([A-Za-z])_([A-Za-z0-9⊥]+)|(\^[0-9])/g

  const out: ReactNode[] = []
  let last = 0
  let idx = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      out.push(text.slice(last, match.index))
    }
    const full = match[0]
    const k = `${keyPrefix}-${idx++}`

    if (stackedFractions && match[1]) {
      const neg = full.startsWith('-') || full.startsWith('−')
      const clean = neg ? full.slice(1) : full
      const [num, den] = clean.split('/')
      out.push(
        <span key={k} className="m-frac-wrap">
          {neg && <span className="m-sign">−</span>}
          <span className="m-frac" aria-label={full}>
            <span className="m-num">{num}</span>
            <span className="m-den">{den}</span>
          </span>
        </span>,
      )
    } else if (full === 'm⊥') {
      out.push(
        <span key={k} className="m-sym">
          <em>m</em>
          <sub>⊥</sub>
        </span>,
      )
    } else if (full.includes('_')) {
      const [base, sub] = full.split('_')
      out.push(
        <span key={k} className="m-sym">
          <em>{base}</em>
          <sub>{sub}</sub>
        </span>,
      )
    } else if (full.startsWith('^')) {
      out.push(<sup key={k}>{full.slice(1)}</sup>)
    } else {
      out.push(full)
    }

    last = match.index + full.length
  }

  if (last < text.length) {
    out.push(text.slice(last))
  }
  return out
}

export function MathText({
  text,
  stackedFractions = false,
}: {
  text: string
  stackedFractions?: boolean
}) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i}>
              {renderMathTokens(part.slice(2, -2), stackedFractions, `b${i}`)}
            </strong>
          )
        }
        return <span key={i}>{renderMathTokens(part, stackedFractions, `t${i}`)}</span>
      })}
    </>
  )
}

/** Stacked fraction component for clean textbook equations (Formula Sheet, etc.) */
export function Frac({ num, den }: { num: ReactNode; den: ReactNode }) {
  return (
    <span className="m-frac m-frac-lg">
      <span className="m-num">{num}</span>
      <span className="m-den">{den}</span>
    </span>
  )
}

/** True radical with crisp horizontal overbar */
export function Sqrt({ children }: { children: ReactNode }) {
  return (
    <span className="m-sqrt">
      <span className="m-sqrt-sign" aria-hidden="true">√</span>
      <span className="m-sqrt-body">{children}</span>
    </span>
  )
}
