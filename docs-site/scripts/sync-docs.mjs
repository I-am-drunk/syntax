import { execSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(siteRoot, '..')
const contentDir = resolve(siteRoot, 'content/docs')

function resolveCommitSha() {
  const fromEnv = process.env.SYNTAX_DOCS_COMMIT?.trim()
  if (fromEnv && /^[0-9a-f]{40}$/i.test(fromEnv)) return fromEnv.toLowerCase()
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'main'
  }
}

const commitSha = resolveCommitSha()
const shortSha = commitSha === 'main' ? 'main' : commitSha.slice(0, 8)
const releaseTag = process.env.SYNTAX_DOCS_RELEASE_TAG?.trim() || `dev-${shortSha}`
const sourceBase = `https://github.com/syntax-platform/syntax/blob/${commitSha}`
const storybookUrl = process.env.SYNTAX_STORYBOOK_URL?.trim() || 'https://syntax-platform.github.io/syntax-dev/storybook/'

function stripLeadingH1(markdown) {
  return markdown.replace(/^\uFEFF?# [^\r\n]+\r?\n+/, '')
}

function rewriteCanonicalLinks(markdown) {
  return markdown
    .replaceAll('](BUILD-A-COURSE.md)', '](/build-a-course/)')
    .replaceAll('](BUILD-A-TOOL.md)', '](/build-a-tool/)')
    .replaceAll('](NATIVE-AUTHORING.md)', '](/native-authoring/)')
    .replace(/\]\(MASTER-PLAN\.md(#[^)]+)?\)/g, (_match, fragment = '') =>
      `](${sourceBase}/docs/extensions/MASTER-PLAN.md${fragment})`)
    .replace(/\]\(\.\.\/\.\.\/([^)]+)\)/g, (_match, relPath) => `](${sourceBase}/${relPath})`)
}

