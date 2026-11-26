import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function rewritePublicCssUrls(base: string): Plugin {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return {
    name: 'syntax-rewrite-public-css-urls',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (normalizedBase === '/') return
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'asset' && chunk.fileName.endsWith('.css') && typeof chunk.source === 'string') {
          chunk.source = chunk.source.replace(
            /url\(\s*(['"]?)\/assets\//g,
            `url($1${normalizedBase}assets/`,
          )
        }
      }
    },
  }
}

export default defineConfig(() => {
  const base = process.env.VITE_BASE ?? '/'
  return {
    base,
    plugins: [react(), rewritePublicCssUrls(base)],
    server: {
      host: '0.0.0.0',
      port: 5189,
      strictPort: true,
      allowedHosts: true,
    },
  }
})
