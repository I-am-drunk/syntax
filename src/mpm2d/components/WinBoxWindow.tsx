import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
// @ts-expect-error winbox ESM module ships without declaration file
import WinBox from 'winbox/src/js/winbox'
import 'winbox/dist/css/winbox.min.css'
import './winboxTheme.css'
import { loadPrefs } from '../storage'

type WinBoxInstance = InstanceType<typeof WinBox> & {
  x?: number
  y?: number
  width?: number
  height?: number
  minwidth?: number
  minheight?: number
  min?: boolean
  max?: boolean
  dom?: HTMLElement
}

export type WinBoxWindowProps = {
  id: string
  eyebrow?: string
  title: string
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  className?: string
  /** Optional interactive controls portaled into the WinBox titlebar next to the close button */
  headerActions?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

type DragSample = { t: number; x: number; y: number }

export function WinBoxWindow({
  id,
  eyebrow,
  title,
  defaultWidth = 650,
  defaultHeight = 610,
  minWidth = 310,
  minHeight = 320,
  className = '',
  headerActions,
  onClose,
  children,
}: WinBoxWindowProps) {
  const boxRef = useRef<WinBoxInstance | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closingProgrammaticallyRef = useRef(false)
  const inertiaEnabledRef = useRef<boolean>(loadPrefs().windowInertia)
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null)
  const [actionsNode, setActionsNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncInertiaPref = () => {
      inertiaEnabledRef.current = loadPrefs().windowInertia
    }
    window.addEventListener('syntax:prefs-changed', syncInertiaPref)
    window.addEventListener('storage', syncInertiaPref)
    return () => {
      window.removeEventListener('syntax:prefs-changed', syncInertiaPref)
      window.removeEventListener('storage', syncInertiaPref)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Reset guard on mount (critical for React StrictMode double-invoke)
    closingProgrammaticallyRef.current = false

    const vw = window.innerWidth
    const vh = window.innerHeight
    const isPhone = vw <= 680
    const padX = isPhone ? 8 : vw <= 900 ? 14 : 24
    const padTop = isPhone ? 62 : 74
    const padBottom = isPhone ? 10 : 18

    const availW = Math.max(260, vw - padX * 2)
    const availH = Math.max(240, vh - padTop - padBottom)
    const w = isPhone ? availW : Math.min(defaultWidth, availW)
    const h = Math.min(defaultHeight, availH)
    const x = Math.max(padX, Math.round((vw - w) / 2))
    const y = Math.max(padTop, Math.round(padTop + (availH - h) / 2))

    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.getAttribute('data-theme') === 'dark'

    const classes = ['syntax-winbox', 'no-full']
    if (isDark) classes.push('is-dark')
    if (isPhone) classes.push('is-mobile-sheet')
    if (className) {
      className
        .split(/\s+/)
        .filter(Boolean)
        .forEach(c => classes.push(c))
    }

    const box = new WinBox({
      id,
      title,
      class: classes,
      width: w,
      height: h,
      minwidth: Math.min(minWidth, availW),
      minheight: Math.min(minHeight, availH),
      x,
      y,
      top: isPhone ? 58 : 66,
      bottom: 8,
      left: 6,
      right: 6,
      index: 900,
      header: isPhone ? 46 : 42,
      border: 0,
      onclose: () => {
        if (!closingProgrammaticallyRef.current) {
          onCloseRef.current()
        }
        return false
      },
    }) as WinBoxInstance

    boxRef.current = box
    setMountNode(box.body)

    const dom = box.dom
    if (dom) {
      dom.setAttribute('role', 'dialog')
      dom.setAttribute('aria-label', eyebrow ? `${eyebrow} ${title}` : title)
    }

    const headerEl = dom?.querySelector('.wb-header') as HTMLElement | null
    const controlEl = dom?.querySelector('.wb-control') as HTMLElement | null
    let cleanupSlotListeners: (() => void) | null = null
    if (headerEl && controlEl) {
      const slot = document.createElement('div')
      slot.className = 'wb-header-actions'
      const stopDrag = (ev: Event) => ev.stopPropagation()
      slot.addEventListener('pointerdown', stopDrag)
      slot.addEventListener('mousedown', stopDrag)
      slot.addEventListener('touchstart', stopDrag, { passive: true })
      slot.addEventListener('dblclick', stopDrag)
      cleanupSlotListeners = () => {
        slot.removeEventListener('pointerdown', stopDrag)
        slot.removeEventListener('mousedown', stopDrag)
        slot.removeEventListener('touchstart', stopDrag)
        slot.removeEventListener('dblclick', stopDrag)
      }
      controlEl.insertAdjacentElement('afterend', slot)
      setActionsNode(slot)
    }

    // 144Hz+ Windows-style smooth inertia/momentum slide when releasing a dragged WinBox
    let inertiaRaf = 0
    let draggingHeader = false
    const samples: DragSample[] = []

    const stopInertia = () => {
      if (inertiaRaf) {
        cancelAnimationFrame(inertiaRaf)
        inertiaRaf = 0
      }
      dom?.classList.remove('is-gliding')
    }

    const dragHandle = dom?.querySelector('.wb-drag') as HTMLElement | null

    const onDragPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return
      stopInertia()
      const b = boxRef.current
      if (!b || b.min || b.max) return
      draggingHeader = true
      samples.length = 0
      samples.push({ t: performance.now(), x: ev.clientX, y: ev.clientY })
    }

    const onDragPointerMove = (ev: PointerEvent) => {
      if (!draggingHeader) return
      const now = performance.now()
      samples.push({ t: now, x: ev.clientX, y: ev.clientY })
      // Keep only the most recent ~85ms of samples for responsive 144Hz flick velocity
      while (samples.length > 2 && now - samples[0]!.t > 85) {
        samples.shift()
      }
    }

    const onDragPointerUp = () => {
      if (!draggingHeader) return
      draggingHeader = false
      const b = boxRef.current
      if (!b || b.min || b.max || !inertiaEnabledRef.current) return
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      if (samples.length < 2) return

      const now = performance.now()
      const last = samples[samples.length - 1]!
      // If pointer paused before releasing, do not fling
      if (now - last.t > 55) return
      const first = samples[0]!
      const spanSec = Math.max(0.012, (last.t - first.t) / 1000)
      let vx = (last.x - first.x) / spanSec
      let vy = (last.y - first.y) / spanSec
      const speed = Math.hypot(vx, vy)
      if (speed < 115) return

      // Cap extreme flick speed so glide stays crisp and controllable
      const maxSpeed = 2600
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed
        vx *= scale
        vy *= scale
      }

      const curW = typeof b.width === 'number' ? b.width : dom?.offsetWidth || defaultWidth
      const curH = typeof b.height === 'number' ? b.height : dom?.offsetHeight || defaultHeight
      let px = typeof b.x === 'number' ? b.x : dom?.getBoundingClientRect().left || 0
      let py = typeof b.y === 'number' ? b.y : dom?.getBoundingClientRect().top || 66
      let prevTime = performance.now()

      dom?.classList.add('is-gliding')

      const step = (ts: number) => {
        const currentBox = boxRef.current
        if (!currentBox || currentBox.min || currentBox.max || !inertiaEnabledRef.current) {
          stopInertia()
          return
        }
        // Clamp dt so tab switches never cause a jump; sub-ms precision for 144Hz/240Hz
        const dt = Math.min(0.032, Math.max(0.001, (ts - prevTime) / 1000))
        prevTime = ts

        px += vx * dt
        py += vy * dt

        // Frame-rate independent exponential friction (buttery at 60Hz, 120Hz, 144Hz, 240Hz)
        const friction = Math.exp(-6.8 * dt)
        vx *= friction
        vy *= friction

        const minX = 6
        const maxX = Math.max(minX, window.innerWidth - curW - 6)
        const minY = window.innerWidth <= 680 ? 58 : 66
        const maxY = Math.max(minY, window.innerHeight - curH - 8)

        // Soft cushioned bounce off viewport walls
        if (px < minX) {
          px = minX
          vx = -vx * 0.28
        } else if (px > maxX) {
          px = maxX
          vx = -vx * 0.28
        }
        if (py < minY) {
          py = minY
          vy = -vy * 0.28
        } else if (py > maxY) {
          py = maxY
          vy = -vy * 0.28
        }

        currentBox.move(Math.round(px), Math.round(py))

        if (Math.hypot(vx, vy) < 14) {
          stopInertia()
          return
        }
        inertiaRaf = requestAnimationFrame(step)
      }

      inertiaRaf = requestAnimationFrame(step)
    }

    const onDomPointerDown = () => {
      stopInertia()
    }

    dragHandle?.addEventListener('pointerdown', onDragPointerDown)
    dom?.addEventListener('pointerdown', onDomPointerDown, true)
    window.addEventListener('pointermove', onDragPointerMove, { passive: true })
    window.addEventListener('pointerup', onDragPointerUp, { passive: true })
    window.addEventListener('pointercancel', onDragPointerUp, { passive: true })

    const handleViewportResize = () => {
      stopInertia()
      const b = boxRef.current
      if (!b || b.min || b.max) return
      const curVw = window.innerWidth
      const curVh = window.innerHeight
      const nowPhone = curVw <= 680
      if (nowPhone) b.addClass('is-mobile-sheet')
      else b.removeClass('is-mobile-sheet')

      const curPadX = nowPhone ? 8 : 16
      const curTop = nowPhone ? 58 : 66
      const maxW = Math.max(260, curVw - curPadX * 2)
      const maxH = Math.max(220, curVh - curTop - 12)
      b.minwidth = Math.min(minWidth, maxW)
      b.minheight = Math.min(minHeight, maxH)
      const curW = typeof b.width === 'number' ? b.width : defaultWidth
      const curH = typeof b.height === 'number' ? b.height : defaultHeight
      const nextW = nowPhone ? maxW : Math.min(curW, maxW)
      const nextH = Math.min(curH, maxH)
      const curX = typeof b.x === 'number' ? b.x : curPadX
      const curY = typeof b.y === 'number' ? b.y : curTop
      const nextX = Math.max(curPadX, Math.min(curX, curVw - nextW - curPadX))
      const nextY = Math.max(curTop, Math.min(curY, curVh - nextH - 8))
      if (nextW !== curW || nextH !== curH) {
        b.resize(nextW, nextH)
      }
      if (nextX !== curX || nextY !== curY) {
        b.move(nextX, nextY)
      }
    }

    const syncTheme = () => {
      const b = boxRef.current
      if (!b) return
      const darkNow =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.body.getAttribute('data-theme') === 'dark'
      if (darkNow) {
        b.addClass('is-dark')
      } else {
        b.removeClass('is-dark')
      }
    }
    const themeObserver = new MutationObserver(syncTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const myDom = boxRef.current?.dom
      if (!myDom) return
      // Only let the highest-z visible WinBox handle Escape when multiple are open
      const myZ = Number(window.getComputedStyle(myDom).zIndex) || 0
      const allBoxes = Array.from(document.querySelectorAll<HTMLElement>('.winbox'))
      const topZ = allBoxes.reduce((max, el) => Math.max(max, Number(window.getComputedStyle(el).zIndex) || 0), 0)
      if (myZ < topZ) return
      if (document.querySelector('[role="menu"]')) return
      e.preventDefault()
      onCloseRef.current()
    }

    window.addEventListener('resize', handleViewportResize)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      stopInertia()
      dragHandle?.removeEventListener('pointerdown', onDragPointerDown)
      dom?.removeEventListener('pointerdown', onDomPointerDown, true)
      window.removeEventListener('pointermove', onDragPointerMove)
      window.removeEventListener('pointerup', onDragPointerUp)
      window.removeEventListener('pointercancel', onDragPointerUp)
      cleanupSlotListeners?.()
      window.removeEventListener('resize', handleViewportResize)
      window.removeEventListener('keydown', handleKeyDown)
      themeObserver.disconnect()
      closingProgrammaticallyRef.current = true
      setMountNode(null)
      setActionsNode(null)
      try {
        box.close(true)
      } catch {
        // ignore
      }
      boxRef.current = null
    }
  }, [])

  // Update structured title DOM with eyebrow-first truncation
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const dom = box.dom
    if (!dom) return
    dom.setAttribute('aria-label', eyebrow ? `${eyebrow} ${title}` : title)
    const titleEl = dom.querySelector('.wb-title') as HTMLElement | null
    if (!titleEl) {
      box.setTitle(eyebrow ? `${eyebrow} · ${title}` : title)
      return
    }
    titleEl.innerHTML = ''
    if (eyebrow) {
      const eyeSpan = document.createElement('span')
      eyeSpan.className = 'wb-title-eyebrow'
      eyeSpan.textContent = eyebrow
      eyeSpan.title = `${eyebrow} · ${title}`
      const sepSpan = document.createElement('span')
      sepSpan.className = 'wb-title-sep'
      sepSpan.textContent = '·'
      titleEl.appendChild(eyeSpan)
      titleEl.appendChild(sepSpan)
    }
    const mainSpan = document.createElement('span')
    mainSpan.className = 'wb-title-main'
    mainSpan.textContent = title
    mainSpan.title = title
    titleEl.appendChild(mainSpan)
  }, [eyebrow, title, mountNode])

  if (!mountNode) return null
  return (
    <>
      {createPortal(children, mountNode)}
      {actionsNode && headerActions ? createPortal(headerActions, actionsNode) : null}
    </>
  )
}
