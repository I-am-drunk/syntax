import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CompletionFrame } from '../../lessons/CompletionFrame'
import { useCompletionAnimation } from '../../lessons/useCompletionAnimation'
import type { LessonSound } from '../../services/lessonSounds'

export function GeoCompletion({
  title,
  color,
  riveColor,
  levelNumber,
  correctCount,
  totalCount,
  onContinue,
  onSound,
}: {
  title: string
  color: string
  riveColor: number
  levelNumber: number
  correctCount: number
  totalCount: number
  onContinue: () => void
  onSound?: (cue: LessonSound) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const soundPlayedRef = useRef(false)
  const mastered = totalCount === 0 || correctCount === totalCount

  const playOnce = () => {
    if (soundPlayedRef.current) return
    soundPlayedRef.current = true
    onSound?.(mastered ? 'lesson-complete' : 'skill-check-failed')
  }

  const canvas = useCompletionAnimation({
    color: riveColor,
    levelNumber,
    mastered,
    onReveal: () => setRevealed(true),
    onError: () => {
      playOnce()
      setRevealed(true)
    },
    onTransition: () => playOnce(),
  })

  useEffect(() => {
    if (revealed) return
    const timer = setTimeout(() => {
      playOnce()
      setRevealed(true)
    }, 2200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])

  return (
    <CompletionFrame onContinue={onContinue} color={color}>
      <div className="completion-art">
        <div className="completion-canvas">
          <canvas ref={canvas} aria-hidden="true" />
        </div>
      </div>
      <div className="completion-copy">
        {revealed && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
              <h1>{title}</h1>
            </motion.div>
            {totalCount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
                <div className="completion-stats">
                  <div className="completion-stat">
                    <div className="completion-stat-gradient" />
                    <div className="completion-stat-value">
                      <div className="completion-stat-number">
                        <span className="completion-number">{correctCount}</span>
                        <span className="completion-denominator">/{totalCount}</span>
                      </div>
                    </div>
                    <span className="completion-stat-label">Checks</span>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </CompletionFrame>
  )
}