async function main() {
  await mkdir(contentDir, { recursive: true })
  await mkdir(resolve(siteRoot, 'src/lib'), { recursive: true })

  await writeFile(
    resolve(siteRoot, 'src/lib/buildMeta.ts'),
    `export const DOCS_BUILD_META = {
  commitSha: ${JSON.stringify(commitSha)},
  shortSha: ${JSON.stringify(shortSha)},
  releaseTag: ${JSON.stringify(releaseTag)},
  sourceBase: ${JSON.stringify(sourceBase)},
  storybookUrl: ${JSON.stringify(storybookUrl)},
} as const
`,
  )

  const [courseMd, toolMd, authoringMd] = await Promise.all([
    readFile(resolve(repoRoot, 'docs/extensions/BUILD-A-COURSE.md'), 'utf8'),
    readFile(resolve(repoRoot, 'docs/extensions/BUILD-A-TOOL.md'), 'utf8'),
    readFile(resolve(repoRoot, 'docs/extensions/NATIVE-AUTHORING.md'), 'utf8'),
  ])

  await writeFile(
    resolve(contentDir, 'meta.json'),
    JSON.stringify({
      title: 'Syntax Extensions 2.0',
      pages: ['index', 'build-a-course', 'build-a-tool', 'native-authoring', 'storybook'],
    }, null, 2) + '\n',
  )

  await writeFile(
    resolve(contentDir, 'index.mdx'),
    `---
title: Syntax Extensions 2.0
description: Rolling documentation for building courses, tools, and themes on Syntax Dev.
---

This rolling documentation site describes Nightly build \`${shortSha}\` (\`${releaseTag}\`). The live Dev app can run a different commit after an on-demand deployment.

- **Exact source commit**: [\`${commitSha}\`](${sourceBase}/docs/extensions/MASTER-PLAN.md)
- **Live Syntax Dev**: [syntax-platform.github.io/syntax-dev](https://syntax-platform.github.io/syntax-dev/)
- **Live Component & Example Storybook**: [Open Storybook](${storybookUrl})

## Start Building

- [Build a Course](/build-a-course/): Scaffold the subject-neutral course starter with \`--course\`, build a lesson with \`@syntax/ui\`, bundle lesson diagrams, and publish with separate listing screenshots.
- [Build a Tool](/build-a-tool/): Create a standalone tool with a screen, \`Ctrl+K\` command, optional course tools, or an opt-in global theme.
- [Native Runtime Reference](/native-authoring/): Manifest validation, trust review, crash recovery, and host contracts.
- [UI & Example Storybook](/storybook/): Interactive \`@syntax/ui\` controls, learning primitives, and runnable course and tool examples.

## Stable Source Links for Authors & Agents

- Canonical Course Guide: [docs/extensions/BUILD-A-COURSE.md](${sourceBase}/docs/extensions/BUILD-A-COURSE.md)
- Canonical Tool Guide: [docs/extensions/BUILD-A-TOOL.md](${sourceBase}/docs/extensions/BUILD-A-TOOL.md)
- Native Extension API Types: [src/extensions/native/api.ts](${sourceBase}/src/extensions/native/api.ts)
- Shared \`@syntax/api\` & \`@syntax/ui\` Types: [src/extensions/native/sdk-types.d.ts](${sourceBase}/src/extensions/native/sdk-types.d.ts)
- Subject-Neutral Course Starter: [templates/native-course/](${sourceBase}/templates/native-course)
- Tool Starter: [templates/native-extension/](${sourceBase}/templates/native-extension)
- Repository Agent Skill (Courses): [.agents/skills/syntax-build-course/SKILL.md](${sourceBase}/.agents/skills/syntax-build-course/SKILL.md)
- Repository Agent Skill (Tools): [.agents/skills/syntax-build-tool/SKILL.md](${sourceBase}/.agents/skills/syntax-build-tool/SKILL.md)

## Reviewed Guides vs Generated Wikis

Generated wikis such as DeepWiki can help browse repository structure, but their indexed revision can lag behind the rolling Dev build by several days. Keep these PR-reviewed guides and the commit-pinned TypeScript contracts above as the source of truth for building and testing against Syntax Dev.
`,
  )

  await writeFile(
    resolve(contentDir, 'build-a-course.mdx'),
    `---
title: Build a Course
description: Go from a fresh checkout to a published native v2 course in Syntax Dev Library.
---

> Source commit: [\`${shortSha}\`](${sourceBase}/docs/extensions/BUILD-A-COURSE.md)

${rewriteCanonicalLinks(stripLeadingH1(courseMd))}
`,
  )

  await writeFile(
    resolve(contentDir, 'build-a-tool.mdx'),
    `---
title: Build a Tool
description: Build a standalone screen, command, optional course tool, or opt-in theme for Syntax Dev.
---

> Source commit: [\`${shortSha}\`](${sourceBase}/docs/extensions/BUILD-A-TOOL.md)

${rewriteCanonicalLinks(stripLeadingH1(toolMd))}
`,
  )

  await writeFile(
    resolve(contentDir, 'native-authoring.mdx'),
    `---
title: Native Runtime Reference
description: Local authoring, manifest checking, crash isolation, and direct install links.
---

> Source commit: [\`${shortSha}\`](${sourceBase}/docs/extensions/NATIVE-AUTHORING.md)

${rewriteCanonicalLinks(stripLeadingH1(authoringMd))}
`,
  )

  await writeFile(
    resolve(contentDir, 'storybook.mdx'),
    `---
title: UI & Example Storybook
description: Interactive @syntax/ui controls, learning primitives, and runnable course and tool examples.
---

Syntax exposes a live \`@syntax/ui\` module to installed native extensions so courses and tools stay visually cohesive and pick up host UI improvements without rebuilding.

- **Open live Storybook**: [${storybookUrl}](${storybookUrl})
- **Run locally**: \`npm run storybook\`
- **Build static bundle**: \`npm run build-storybook\`

## Included Stories

- **Controls** ([Controls.stories.tsx](${sourceBase}/src/ui/sdk/stories/Controls.stories.tsx)): \`Button\`, \`Card\`, \`Badge\`, \`ProgressBar\`, \`Segmented\`, \`Toggle\`, and \`Sema\`.
- **Starter Course Lesson** ([CourseExample.stories.tsx](${sourceBase}/src/ui/sdk/stories/CourseExample.stories.tsx)): Interactive 3-step lesson using \`LessonShell\`, \`LessonHeader\`, \`ChoiceGroup\`, \`WorkedSteps\`, \`CheckBar\`, \`CompletionCard\`, and a bundled SVG diagram.
- **Standalone Tool** ([ToolExample.stories.tsx](${sourceBase}/src/ui/sdk/stories/ToolExample.stories.tsx)): Autosaved scratchpad built with \`@syntax/ui\`.
`,
  )
}

await main()
