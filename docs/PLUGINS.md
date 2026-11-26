# Building Syntax Plugins (`.sytx`)

Every Syntax plugin, embedded engine, theme pack, and custom course is a single standard **`.sytx` ZIP archive**. You can open it with `unzip`, Finder, or Explorer, and install it by dragging it onto the **Plugins** page in Syntax.

## Quick Start (3 Commands)

```bash
# 1. Scaffold a new plugin (types: tool, block, theme, course)
npm run plugin:new my-timer -- --type tool

# 2. Validate manifest, SemVer ranges, icons, and entry files
npm run plugin:check plugins/my-timer

# 3. Pack a deterministic .sytx archive into dist-plugins/
npm run plugin:pack plugins/my-timer
```

Drag the output file (`dist-plugins/my-timer-1.0.0.sytx`) anywhere onto the Syntax **Plugins** page to inspect its compatibility, permissions, and file tree, then install locally without needing to sign in.

## Archive Layout

```text
my-plugin-1.0.0.sytx (standard ZIP)
├── syntax.mod.json    # Required manifest (schemaVersion: 2)
├── icon.svg           # Safe inline SVG icon (no scripts or event handlers)
├── widget.html        # Entry file for toolbar tools or lesson blocks
├── theme.css          # Optional allowlisted CSS tokens for theme packs
├── course.json        # Optional units & lessons for custom courses
└── README.md          # Optional docs
```

## Compatibility Rules (`syntax.mod.json`)

Syntax uses Fabric-style SemVer ranges inside `syntax.mod.json`:

```json
{
  "$schema": "../../src/sdk/syntax.mod.schema.json",
  "schemaVersion": 2,
  "id": "focus-timer",
  "kind": "plugin",
  "name": "Focus Timer",
  "tagline": "Pomodoro study sprint timer docked in your Syntax toolbar.",
  "description": "Adds a calm 25/5 focus sprint timer accessible from the header and inside lessons.",
  "version": "1.0.0",
  "author": { "handle": "syntax", "displayName": "Syntax Starters" },
  "environment": "all",
  "depends": {
    "syntax": "^1.0.0",
    "syntax-api": "^1.0.0"
  },
  "recommends": {},
  "breaks": {},
  "conflicts": {},
  "provides": [],
  "permissions": ["storage", "ui:toolbar"]
}
```

- **`depends`**: Hard requirements. Always include `"syntax": "^1.0.0"` and `"syntax-api": "^1.0.0"`. Supports `^`, `~`, `>=`, `<`, `*`, space-AND, and `||`-OR.
- **`recommends`**: Optional companion plugins.
- **`breaks`**: Hard incompatibilities. Blocks install or enable when a conflicting package is active.
- **`conflicts`**: Soft incompatibilities. Shows a review warning with a 1-click Disable action.
- **`provides`**: Virtual capabilities (`engine:<name>` for shared libraries, `slot:<name>` for exclusive UI slots).

## Extension Points (`contributes`)

1. **Toolbar Tool (`contributes.toolbar` + `ui:toolbar`)**: Adds a button to the header and inside fullscreen lessons, opening your `widget.html` in a persistent floating drawer.
2. **Inline Lesson Block (`contributes.blocks` + `ui:lesson-block`)**: Renders `widget.html` inside custom course lessons with `window.Syntax.props` and grading via `window.Syntax.reportResult({ correct, score, summary })`.
3. **Playbook Reference Cards (`contributes.playbook` + `ui:playbook`)**: Declarative formula cards rendered natively in the Formula Playbook with full math typography.
4. **Theme Pack (`contributes.theme` + `ui:theme`)**: Overrides allowlisted CSS custom properties (`--accent`, `--accent-hover`, `--accent-blue`, `--geo-blue`, etc.) cleanly for light and dark mode.

## `window.Syntax` Widget SDK

Inside `widget.html` (sandboxed with strict CSP and live `--sx-bg`, `--sx-fg`, `--sx-muted`, `--sx-border`, `--sx-accent` variables):

- `window.Syntax.theme` (`'light' | 'dark'`) and `window.Syntax.onThemeChange(cb)`
- `window.Syntax.props` (lesson block props)
- `await window.Syntax.storage.get(key)` / `set(key, val)` / `remove(key)` (128 KB per plugin, requires `"storage"`)
- `window.Syntax.toast(message)`
- `window.Syntax.reportResult({ correct, score, summary })`
- `window.Syntax.resize(heightPx)`

Full TypeScript types live in `src/sdk/syntax-plugin.d.ts`.
