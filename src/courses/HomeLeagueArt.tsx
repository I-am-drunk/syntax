import { useEffect, useRef, useState } from 'react'
import { Rive, RuntimeLoader } from '@rive-app/webgl2'
import { assetUrl } from '../mpm2d/assetUrl'

RuntimeLoader.setWasmUrl(assetUrl('/assets/completion/rive.449izq9w_ee8i.wasm'))
RuntimeLoader.setWasmFallbackUrl(null)

export function HomeLeagueArt() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    let animation: Rive | undefined
    let disposed = false
    let loaded = false
    let revealFrame = 0
    const request = new AbortController()
    const resize = () => {
      if (!animation || !loaded) return
      if (!element.clientWidth || !element.clientHeight) { animation.pause(); return }
      animation.resizeDrawingSurfaceToCanvas()
      if (document.documentElement.dataset.reducedMotion === 'true') animation.pause()
      else animation.play()
    }
    const sizes = new ResizeObserver(resize)
    sizes.observe(element)
    const motion = new MutationObserver(resize)
    motion.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] })
    const load = async () => {
      try {
        const response = await fetch(assetUrl('/assets/home/leagues-badges.45867fa0.riv'), { signal: request.signal })
        if (!response.ok) return
        const buffer = await response.arrayBuffer()
        if (disposed) return
        animation = new Rive({ canvas: element, buffer, stateMachines: 'leagueBadges',
          autoplay: false, useOffscreenRenderer: true,
          onLoadError: () => { if (!disposed) setReady(false) },
          onLoad: () => {
            if (disposed || !animation) return
            loaded = true
            const inputs = animation.stateMachineInputs('leagueBadges')
            const level = inputs?.find(input => input.name === 'level_Number')
            if (level) level.value = 1
            resize()
            inputs?.find(input => input.name === 'stagnant')?.fire()
            revealFrame = requestAnimationFrame(() => { if (!disposed) setReady(true) })
          },
        })
      } catch { /* Keep the source-derived still if animation cannot load. */ }
    }
    void load()
    return () => {
      disposed = true
      request.abort()
      sizes.disconnect()
      motion.disconnect()
      cancelAnimationFrame(revealFrame)
      animation?.cleanup()
    }
  }, [])
  return <span className="home-league-art" role="img" aria-label="Hydrogen League badge" data-ready={ready}>
    <img src={assetUrl('/assets/home/hydrogen-badge.png')} width="112" height="112" alt="" />
    <canvas ref={canvas} width="112" height="112" aria-hidden="true" />
  </span>
}
