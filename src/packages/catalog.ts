import type { SyntaxPackageManifest } from '../core/packages'

const OFFICIAL_AUTHOR = {
  handle: 'syntax',
  displayName: 'Syntax Official',
  official: true,
  verified: true,
} as const

const BASE_SAFETY_OFFICIAL = {
  automatedScan: 'passed' as const,
  sandboxed: true,
  networkAccess: 'none' as const,
  lastChecked: '2026-11-26',
  official: true,
}

export const OFFICIAL_CATALOG: SyntaxPackageManifest[] = [
  // =========================================================================
  // COURSES (.syntaxcourse)
  // =========================================================================
  {
    schemaVersion: 1,
    id: 'mpm2d-analytic-geometry',
    kind: 'course',
    extension: '.syntaxcourse',
    name: 'Analytic Geometry (MPM2D)',
    tagline: 'Slopes, midpoints, distances, triangle lines, and geometric proofs.',
    description:
      'Complete Grade 10 Analytic Geometry unit built around visual intuition, interactive coordinate graphs, 7 Catch-Up rescue mini-lessons, and step-by-step guided video walkthroughs.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#3b82f6',
    tags: ['Math', 'Grade 10', 'MPM2D', 'Geometry'],
    touchesCore: false,
    builtIn: true,
    courseRoute: 'mpm2d',
    requires: [
      {
        id: 'math-graph-engine',
        kind: 'embedded-plugin',
        minVersion: '1.0.0',
        name: 'Math Graph Engine',
      },
    ],
    optional: [
      { id: 'pen-studio', kind: 'plugin', name: 'Pen Studio' },
      { id: 'walkthrough-player', kind: 'plugin', name: 'Video Walkthroughs' },
      { id: 'formula-playbook', kind: 'plugin', name: 'Formula Playbook' },
    ],
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#1d4ed8"/><path d="M12 46L52 18" stroke="#93c5fd" stroke-width="3.5" stroke-linecap="round"/><path d="M16 14V50H52" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="37.6" r="5" fill="#facc15" stroke="#1e3a8a" stroke-width="2.5"/><circle cx="42" cy="25" r="5" fill="#34d399" stroke="#1e3a8a" stroke-width="2.5"/></svg>',
  },
  {
    schemaVersion: 1,
    id: 'thinking-in-code',
    kind: 'course',
    extension: '.syntaxcourse',
    name: 'Thinking in Code',
    tagline: 'Build real programming intuition with interactive grid puzzles and loops.',
    description:
      'Hands-on computer science foundation covering Writing Programs, Sequencing Commands, Repeating Patterns, and Debugging Programs with live visual execution and step-by-step Why explanations.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#8b5cf6',
    tags: ['Computer Science', 'Logic', 'Beginner'],
    touchesCore: false,
    builtIn: true,
    courseRoute: 'thinking-in-code',
    requires: [
      {
        id: 'grid-coding-engine',
        kind: 'embedded-plugin',
        minVersion: '1.0.0',
        name: 'Grid Coding Engine',
      },
    ],
    optional: [],
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#6d28d9"/><rect x="14" y="14" width="14" height="14" rx="4" fill="#c4b5fd"/><rect x="36" y="14" width="14" height="14" rx="4" fill="#a78bfa"/><rect x="14" y="36" width="14" height="14" rx="4" fill="#a78bfa"/><rect x="36" y="36" width="14" height="14" rx="4" fill="#34d399"/><path d="M24 21H36M43 28V36" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/></svg>',
  },

  // =========================================================================
  // EMBEDDED COURSE PLUGINS (.syntaxembeddedplugin)
  // =========================================================================
  {
    schemaVersion: 1,
    id: 'math-graph-engine',
    kind: 'embedded-plugin',
    extension: '.syntaxembeddedplugin',
    name: 'Math Graph Engine',
    tagline: 'Interactive coordinate planes, draggable geometry handles, and math grading.',
    description:
      'Shared course library powering interactive Cartesian graphs, slope and midpoint explorers, stacked fraction typesetting, and algebraic answer grading across math courses.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#10b981',
    tags: ['Math', 'Graphs', 'Library', 'Interactive'],
    touchesCore: false,
    builtIn: true,
    aiUsage: {
      summary:
        'Embed interactive 2D coordinate planes, draggable points, geometric explorations, and math answer grading inside any .syntaxcourse lesson.',
      blocks: ['BrilliantGraph', 'CompactExploration', 'BrilliantMathInput', 'MathText'],
      example:
        '{ "type": "graph", "plugin": "math-graph-engine", "points": [{ "id": "A", "x": -2, "y": 1 }, { "id": "B", "x": 4, "y": 5 }], "segments": [["A", "B"]] }',
    },
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#047857"/><path d="M12 32H52M32 12V52" stroke="#a7f3d0" stroke-width="2.5" stroke-linecap="round"/><path d="M16 44C24 44 26 20 32 20C38 20 40 44 48 22" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="20" r="4.5" fill="#fbbf24"/></svg>',
  },
  {
    schemaVersion: 1,
    id: 'grid-coding-engine',
    kind: 'embedded-plugin',
    extension: '.syntaxembeddedplugin',
    name: 'Grid Coding Engine',
    tagline: 'Visual truck & robot grid puzzles, command blocks, and animated replays.',
    description:
      'Shared course library providing editable command-block puzzles, live grid execution, collision warnings, and step-by-step animated Why explanations for computer science courses.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#06b6d4',
    tags: ['Computer Science', 'Puzzles', 'Library'],
    touchesCore: false,
    builtIn: true,
    aiUsage: {
      summary:
        'Embed programmable grid maps with draggable command blocks (forward, turn, repeat, deliver) and automatic path grading.',
      blocks: ['GridProblem', 'RobotBoard', 'PracticeExplanation'],
      example:
        '{ "type": "grid-puzzle", "plugin": "grid-coding-engine", "commands": ["forward", "left", "right"], "goal": [3, 1] }',
    },
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#0e7490"/><rect x="14" y="16" width="36" height="32" rx="8" stroke="#cffafe" stroke-width="3"/><path d="M24 26L30 32L24 38M34 38H42" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },

  // =========================================================================
  // GLOBAL APP PLUGINS (.syntaxplugin)
  // =========================================================================
  {
    schemaVersion: 1,
    id: 'pen-studio',
    kind: 'plugin',
    extension: '.syntaxplugin',
    name: 'Pen Studio',
    tagline: 'Split-screen handwriting canvas with graph, dot, and lined scratch paper.',
    description:
      'Adds a full TLDraw stylus and mouse scratchpad directly beside any lesson problem, with per-question paper styles and saved blank scratch pages.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#f59e0b',
    tags: ['Handwriting', 'Stylus', 'Scratchpad', 'Tools'],
    touchesCore: true,
    coreTouchReason:
      'Splits the course Lesson Player layout into a resizable dual-pane workspace.',
    builtIn: true,
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#b45309"/><path d="M18 46L23 32L41 14L50 23L32 41L18 46Z" fill="#fde68a" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/><path d="M36 19L45 28" stroke="#b45309" stroke-width="2.5"/></svg>',
  },
  {
    schemaVersion: 1,
    id: 'walkthrough-player',
    kind: 'plugin',
    extension: '.syntaxplugin',
    name: 'Video Walkthroughs',
    tagline: 'Manim Guided Hints and Full Solution videos with narrated algebra.',
    description:
      'Integrates Video.js and Manim-rendered Guided Hint (zero-spoiler nudge) and Full Solution videos directly into lesson questions, with compact picture-in-picture docking beside Pen Studio.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#ec4899',
    tags: ['Video', 'Manim', 'Hints', 'Walkthroughs'],
    touchesCore: true,
    coreTouchReason:
      'Injects Guided Hint and Full Solution video triggers into the course Lesson Player.',
    builtIn: true,
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#be185d"/><circle cx="32" cy="32" r="18" fill="#fbcfe8" fill-opacity="0.2" stroke="#ffffff" stroke-width="3"/><path d="M27 23L42 32L27 41V23Z" fill="#ffffff"/></svg>',
  },
  {
    schemaVersion: 1,
    id: 'floating-windows',
    kind: 'plugin',
    extension: '.syntaxplugin',
    name: 'Floating Windows',
    tagline: 'Draggable 144Hz momentum study windows for Playbook and Hints.',
    description:
      'Upgrades Syntax reference modals into movable, resizable WinBox floating windows with toggleable 144Hz inertia glide so you can keep formulas open beside your work.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#6366f1',
    tags: ['Windows', 'Workspace', 'UI'],
    touchesCore: true,
    coreTouchReason:
      'Replaces standard modal dialogs with draggable WinBox floating window frames.',
    builtIn: true,
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#4338ca"/><rect x="13" y="16" width="28" height="22" rx="4" stroke="#c7d2fe" stroke-width="2.5"/><rect x="23" y="26" width="28" height="22" rx="4" fill="#4338ca" stroke="#ffffff" stroke-width="3"/><path d="M23 33H51" stroke="#ffffff" stroke-width="2.5"/></svg>',
  },
  {
    schemaVersion: 1,
    id: 'formula-playbook',
    kind: 'plugin',
    extension: '.syntaxplugin',
    name: 'Formula Playbook',
    tagline: 'Press F anytime inside a math course for a searchable formula reference.',
    description:
      'Provides an instant keyboard-accessible Playbook sheet with slopes, midpoints, distances, circle equations, and proof checklists that never interrupt your lesson state.',
    version: '1.0.0',
    author: OFFICIAL_AUTHOR,
    accentColor: '#f97316',
    tags: ['Reference', 'Math', 'Shortcuts'],
    touchesCore: false,
    builtIn: true,
    safety: BASE_SAFETY_OFFICIAL,
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="16" fill="#c2410c"/><path d="M18 16H42C44.2 16 46 17.8 46 20V48H22C19.8 48 18 46.2 18 44V16Z" stroke="#ffffff" stroke-width="3"/><path d="M25 25H39M25 32H35M18 42H46" stroke="#fed7aa" stroke-width="2.8" stroke-linecap="round"/></svg>',
  },
]

export const OFFICIAL_BY_ID = new Map(OFFICIAL_CATALOG.map(p => [p.id, p]))

// IDs of previously built-in packages that have been retired so localStorage
// migrations cleanly prune them instead of reclassifying them as community plugins.
export const RETIRED_OFFICIAL_IDS = new Set(['work-history', 'checkmark-gate'])
