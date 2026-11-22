import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sema, type SemaLookPoint, type SemaState } from './Sema'

type RoamPhase = 'docked' | 'roaming' | 'returning'

const IDLE_TRIGGER_MS = 45_000
const HOVER_DELAY_MS = 380
const SEMA_SIZE = 34
const SEMA_HEIGHT = Math.round(SEMA_SIZE * 1.16)

export function TopBarSema({
  enableRoaming = true,
  scrollContainerRef,
  onPoke,
}: {
  enableRoaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement | null>
  onPoke?: () => void
}) {
  const dockRef = useRef<HTMLDivElement>(null)
  const roamHostRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<RoamPhase>('docked')
  const [hoverBubble, setHoverBubble] = useState(false)
  const [roamState, setRoamState] = useState<SemaState>('idle')
  const [roamLook, setRoamLook] = useState<SemaLookPoint | null>(null)

  const phaseRef = useRef<RoamPhase>('docked')
  phaseRef.current = phase

  const lastActivityRef = useRef<number>(Date.now())
  const hoverTimerRef = useRef<number>(0)
  const moodTimerRef = useRef<number>(0)

  const posRef = useRef({ x: 0, y: 0, vx: 98, vy: 82 })

  const clearHover = () => {
    window.clearTimeout(hoverTimerRef.current)
    setHoverBubble(false)
  }

  const handlePointerEnter = () => {
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverBubble(true)
    }, HOVER_DELAY_MS)
  }

  const launchRoaming = () => {
    if (phaseRef.current !== 'docked') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const rect = dockRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return

    const dirX = Math.random() > 0.5 ? 1 : -1
    posRef.current = {
      x: rect.left + (rect.width - SEMA_SIZE) / 2,
      y: rect.top + (rect.height - SEMA_HEIGHT) / 2,
      vx: dirX * (94 + Math.random() * 24),
      vy: 78 + Math.random() * 22,
    }
    clearHover()
    setRoamState('bobbing')
    setPhase('roaming')
  }

  const recallToDock = () => {
    if (phaseRef.current !== 'roaming') return
    clearHover()
    setRoamState('wink')
    setPhase('returning')
  }

  // If roaming is disabled (e.g., modal/lesson opens), dock immediately
  useEffect(() => {
    if (!enableRoaming && phaseRef.current !== 'docked') {
      setPhase('docked')
      setRoamState('idle')
      setRoamLook(null)
    }
  }, [enableRoaming])

  // Global idle & scroll/click tracker
  useEffect(() => {
    if (!enableRoaming) return
    lastActivityRef.current = Date.now()

    const bumpActivity = () => {
      lastActivityRef.current = Date.now()
    }

    const onScrollOrWheel = () => {
      lastActivityRef.current = Date.now()
      if (phaseRef.current === 'roaming') {
        recallToDock()
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      lastActivityRef.current = Date.now()
      if (phaseRef.current === 'roaming') {
        const host = roamHostRef.current
        if (!host || !host.contains(e.target as Node)) {
          recallToDock()
        }
      }
    }

    window.addEventListener('pointermove', bumpActivity, { passive: true })
    window.addEventListener('keydown', bumpActivity, { passive: true })
    window.addEventListener('wheel', onScrollOrWheel, { passive: true })
    window.addEventListener('pointerdown', onPointerDown)
    const scroller = scrollContainerRef?.current
    scroller?.addEventListener('scroll', onScrollOrWheel, { passive: true })

    const idleCheck = window.setInterval(() => {
      if (phaseRef.current !== 'docked') return
      if (document.hidden) return
      if (Date.now() - lastActivityRef.current >= IDLE_TRIGGER_MS) {
        launchRoaming()
      }
    }, 1000)

    return () => {
      window.removeEventListener('pointermove', bumpActivity)
      window.removeEventListener('keydown', bumpActivity)
      window.removeEventListener('wheel', onScrollOrWheel)
      window.removeEventListener('pointerdown', onPointerDown)
      scroller?.removeEventListener('scroll', onScrollOrWheel)
      window.clearInterval(idleCheck)
    }
  }, [enableRoaming, scrollContainerRef])

  // Roaming / returning physics loop (DVD Pong bounce + spring return to top bar)
  useEffect(() => {
    if (phase === 'docked') return
    let raf = 0
    let lastTs = performance.now()
    let lookUpdateAcc = 0

    const bounceMoods: SemaState[] = ['wink', 'celebrate', 'nudge', 'bobbing']
    let bounceIdx = 0

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) * 0.001))
      lastTs = now

      const p = posRef.current
      const host = roamHostRef.current

      if (phaseRef.current === 'roaming') {
        p.x += p.vx * dt
        p.y += p.vy * dt

        const minX = 16
        const maxX = Math.max(minX + 10, window.innerWidth - SEMA_SIZE - 16)
        const minY = 72 // Keep cleanly below top bar
        const maxY = Math.max(minY + 10, window.innerHeight - SEMA_HEIGHT - 16)

        let bounced = false
        if (p.x <= minX) {
          p.x = minX
          p.vx = Math.abs(p.vx)
          bounced = true
        } else if (p.x >= maxX) {
          p.x = maxX
          p.vx = -Math.abs(p.vx)
          bounced = true
        }

        if (p.y <= minY) {
          p.y = minY
          p.vy = Math.abs(p.vy)
          bounced = true
        } else if (p.y >= maxY) {
          p.y = maxY
          p.vy = -Math.abs(p.vy)
          bounced = true
        }

        if (bounced) {
          const mood = bounceMoods[bounceIdx % bounceMoods.length]!
          bounceIdx += 1
          setRoamState(mood)
          window.clearTimeout(moodTimerRef.current)
          moodTimerRef.current = window.setTimeout(() => {
            if (phaseRef.current === 'roaming') setRoamState('bobbing')
          }, 720)
        }

        lookUpdateAcc += dt
        if (lookUpdateAcc > 0.14) {
          lookUpdateAcc = 0
          const mag = Math.hypot(p.vx, p.vy) || 1
          setRoamLook({ x: (p.vx / mag) * 0.72, y: (p.vy / mag) * 0.62 })
        }

        if (host) {
          host.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
        }
      } else if (phaseRef.current === 'returning') {
        const rect = dockRef.current?.getBoundingClientRect()
        const tx = rect ? rect.left + (rect.width - SEMA_SIZE) / 2 : 140
        const ty = rect ? rect.top + (rect.height - SEMA_HEIGHT) / 2 : 12

        const k = 1 - Math.exp(-10.5 * dt)
        p.x += (tx - p.x) * k
        p.y += (ty - p.y) * k

        if (host) {
          host.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`
        }

        if (Math.hypot(tx - p.x, ty - p.y) < 2.2) {
          setPhase('docked')
          setRoamState('idle')
          setRoamLook(null)
          lastActivityRef.current = Date.now()
          return
        }
      }

      raf = requestAnimationFrame(step)
    }

    if (roamHostRef.current) {
      roamHostRef.current.style.transform = `translate3d(${posRef.current.x.toFixed(1)}px, ${posRef.current.y.toFixed(1)}px, 0)`
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(moodTimerRef.current)
    }
  }, [phase])

  useEffect(() => {
    return () => {
      window.clearTimeout(hoverTimerRef.current)
      window.clearTimeout(moodTimerRef.current)
    }
  }, [])

  return (
    <>
      <div
        ref={dockRef}
        className="sema-topbar-dock"
        onPointerEnter={phase === 'docked' ? handlePointerEnter : undefined}
        onPointerLeave={phase === 'docked' ? clearHover : undefined}
        onDoubleClick={() => {
          if (phase === 'docked' && enableRoaming) launchRoaming()
        }}
      >
        {phase === 'docked' ? (
          <div className="sema-bubble-anchor">
            <Sema
              state="idle"
              size={SEMA_SIZE}
              interactive
              ariaLabel="Sema — hover to say hi, drag to stretch, double-click to roam"
              onPoke={() => {
                clearHover()
                onPoke?.()
              }}
            />
            {hoverBubble && (
              <div className="sema-speech-bubble" data-placement="bottom" role="tooltip">
                Hi, I’m Sema
              </div>
            )}
          </div>
        ) : (
          <span className="sema-topbar-dock-ghost" aria-hidden="true" />
        )}
      </div>

      {phase !== 'docked' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={roamHostRef}
            className="sema-roam-layer"
            onPointerEnter={handlePointerEnter}
            onPointerLeave={clearHover}
          >
            <div className="sema-bubble-anchor">
              <Sema
                state={roamState}
                size={SEMA_SIZE + 6}
                interactive
                followCursor={false}
                lookAt={roamLook}
                ariaLabel="Roaming Sema — click or scroll to bring back"
                onPoke={() => {
                  onPoke?.()
                  recallToDock()
                }}
              />
              {hoverBubble && (
                <div className="sema-speech-bubble" data-placement="top" role="tooltip">
                  Hi, I’m Sema
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
