import { createShapeId, toRichText, type Editor, type TLShapeId } from 'tldraw'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥']

export function stampPlanTemplate(editor: Editor, steps: string[]) {
  const cleanSteps =
    steps.length > 0
      ? steps
      : ['Sketch & label given points', 'Find slope / midpoint', 'Substitute & solve', 'State conclusion']

  const vp = editor.getViewportPageBounds()
  let startX = vp.x + 56
  let startY = vp.y + 72

  // Avoid stamping directly on top of existing ink near the top-left of the current viewport
  const pageBounds = editor.getCurrentPageBounds()
  if (
    pageBounds &&
    pageBounds.minX < startX + 260 &&
    pageBounds.maxX > startX - 20 &&
    pageBounds.minY < startY + 120 &&
    pageBounds.maxY > startY - 20
  ) {
    startY = pageBounds.maxY + 52
  }

  editor.run(() => {
    editor.markHistoryStoppingPoint('stamp-plan')
    const created: TLShapeId[] = []

    const titleId = createShapeId()
    created.push(titleId)
    editor.createShape({
      id: titleId,
      type: 'text',
      x: startX,
      y: startY,
      props: {
        richText: toRichText('Plan'),
        color: 'grey',
        size: 's',
        font: 'sans',
        textAlign: 'start',
        autoSize: true,
      },
    })

    const laneGap = 136
    cleanSteps.forEach((step, idx) => {
      const id = createShapeId()
      created.push(id)
      const label = `${CIRCLED[idx] ?? `${idx + 1}.`}  ${step.replace(/\.$/, '')}`
      editor.createShape({
        id,
        type: 'text',
        x: startX,
        y: startY + 34 + idx * laneGap,
        props: {
          richText: toRichText(label),
          color: 'grey',
          size: 's',
          font: 'sans',
          textAlign: 'start',
          autoSize: true,
        },
      })
    })

    const thereforeId = createShapeId()
    created.push(thereforeId)
    editor.createShape({
      id: thereforeId,
      type: 'text',
      x: startX,
      y: startY + 34 + cleanSteps.length * laneGap,
      props: {
        richText: toRichText('∴  Therefore, '),
        color: 'grey',
        size: 's',
        font: 'sans',
        textAlign: 'start',
        autoSize: true,
      },
    })

    editor.selectNone()
    editor.setCurrentTool('draw')
  })
}

export function stampCoordinateAxes(editor: Editor) {
  const vp = editor.getViewportPageBounds()
  const cx = vp.maxX - 160
  const cy = vp.y + 170
  const arm = 96

  editor.run(() => {
    editor.markHistoryStoppingPoint('stamp-axes')
    const xAxisId = createShapeId()
    const yAxisId = createShapeId()
    const xLabelId = createShapeId()
    const yLabelId = createShapeId()

    editor.createShapes([
      {
        id: xAxisId,
        type: 'arrow',
        x: cx,
        y: cy,
        props: {
          color: 'grey',
          size: 's',
          dash: 'solid',
          start: { x: -arm, y: 0 },
          end: { x: arm, y: 0 },
          arrowheadStart: 'none',
          arrowheadEnd: 'arrow',
        },
      },
      {
        id: yAxisId,
        type: 'arrow',
        x: cx,
        y: cy,
        props: {
          color: 'grey',
          size: 's',
          dash: 'solid',
          start: { x: 0, y: arm },
          end: { x: 0, y: -arm },
          arrowheadStart: 'none',
          arrowheadEnd: 'arrow',
        },
      },
      {
        id: xLabelId,
        type: 'text',
        x: cx + arm + 6,
        y: cy - 12,
        props: {
          richText: toRichText('x'),
          color: 'grey',
          size: 's',
          font: 'serif',
          textAlign: 'start',
          autoSize: true,
        },
      },
      {
        id: yLabelId,
        type: 'text',
        x: cx + 8,
        y: cy - arm - 18,
        props: {
          richText: toRichText('y'),
          color: 'grey',
          size: 's',
          font: 'serif',
          textAlign: 'start',
          autoSize: true,
        },
      },
    ])

    editor.groupShapes([xAxisId, yAxisId, xLabelId, yLabelId])
    editor.selectNone()
    editor.setCurrentTool('draw')
  })
}
