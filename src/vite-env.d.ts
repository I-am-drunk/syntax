/// <reference types="vite/client" />

declare module 'eruda' {
  const eruda: {
    init: (opts?: Record<string, unknown>) => void
    destroy: () => void
    add: (plugin: unknown) => void
    position: (pos: { x: number; y: number }) => void
    get: (name?: string) => unknown
    show: (name?: string) => void
  }
  export default eruda
}

declare module 'eruda-monitor' {
  const erudaMonitor: unknown
  export default erudaMonitor
}

declare module 'eruda-touches' {
  const erudaTouches: unknown
  export default erudaTouches
}
