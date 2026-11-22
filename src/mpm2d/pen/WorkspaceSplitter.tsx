import { useState, useRef } from 'react'

export type SplitterTension = 'none' | 'close' | 'fullscreen'

export function WorkspaceSplitter({
  orientation,
  flipped = false,
  fullscreen = false,
  tension = 'none',
  tensionAmount = 0,
  onDragStart,
  onDragEnd,
  onDelta,
  onReset,
  onExitFullscreen,
}: {
  orientation: 'vertical' | 'horizontal'
  flipped?: boolean
  fullscreen?: boolean
  tension?: SplitterTension
  tensionAmount?: number
  onDragStart: () => void
  onDragEnd: () => void
  onDelta: (clientPos: number) => void
  onReset: () => void
  onExitFullscreen?: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const draggingRef = useRef(false)
  const downPosRef = useRef(0)
  const movedRef = useRef(false)

  const showFullscreenCue = fullscreen && (isHovered || isDragging)
  const showTensionCue = !fullscreen && tension !== 'none'

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={fullscreen ? 'Show question' : 'Resize'}
      tabIndex={0}
      className="workspace-splitter"
      data-orientation={orientation}
      data-flipped={flipped || undefined}
      data-fullscreen={fullscreen || undefined}
      data-tension={tension !== 'none' ? tension : undefined}
      style={{ '--splitter-tension': tensionAmount.toFixed(3) } as React.CSSProperties}
      title={
        fullscreen
          ? 'Show question'
          : 'Drag to resize · Double-click to reset'
      }
      onDoubleClick={fullscreen ? onExitFullscreen : onReset}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={e => {
        e.preventDefault()
        draggingRef.current = true
        setIsDragging(true)
        movedRef.current = false
        downPosRef.current = orientation === 'vertical' ? e.clientX : e.clientY
        onDragStart()
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        if (!draggingRef.current) return
        const pos = orientation === 'vertical' ? e.clientX : e.clientY
        if (Math.abs(pos - downPosRef.current) > 4) {
          movedRef.current = true
        }
        onDelta(pos)
      }}
      onPointerUp={e => {
        if (!draggingRef.current) return
        draggingRef.current = false
        setIsDragging(false)
        const wasClick = !movedRef.current
        onDragEnd()
        try {
          ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
        if (fullscreen && wasClick) {
          onExitFullscreen?.()
        }
      }}
      onPointerCancel={() => {
        if (!draggingRef.current) return
        draggingRef.current = false
        setIsDragging(false)
        onDragEnd()
      }}
    >
      <span className="workspace-splitter-bar" aria-hidden="true" />

      {/* Brilliant quiet micro-label (compact, crisp, no pills or chunky icons) */}
      {showFullscreenCue && (
        <span className="workspace-splitter-cue workspace-splitter-cue-fs" aria-hidden="true">
          Show question
        </span>
      )}

      {showTensionCue && (
        <span
          className={`workspace-splitter-cue workspace-splitter-cue-${tension}`}
          aria-hidden="true"
        >
          {tension === 'close' ? 'Close' : 'Full screen'}
        </span>
      )}
    </div>
  )
}
