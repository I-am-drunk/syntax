import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
// @ts-expect-error winbox/src/js/winbox.js is pure ESM without type declarations
import WinBoxCtor from 'winbox/src/js/winbox.js'

type WinBoxInstance = import('winbox')
type WinBoxConstructor = typeof import('winbox')
const WinBox = WinBoxCtor as unknown as WinBoxConstructor
import 'winbox/dist/css/winbox.min.css'
import './winboxTheme.css'

export interface WinBoxWindowProps {
  id?: string
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
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null)
  const [actionsNode, setActionsNode] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Reset guard on mount (critical for React StrictMode double-invoke)
    closingProgrammaticallyRef.current = false

    const vw = window.innerWidth
    const vh = window.innerHeight
    const isPhone = vw <= 768
    const padX = isPhone ? 10 : 24
    const padTop = isPhone ? 70 : 76
    const padBottom = isPhone ? 12 : 20

    const availW = Math.max(260, vw - padX * 2)
    const availH = Math.max(240, vh - padTop - padBottom)
    const w = Math.min(defaultWidth, availW)
    const h = Math.min(defaultHeight, availH)
    const x = Math.max(padX, Math.round((vw - w) / 2))
    const y = Math.max(padTop, Math.round(padTop + (availH - h) / 2))

    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.body.getAttribute('data-theme') === 'dark'

    const classes = ['syntax-winbox', 'no-full']
    if (isDark) classes.push('is-dark')
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
      top: 66,
      bottom: 8,
      left: 6,
      right: 6,
      index: 900,
      header: 42,
      border: 0,
      onclose: () => {
        if (!closingProgrammaticallyRef.current) {
          onCloseRef.current()
        }
        return false
      },
    })

    boxRef.current = box
    setMountNode(box.body)

    const dom = box.dom as HTMLElement | undefined
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

    const handleViewportResize = () => {
      const b = boxRef.current as (WinBoxInstance & { minwidth?: number; minheight?: number }) | null
      if (!b || b.min || b.max) return
      const curVw = window.innerWidth
      const curVh = window.innerHeight
      const curPadX = curVw <= 768 ? 8 : 16
      const curTop = 66
      const maxW = Math.max(260, curVw - curPadX * 2)
      const maxH = Math.max(220, curVh - curTop - 12)
      b.minwidth = Math.min(minWidth, maxW)
      b.minheight = Math.min(minHeight, maxH)
      const curW = typeof b.width === 'number' ? b.width : defaultWidth
      const curH = typeof b.height === 'number' ? b.height : defaultHeight
      const nextW = Math.min(curW, maxW)
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

    window.addEventListener('resize', handleViewportResize)

    return () => {
      cleanupSlotListeners?.()
      window.removeEventListener('resize', handleViewportResize)
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
    const dom = box.dom as HTMLElement | undefined
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
