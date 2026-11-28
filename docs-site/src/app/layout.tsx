import type { ReactNode } from 'react'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { DOCS_BUILD_META } from '@/lib/buildMeta'
import './global.css'

export const metadata = {
  title: 'Syntax Extensions 2.0 Docs',
  description: 'Build courses, tools, and themes for Syntax.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider search={{ enabled: false }}>
          <DocsLayout
            tree={source.getPageTree()}
            nav={{
              title: `Syntax Docs (${DOCS_BUILD_META.shortSha})`,
            }}
            links={[
              { text: 'Syntax Dev', url: 'https://syntax-platform.github.io/syntax-dev/' },
              { text: 'Storybook', url: DOCS_BUILD_META.storybookUrl },
              { text: 'Source', url: `${DOCS_BUILD_META.sourceBase}/docs/extensions` },
            ]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
