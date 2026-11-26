#!/usr/bin/env node
/**
 * Syntax Plugin Authoring CLI
 * Commands:
 *   node scripts/syntax-plugin.mjs new <id> [--type tool|block|theme|course]
 *   node scripts/syntax-plugin.mjs check <dir>
 *   node scripts/syntax-plugin.mjs pack <dir> [--out <file.sytx>]
 *   node scripts/syntax-plugin.mjs inspect <file.sytx>
 *   node scripts/syntax-plugin.mjs verify-all
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DETERMINISTIC_MTIME = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))
const SYNTAX_HOST_VERSION = '1.0.0'
const SYNTAX_API_VERSION = '1.0.0'

const ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?$/
const RANGE_TOKEN_RE =
  /^(>=|<=|>|<|=|\^|~)?v?(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const UNSAFE_SVG_RE =
  /<script\b|<\/script\b|<foreignobject\b|<iframe\b|<object\b|<embed\b|\son[a-z]+\s*=|javascript:|vbscript:|data:text\/html/i
const ALLOWED_PERMS = new Set([
  'storage',
  'ui:toolbar',
  'ui:lesson-block',
  'ui:playbook',
  'ui:theme',
  'core:layout',
])
const SAFE_THEME_TOKENS = new Set([
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-blue',
  '--geo-blue',
  '--geo-teal',
  '--geo-amber',
  '--geo-violet',
  '--geo-green',
  '--surface',
  '--surface-elevated',
  '--surface-subtle',
  '--border',
  '--bg',
])

function readFlag(args, name, fallback = undefined) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === `--${name}` && args[i + 1]) return args[i + 1]
    if (a.startsWith(`--${name}=`)) return a.slice(name.length + 3)
  }
  const envVal = process.env[`npm_config_${name.replace(/-/g, '_')}`]
  if (envVal && envVal !== 'true') return envVal
  return fallback
}

function isValidRange(range) {
  if (typeof range !== 'string' || !range.trim()) return false
  for (const clause of range.trim().split('||')) {
    const norm = clause.trim().replace(/([<>]=?|=|\^|~)\s+/g, '$1')
    if (!norm) return false
    for (const tok of norm.split(/\s+/)) {
      if (!RANGE_TOKEN_RE.test(tok)) return false
    }
  }
  return true
}

function isSafeSvg(svg) {
  const t = String(svg || '').trim()
  return (
    t.length > 0 &&
    t.length <= 32000 &&
    t.startsWith('<svg') &&
    t.endsWith('</svg>') &&
    !UNSAFE_SVG_RE.test(t)
  )
}

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function collectFilesRecursive(dir, baseDir = dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name === '__MACOSX') {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectFilesRecursive(full, baseDir))
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, full).split(path.sep).join('/')
      out.push({ rel, full })
    }
  }
  return out
}

function validatePluginDir(dirPath) {
  const absDir = path.resolve(dirPath)
  const errors = []
  const warnings = []

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return { ok: false, errors: [`Directory not found: ${dirPath}`], warnings, manifest: null }
  }

  const modPath = path.join(absDir, 'syntax.mod.json')
  if (!fs.existsSync(modPath)) {
    return { ok: false, errors: ['Missing syntax.mod.json at plugin root.'], warnings, manifest: null }
  }

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(modPath, 'utf8'))
  } catch (err) {
    return { ok: false, errors: [`Invalid syntax.mod.json: ${err.message}`], warnings, manifest: null }
  }

  if (manifest.schemaVersion !== 2 && manifest.schemaVersion !== 1) {
    errors.push('schemaVersion must be 2 (or 1 for legacy).')
  }
  if (!ID_RE.test(String(manifest.id || ''))) {
    errors.push('id must be lowercase letters, numbers, and hyphens (2 to 63 chars).')
  }
  if (!['course', 'plugin', 'embedded-plugin'].includes(manifest.kind)) {
    errors.push('kind must be "course", "plugin", or "embedded-plugin".')
  }
  if (!manifest.name || String(manifest.name).trim().length < 2) {
    errors.push('name must be at least 2 characters.')
  }
  if (!manifest.tagline || String(manifest.tagline).trim().length < 4) {
    errors.push('tagline must be at least 4 characters.')
  }
  if (!manifest.description || String(manifest.description).trim().length < 8) {
    errors.push('description must be at least 8 characters.')
  }
  if (!SEMVER_RE.test(String(manifest.version || ''))) {
    errors.push('version must follow SemVer (e.g. 1.0.0).')
  }
  if (!manifest.author?.handle || !manifest.author?.displayName) {
    errors.push('author.handle and author.displayName are required.')
  }

  // Validate icon
  const iconFile = manifest.icon || 'icon.svg'
  const iconAbs = path.join(absDir, iconFile)
  if (fs.existsSync(iconAbs)) {
    if (iconFile.endsWith('.svg')) {
      const svg = fs.readFileSync(iconAbs, 'utf8')
      if (!isSafeSvg(svg)) {
        errors.push(`${iconFile} failed SVG safety checks.`)
      }
    }
  } else if (!manifest.iconSvg || !isSafeSvg(manifest.iconSvg)) {
    errors.push(`Missing safe ${iconFile} (or inline iconSvg).`)
  }

  // Validate SemVer range maps
  for (const field of ['depends', 'recommends', 'breaks', 'conflicts']) {
    const map = manifest[field]
    if (!map) continue
    if (typeof map !== 'object' || Array.isArray(map)) {
      errors.push(`${field} must be an object mapping IDs to SemVer ranges.`)
      continue
    }
    for (const [k, v] of Object.entries(map)) {
      if (!isValidRange(v)) {
        errors.push(`${field}.${k} has an invalid SemVer range: "${v}".`)
      }
    }
  }

  if (!manifest.depends?.syntax) {
    warnings.push(`depends.syntax is omitted; defaulting to "^${SYNTAX_HOST_VERSION}".`)
  }

  // Validate permissions
  const perms = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : [])
  for (const p of perms) {
    if (!ALLOWED_PERMS.has(p)) {
      errors.push(`Unknown permission "${p}".`)
    }
  }

  // Check declared contribution entry files exist
  const contributes = manifest.contributes || {}
  for (const tool of contributes.toolbar || []) {
    const entry = tool.entry || 'widget.html'
    if (!fs.existsSync(path.join(absDir, entry))) {
      errors.push(`Toolbar entry file not found: ${entry}`)
    }
    if (!perms.has('ui:toolbar')) {
      warnings.push('contributes.toolbar declared without "ui:toolbar" in permissions.')
    }
  }
  for (const block of contributes.blocks || []) {
    const entry = block.entry || 'widget.html'
    if (!fs.existsSync(path.join(absDir, entry))) {
      errors.push(`Block entry file not found: ${entry}`)
    }
    if (!perms.has('ui:lesson-block')) {
      warnings.push('contributes.blocks declared without "ui:lesson-block" in permissions.')
    }
  }
  if (contributes.theme?.entry) {
    const cssPath = path.join(absDir, contributes.theme.entry)
    if (!fs.existsSync(cssPath)) {
      errors.push(`Theme CSS file not found: ${contributes.theme.entry}`)
    } else {
      const css = fs.readFileSync(cssPath, 'utf8')
      const matches = [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)]
      for (const m of matches) {
        if (!SAFE_THEME_TOKENS.has(m[1])) {
          warnings.push(`Theme token ${m[1]} is not in SAFE_THEME_TOKENS and will be ignored.`)
        }
      }
    }
  }
  if (manifest.kind === 'course') {
    const coursePath = path.join(absDir, 'course.json')
    if (!fs.existsSync(coursePath) && !manifest.customCourse) {
      errors.push('Course packages require course.json (or inline customCourse).')
    } else if (fs.existsSync(coursePath)) {
      try {
        const c = JSON.parse(fs.readFileSync(coursePath, 'utf8'))
        if (!Array.isArray(c.units) || c.units.length === 0) {
          errors.push('course.json must include at least one unit.')
        }
      } catch (err) {
        errors.push(`Invalid course.json: ${err.message}`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, manifest, absDir }
}

function cmdNew(args) {
  const id = args.find(a => !a.startsWith('-'))
  if (!id || !ID_RE.test(id)) {
    console.error('Usage: npm run plugin:new <plugin-id> -- --type tool|block|theme|course')
    console.error('Plugin ID must be lowercase letters, numbers, and hyphens (e.g. study-notes).')
    process.exit(1)
  }

  const type = readFlag(args, 'type', 'tool')
  if (!['tool', 'block', 'theme', 'course'].includes(type)) {
    console.error(`Unsupported --type "${type}". Use: tool, block, theme, or course.`)
    process.exit(1)
  }

  const targetDir = path.join(ROOT_DIR, 'plugins', id)
  if (fs.existsSync(targetDir)) {
    console.error(`Directory already exists: ${path.relative(ROOT_DIR, targetDir)}`)
    process.exit(1)
  }

  const title = id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  fs.mkdirSync(targetDir, { recursive: true })

  const baseManifest = {
    $schema: '../../src/sdk/syntax.mod.schema.json',
    schemaVersion: 2,
    id,
    kind: type === 'course' ? 'course' : type === 'block' ? 'embedded-plugin' : 'plugin',
    name: title,
    tagline: `A custom Syntax ${type} plugin.`,
    description: `${title} extends Syntax cleanly as a self-contained .sytx archive.`,
    version: '1.0.0',
    author: { handle: 'you', displayName: 'Local Author' },
    icon: 'icon.svg',
    accentColor: '#456dff',
    tags: [type === 'course' ? 'Course' : 'Plugin'],
    environment: type === 'block' ? 'lesson' : type === 'course' ? 'course' : 'all',
    depends: {
      syntax: `^${SYNTAX_HOST_VERSION}`,
      'syntax-api': `^${SYNTAX_API_VERSION}`,
    },
    touchesCore: false,
  }

  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="16" fill="#2563eb"/>
  <rect x="16" y="16" width="32" height="32" rx="8" stroke="#ffffff" stroke-width="3.5"/>
  <circle cx="32" cy="32" r="6" fill="#ffffff"/>
</svg>
`
  fs.writeFileSync(path.join(targetDir, 'icon.svg'), iconSvg, 'utf8')

  if (type === 'tool') {
    baseManifest.permissions = ['storage', 'ui:toolbar']
    baseManifest.contributes = {
      toolbar: [
        {
          id: `${id}-panel`,
          label: title.slice(0, 18),
          tooltip: `Open ${title}`,
          entry: 'widget.html',
          defaultWidth: 340,
          defaultHeight: 220,
        },
      ],
    }
    fs.writeFileSync(
      path.join(targetDir, 'widget.html'),
      `<style>
  .wrap { display: flex; flex-direction: column; gap: 10px; }
  textarea {
    width: 100%; min-height: 110px; padding: 10px; border-radius: 10px;
    border: 1px solid var(--sx-border); background: transparent; color: var(--sx-fg);
    font: inherit; resize: vertical;
  }
  .muted { font-size: 12px; color: var(--sx-muted); }
</style>
<div class="wrap">
  <div class="muted">${title} (saved locally per plugin)</div>
  <textarea id="note" placeholder="Write quick study notes..."></textarea>
</div>
<script>
  var el = document.getElementById('note');
  if (window.Syntax && window.Syntax.storage) {
    window.Syntax.storage.get('note').then(function (v) {
      if (typeof v === 'string') el.value = v;
    });
    el.addEventListener('input', function () {
      window.Syntax.storage.set('note', el.value);
    });
  }
</script>
`,
      'utf8',
    )
  } else if (type === 'block') {
    baseManifest.permissions = ['ui:lesson-block']
    baseManifest.contributes = {
      blocks: [
        {
          type: id,
          title,
          entry: 'widget.html',
          minHeight: 240,
          gradable: true,
        },
      ],
    }
    fs.writeFileSync(
      path.join(targetDir, 'widget.html'),
      `<style>
  .box { display: flex; flex-direction: column; gap: 12px; }
  button {
    align-self: flex-start; padding: 8px 14px; border-radius: 10px;
    border: none; background: var(--sx-accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer;
  }
</style>
<div class="box">
  <div id="prompt">Interactive lesson block: ${title}</div>
  <button id="done" type="button">Mark complete</button>
</div>
<script>
  document.getElementById('done').addEventListener('click', function () {
    if (window.Syntax) {
      window.Syntax.reportResult({ correct: true, score: 1, summary: 'Completed' });
      window.Syntax.toast('Block completed!');
    }
  });
</script>
`,
      'utf8',
    )
  } else if (type === 'theme') {
    baseManifest.permissions = ['ui:theme']
    baseManifest.contributes = {
      theme: {
        label: title,
        entry: 'theme.css',
      },
    }
    fs.writeFileSync(
      path.join(targetDir, 'theme.css'),
      `[data-theme="light"] {
  --accent: #059669;
  --accent-hover: #047857;
  --accent-blue: #059669;
}

[data-theme="dark"] {
  --accent: #10b981;
  --accent-hover: #34d399;
  --accent-blue: #10b981;
}
`,
      'utf8',
    )
  } else if (type === 'course') {
    fs.writeFileSync(
      path.join(targetDir, 'course.json'),
      JSON.stringify(
        {
          subtitle: 'Custom Syntax course',
          units: [
            {
              title: 'Unit 1: Getting Started',
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'First Check',
                  summary: 'Sample interactive question.',
                  prompt: 'What is 2 + 2?',
                  choices: ['3', '4', '5'],
                  answerIndex: 1,
                  explanation: '2 + 2 equals 4.',
                },
              ],
            },
          ],
        },
        null,
        2,
      ) + '\n',
      'utf8',
    )
  }

  fs.writeFileSync(
    path.join(targetDir, 'syntax.mod.json'),
    JSON.stringify(baseManifest, null, 2) + '\n',
    'utf8',
  )
  fs.writeFileSync(
    path.join(targetDir, 'README.md'),
    `# ${title}\n\n${baseManifest.tagline}\n\n## Build\n\n\`\`\`bash\nnpm run plugin:check plugins/${id}\nnpm run plugin:pack plugins/${id}\n\`\`\`\n`,
    'utf8',
  )

  console.log(`Created ${path.relative(ROOT_DIR, targetDir)}/ (${type})`)
  console.log(`Next:`)
  console.log(`  npm run plugin:check plugins/${id}`)
  console.log(`  npm run plugin:pack plugins/${id}`)
}

function cmdCheck(args) {
  const dir = args.find(a => !a.startsWith('-'))
  if (!dir) {
    console.error('Usage: npm run plugin:check <plugin-dir>')
    process.exit(1)
  }
  const res = validatePluginDir(dir)
  for (const w of res.warnings) console.warn(`  WARN  ${w}`)
  if (!res.ok) {
    for (const e of res.errors) console.error(`  ERR   ${e}`)
    process.exit(1)
  }
  console.log(`OK    ${res.manifest.id}@${res.manifest.version} (${res.manifest.kind})`)
}

function cmdPack(args) {
  const dir = args.find(a => !a.startsWith('-'))
  if (!dir) {
    console.error('Usage: npm run plugin:pack <plugin-dir> [--out dist-plugins/name.sytx]')
    process.exit(1)
  }
  const check = validatePluginDir(dir)
  for (const w of check.warnings) console.warn(`  WARN  ${w}`)
  if (!check.ok) {
    for (const e of check.errors) console.error(`  ERR   ${e}`)
    process.exit(1)
  }

  const files = collectFilesRecursive(check.absDir).sort((a, b) => {
    if (a.rel === 'syntax.mod.json') return -1
    if (b.rel === 'syntax.mod.json') return 1
    return a.rel.localeCompare(b.rel)
  })

  const zippable = {}
  for (const f of files) {
    zippable[f.rel] = [new Uint8Array(fs.readFileSync(f.full)), { level: 6, mtime: DETERMINISTIC_MTIME }]
  }

  const outBytes = zipSync(zippable)
  const outFlag = readFlag(args, 'out')
  const defaultOut = path.join(
    ROOT_DIR,
    'dist-plugins',
    `${check.manifest.id}-${check.manifest.version}.sytx`,
  )
  const outPath = path.resolve(outFlag || defaultOut)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, outBytes)

  const digest = sha256Hex(outBytes)
  console.log(
    `PACK  ${path.relative(ROOT_DIR, outPath)} (${files.length} files, ${formatBytes(outBytes.byteLength)})`,
  )
  console.log(`SHA   ${digest}`)
  return { outPath, bytes: outBytes, sha256: digest, manifest: check.manifest }
}

function cmdInspect(args) {
  const file = args.find(a => !a.startsWith('-'))
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run plugin:inspect <file.sytx>')
    process.exit(1)
  }
  const bytes = new Uint8Array(fs.readFileSync(file))
  const entries = unzipSync(bytes)
  const modBytes = entries['syntax.mod.json'] || entries['manifest.json']
  if (!modBytes) {
    console.error('ERR   Missing syntax.mod.json inside archive.')
    process.exit(1)
  }
  const mod = JSON.parse(strFromU8(modBytes))
  console.log(`Package:  ${mod.name} (${mod.id}@${mod.version})`)
  console.log(`Kind:     ${mod.kind}  |  Environment: ${mod.environment || 'all'}`)
  console.log(`Depends:  ${JSON.stringify(mod.depends || {})}`)
  if (mod.permissions?.length) console.log(`Perms:    ${mod.permissions.join(', ')}`)
  console.log(`SHA-256:  ${sha256Hex(bytes)}`)
  console.log(`Files (${Object.keys(entries).length}, ${formatBytes(bytes.byteLength)} compressed):`)
  for (const [p, buf] of Object.entries(entries)) {
    console.log(`  - ${p} (${formatBytes(buf.byteLength)})`)
  }
}

function cmdVerifyAll() {
  const pluginsRoot = path.join(ROOT_DIR, 'plugins')
  if (!fs.existsSync(pluginsRoot)) {
    console.log('No plugins/ directory found.')
    return
  }
  const dirs = fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(pluginsRoot, d.name))

  if (dirs.length === 0) {
    console.log('No plugin folders found in plugins/.')
    return
  }

  let failed = 0
  for (const dir of dirs) {
    const res = validatePluginDir(dir)
    if (!res.ok) {
      failed += 1
      console.error(`FAIL  ${path.relative(ROOT_DIR, dir)}`)
      for (const e of res.errors) console.error(`      ${e}`)
      continue
    }
    const packed = cmdPack([dir])
    // Round-trip unzip verify
    const unzipped = unzipSync(packed.bytes)
    if (!unzipped['syntax.mod.json']) {
      failed += 1
      console.error(`FAIL  Round-trip unzip missing syntax.mod.json for ${dir}`)
    }
  }

  if (failed > 0) process.exit(1)
  console.log(`Verified ${dirs.length} plugin(s) cleanly.`)
}

const [, , cmd, ...rest] = process.argv
if (cmd === 'new') cmdNew(rest)
else if (cmd === 'check') cmdCheck(rest)
else if (cmd === 'pack') cmdPack(rest)
else if (cmd === 'inspect') cmdInspect(rest)
else if (cmd === 'verify-all') cmdVerifyAll()
else {
  console.log('Syntax Plugin CLI')
  console.log('  npm run plugin:new <id> -- --type tool|block|theme|course')
  console.log('  npm run plugin:check <dir>')
  console.log('  npm run plugin:pack <dir>')
  console.log('  npm run plugin:inspect <file.sytx>')
  console.log('  npm run plugins:verify')
}
