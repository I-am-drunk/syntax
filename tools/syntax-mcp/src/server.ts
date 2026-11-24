#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { inspectCourses, inspectLesson, inspectPage, findSourceMaterial } from './inspect.js'
import { auditAll, auditLesson, auditPage } from './audit.js'
import { buildVerifiedScene, type SceneBuilderOp } from './author.js'
import { previewPage } from './preview.js'
import { inspectVideoStatus } from './video.js'
import { runVerify } from './verify.js'

const server = new Server(
  { name: 'syntax-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'syntax_inspect_courses',
      description:
        'List all Unit 2 and Catch-Up GeoLessons with their levels, page counts, check counts, and IDs. Start here before auditing or authoring.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'syntax_inspect_lesson',
      description:
        'Inspect a single GeoLesson or CatchupLesson by ID, returning all pages and checks with their kinds, prompts, sources, and walkthrough video coverage.',
      inputSchema: {
        type: 'object',
        properties: { lessonId: { type: 'string', description: 'Lesson ID (e.g. "u2-l1-slopes" or "rescue-read-line")' } },
        required: ['lessonId'],
      },
    },
    {
      name: 'syntax_inspect_page',
      description:
        'Inspect a single page or check by pageId, returning its full prompt, given scene, solvedScene, answer spec, plan, explanation, and walkthrough video metadata.',
      inputSchema: {
        type: 'object',
        properties: { pageId: { type: 'string', description: 'Page ID (e.g. "l1-p2-choice")' } },
        required: ['pageId'],
      },
    },
    {
      name: 'syntax_inspect_sources',
      description:
        'Search Alex Ivey classroom-materials/ notes, handouts (W2/W4), and tests for wording and problem references matching a query.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search term (e.g. "median", "W4", "perpendicular")' } },
        required: ['query'],
      },
    },
    {
      name: 'syntax_audit_lesson',
      description:
        'Audit a lesson (or all lessons if lessonId is omitted) for math correctness (via mathParser), geometry integrity (bounds, line labels, 90-deg right angles), pedagogy (missing plans, missing distractor hints), and UI (label overlaps via labelLayout, em dashes). Returns evidence and severity per finding.',
      inputSchema: {
        type: 'object',
        properties: {
          lessonId: { type: 'string', description: 'Optional lesson ID. Omit to audit all lessons.' },
          pageId: { type: 'string', description: 'Optional single page ID to audit.' },
        },
      },
    },
    {
      name: 'syntax_author_scene',
      description:
        'Build a mathematically verified GeoScene using deterministic geometric builders (line_through, perpendicular_through, midpoint, circle_through, right_angle_at_intersection, point, segment). Never hand-type line coefficients or intersection coordinates.',
      inputSchema: {
        type: 'object',
        properties: {
          ops: {
            type: 'array',
            description: 'Ordered list of geometric builder operations.',
            items: { type: 'object' },
          },
          pad: { type: 'number', description: 'Viewport padding in math units (default 2).' },
        },
        required: ['ops'],
      },
    },
    {
      name: 'syntax_preview',
      description:
        'Render a Syntax page URL in headless Chrome/Edge at desktop (1280x900) or phone (390x844) size and save a PNG screenshot for visual inspection.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Target URL (e.g. http://localhost:5173/)' },
          outPath: { type: 'string', description: 'Output PNG path' },
          viewport: { type: 'string', enum: ['desktop', 'phone'] },
          theme: { type: 'string', enum: ['light', 'dark'] },
        },
        required: ['url', 'outPath'],
      },
    },
    {
      name: 'syntax_video_status',
      description:
        'Inspect walkthrough video metadata (walkthroughData.ts), packaged MP4 assets, and Manim QA contact-sheet frames for a page or across the repo.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Optional page ID to inspect.' },
        },
      },
    },
    {
      name: 'syntax_verify',
      description:
        'Run automated verification gates: TypeScript + Vite build (tsc -b && vite build), full mathematical/pedagogical graph audit, and Manim walkthrough verifier.',
      inputSchema: {
        type: 'object',
        properties: {
          suite: { type: 'string', enum: ['all', 'build', 'graphs', 'video'] },
        },
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params
  let result: unknown

  switch (name) {
    case 'syntax_inspect_courses':
      result = await inspectCourses()
      break
    case 'syntax_inspect_lesson':
      result = await inspectLesson(String(args.lessonId))
      break
    case 'syntax_inspect_page':
      result = await inspectPage(String(args.pageId))
      break
    case 'syntax_inspect_sources':
      result = await findSourceMaterial(String(args.query))
      break
    case 'syntax_audit_lesson':
      if (args.pageId) result = await auditPage(String(args.pageId))
      else if (args.lessonId) result = await auditLesson(String(args.lessonId))
      else result = await auditAll()
      break
    case 'syntax_author_scene':
      result = buildVerifiedScene((args.ops as SceneBuilderOp[]) ?? [], typeof args.pad === 'number' ? args.pad : 2)
      break
    case 'syntax_preview':
      result = await previewPage({
        url: String(args.url),
        outPath: String(args.outPath),
        viewport: args.viewport === 'phone' ? 'phone' : 'desktop',
        theme: args.theme === 'dark' ? 'dark' : 'light',
      })
      break
    case 'syntax_video_status':
      result = await inspectVideoStatus(args.pageId ? String(args.pageId) : undefined)
      break
    case 'syntax_verify':
      result = await runVerify((args.suite as 'all' | 'build' | 'graphs' | 'video') ?? 'all')
      break
    default:
      throw new Error(`Unknown tool: ${name}`)
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  }
})

async function run() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Syntax MCP server running on stdio')
}

run().catch((error) => {
  console.error('Fatal error in Syntax MCP server:', error)
  process.exit(1)
})
