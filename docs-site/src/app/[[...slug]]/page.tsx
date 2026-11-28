import { notFound } from 'next/navigation'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { source } from '@/lib/source'
import { DOCS_BUILD_META } from '@/lib/buildMeta'

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div
        data-syntax-docs-commit={DOCS_BUILD_META.commitSha}
        className="mb-4 text-xs text-fd-muted-foreground"
      >
        Nightly source: <code>{DOCS_BUILD_META.shortSha}</code> ({DOCS_BUILD_META.releaseTag})
      </div>
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}
