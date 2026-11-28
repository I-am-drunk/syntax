import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {
  type NativeCommand,
  type NativeCourseProgress,
  type NativeCourseTool,
  type NativeData,
  type NativeEmbeddedExtension,
  type NativeExtension,
  type NativeExtensionContext,
  type NativeRegisteredCourseTool,
  type NativeScreen,
  type NativeSoundCue,
  type NativeStyleRegistration,
} from './api.ts'
import { NativePackageError } from './manifest.ts'
import type { NativePackage } from './package.ts'

export interface NativeDataStore {
  load(ownerId: string): Promise<NativeData | undefined>
  save(ownerId: string, value: NativeData, revision?: string): Promise<void>
  loadProgress?(ownerId: string): Promise<NativeCourseProgress | undefined>
  saveProgress?(ownerId: string, progress: NativeCourseProgress | null, revision?: string): Promise<void>
}

export interface NativeRuntimeOptions {
  hostModules?: Readonly<Record<string, unknown>>
  playSound?: (cue: NativeSoundCue) => void
  onDataChanged?: (ownerId: string) => void
  onProgressChanged?: (ownerId: string) => void
  onContributionsChanged?: () => void
}

interface MountedStyle {
  id: string
  scope: 'scoped' | 'global'
  css: string
  node?: HTMLStyleElement
}

interface StagedEmbedded {
  id: string
  title: string
  setup: NativeEmbeddedExtension['setup']
}

interface Activation {
  package: NativePackage
  revision?: string
  controller: AbortController
  screens: Map<string, NativeScreen>
  commands: Map<string, NativeCommand>
  embedded: Map<string, StagedEmbedded>
  courseTools: Map<string, NativeRegisteredCourseTool>
  styles: Map<string, MountedStyle>
  disposers: (() => void | Promise<void>)[]
}

function createExtension(entry: string, hostModules: Readonly<Record<string, unknown>>): NativeExtension {
  const requireHost = (name: string): unknown => {
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return jsxRuntime
    if (Object.prototype.hasOwnProperty.call(hostModules, name)) {
      return hostModules[name]
    }
    throw new NativePackageError('MODULE_UNAVAILABLE', `Syntax does not provide ${name}. Bundle it in the extension.`)
  }
  const module: { exports: Partial<NativeExtension> } = { exports: {} }
  new Function('require', 'module', 'exports', entry)(requireHost, module, module.exports)
  const extension = module.exports
  if (!extension || typeof extension.activate !== 'function') {
    throw new NativePackageError('ACTIVATE_MISSING', 'Export an activate function from the CommonJS entry.')
  }
  return extension as NativeExtension
}

function register<T extends { id: string; title: string }>(collection: Map<string, T>, value: T): void {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(value.id) || typeof value.title !== 'string' || !value.title.trim()) {
    throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a lowercase contribution ID and a title.')
  }
  if (collection.has(value.id)) {
    throw new NativePackageError('CONTRIBUTION_DUPLICATE', `A contribution already uses the ID ${value.id}.`)
  }
  collection.set(value.id, { ...value })
}

function normalizeProgress(progress: NativeCourseProgress | null): NativeCourseProgress | null {
  if (progress === null) return null
  if (
    typeof progress !== 'object' ||
    !Number.isFinite(progress.completed) ||
    !Number.isFinite(progress.total) ||
    progress.completed < 0 ||
    progress.total < 1
  ) {
    throw new NativePackageError('PROGRESS_INVALID', 'Supply non-negative completed count and total >= 1.')
  }
  const total = Math.floor(progress.total)
  const completed = Math.min(total, Math.max(0, Math.floor(progress.completed)))
  const label = typeof progress.label === 'string' && progress.label.trim()
    ? progress.label.trim().slice(0, 80)
    : undefined
  return label ? { completed, total, label } : { completed, total }
}

/**
 * Prevents `@scope` breakout (e.g., unbalanced `}` or top-level global at-rules)
 * so ordinary course CSS can never escape `[data-native-ext-root]`.
 */
export function validateScopedCss(css: string): void {
  let depth = 0
  let inComment = false
  let quote: '"' | "'" | null = null
  let stripped = ''

  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    const next = css[i + 1]
    if (inComment) {
      if (ch === '*' && next === '/') {
        inComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && next === '*') {
      inComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth < 0) {
        throw new NativePackageError('STYLE_INVALID', 'Scoped CSS contains an unbalanced closing brace.')
      }
    }
    stripped += ch
  }
  if (inComment || quote || depth !== 0) {
    throw new NativePackageError('STYLE_INVALID', 'Scoped CSS has unclosed comments, strings, or braces.')
  }
  if (/@(?:import|charset|namespace|font-face|keyframes|property|layer)\b/i.test(stripped)) {
    throw new NativePackageError('STYLE_INVALID', 'Scoped CSS cannot declare global at-rules such as @import, @keyframes, @property, or @font-face.')
  }
}

function buildScopedRule(ownerId: string, css: string): string {
  return `@scope ([data-native-ext-root="${ownerId}"]) to ([data-native-ext-root]) {\n${css}\n}`
}

function mountStyles(ownerId: string, styles: Map<string, MountedStyle>): void {
  if (typeof document === 'undefined') return
  for (const entry of styles.values()) {
    const cssText = entry.scope === 'global' ? entry.css : buildScopedRule(ownerId, entry.css)
    if (entry.scope === 'scoped' && typeof CSSStyleSheet !== 'undefined') {
      try {
        const probe = new CSSStyleSheet()
        probe.replaceSync(cssText)
        if (probe.cssRules.length !== 1) {
          throw new NativePackageError('STYLE_INVALID', 'Scoped CSS must parse into a single @scope rule.')
        }
      } catch (err) {
        if (err instanceof NativePackageError) throw err
        throw new NativePackageError('STYLE_INVALID', 'Scoped CSS could not be parsed safely.')
      }
    }
    const node = document.createElement('style')
    node.dataset.nativeStyleOwner = ownerId
    node.dataset.nativeStyleId = entry.id
    node.dataset.nativeStyleScope = entry.scope
    node.textContent = cssText
    document.head.appendChild(node)
    entry.node = node
  }
}

function unmountStyles(styles: Map<string, MountedStyle>): void {
  for (const entry of styles.values()) {
    entry.node?.remove()
    entry.node = undefined
  }
}

export class NativeRuntime {
  private readonly active = new Map<string, Activation>()
  private readonly pending = new Map<string, Activation>()
  private readonly writes = new Map<string, Promise<void>>()
  private readonly reportCleanupError: (id: string, error: unknown) => void
  private readonly data: NativeDataStore
  private readonly hostModules: Readonly<Record<string, unknown>>
  private readonly soundPlayer?: (cue: NativeSoundCue) => void
  private readonly onDataChanged?: (ownerId: string) => void
  private readonly onProgressChanged?: (ownerId: string) => void
  private readonly onContributionsChanged?: () => void
  private navigator: ((path: string) => void) | null = null
  private toolsCacheVersion = 0
  private toolsCache = new Map<string, readonly NativeRegisteredCourseTool[]>()

  constructor(
    data: NativeDataStore,
    reportCleanupError: (id: string, error: unknown) => void,
    options: NativeRuntimeOptions = {},
  ) {
    this.data = data
    this.reportCleanupError = reportCleanupError
    this.hostModules = options.hostModules ?? {}
    this.soundPlayer = options.playSound
    this.onDataChanged = options.onDataChanged
    this.onProgressChanged = options.onProgressChanged
    this.onContributionsChanged = options.onContributionsChanged
  }

  setNavigator(navigator: ((path: string) => void) | null): void {
    this.navigator = navigator
  }

  private bumpContributions(): void {
    this.toolsCacheVersion += 1
    this.toolsCache.clear()
    this.onContributionsChanged?.()
  }

  async activate(
    pkg: NativePackage,
    commit?: () => Promise<void>,
    revision?: string,
    allowSourceChange = false,
  ): Promise<void> {
    const id = pkg.manifest.id
    if (this.pending.has(id)) {
      throw new NativePackageError('ACTIVATION_BUSY', `${id} is already starting.`)
    }
    const previous = this.active.get(id)
    if (previous && previous.package.sourceUrl !== pkg.sourceUrl && !allowSourceChange) {
      throw new NativePackageError('SOURCE_CONFLICT', `${id} is already active from a different manifest URL.`)
    }
    const stage: Activation = {
      package: pkg,
      revision,
      controller: new AbortController(),
      screens: new Map(),
      commands: new Map(),
      embedded: new Map(),
      courseTools: new Map(),
      styles: new Map(),
      disposers: [],
    }
    this.pending.set(id, stage)
    const signal = stage.controller.signal
    const assertStaging = () => {
      signal.throwIfAborted()
      if (this.pending.get(id) !== stage) {
        throw new NativePackageError('ACTIVATION_FINISHED', 'Register contributions during activation.')
      }
    }

    const enqueueWrite = async (work: () => Promise<void>) => {
      const previousWrite = this.writes.get(id) ?? Promise.resolve()
      const write = previousWrite.then(work)
      const tail = write.catch(() => undefined)
      this.writes.set(id, tail)
      try {
        await write
      } finally {
        if (this.writes.get(id) === tail) this.writes.delete(id)
      }
    }

    const context: NativeExtensionContext = {
      signal,
      registerScreen: screen => {
        assertStaging()
        if (typeof screen?.component !== 'function') {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a React function component for the screen.')
        }
        let validatedTools: NativeScreen['recommendedTools']
        if (screen.recommendedTools !== undefined) {
          if (!Array.isArray(screen.recommendedTools)) {
            throw new NativePackageError('CONTRIBUTION_INVALID', 'recommendedTools must be an array.')
          }
          validatedTools = screen.recommendedTools.map(tool => {
            if (
              !tool ||
              typeof tool.id !== 'string' || !tool.id.trim() ||
              typeof tool.name !== 'string' || !tool.name.trim() ||
              typeof tool.description !== 'string' || !tool.description.trim() ||
              (tool.manifestUrl !== undefined && typeof tool.manifestUrl !== 'string')
            ) {
              throw new NativePackageError('CONTRIBUTION_INVALID', 'Each recommended tool requires id, name, and description.')
            }
            return Object.freeze({
              id: tool.id.trim(),
              name: tool.name.trim(),
              description: tool.description.trim(),
              ...(tool.manifestUrl ? { manifestUrl: tool.manifestUrl.trim() } : {}),
            })
          })
        }
        register(stage.screens, {
          ...screen,
          ...(validatedTools ? { recommendedTools: validatedTools } : {}),
        })
      },
      registerCommand: command => {
        assertStaging()
        if (typeof command?.run !== 'function') {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a run function for the command.')
        }
        register(stage.commands, command)
      },
      registerEmbedded: async (embedded: NativeEmbeddedExtension) => {
        assertStaging()
        if (typeof embedded?.setup !== 'function') {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a setup function for the embedded extension.')
        }
        // Stage descriptor; setup runs atomically after commit & disposal of any prior version.
        register(stage.embedded, { id: embedded.id, title: embedded.title, setup: embedded.setup })
      },
      registerCourseTool: (tool: NativeCourseTool) => {
        assertStaging()
        if (
          typeof tool?.component !== 'function' ||
          typeof tool?.buttonLabel !== 'string' ||
          !tool.buttonLabel.trim() ||
          !Array.isArray(tool.targetCourses) ||
          tool.targetCourses.length === 0 ||
          tool.targetCourses.some(target => typeof target !== 'string' || !target.trim())
        ) {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply buttonLabel, non-empty targetCourses strings, and a React component for the course tool.')
        }
        register(stage.courseTools, Object.freeze({
          ...tool,
          targetCourses: Object.freeze(tool.targetCourses.map(target => target.trim())),
          ownerId: id,
          ownerName: pkg.manifest.name,
        }))
      },
      registerStyles: (style: NativeStyleRegistration) => {
        assertStaging()
        if (
          !/^[a-z][a-z0-9-]{0,63}$/.test(style?.id ?? '') ||
          typeof style?.css !== 'string' ||
          !style.css.trim() ||
          style.css.length > 100_000
        ) {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a lowercase style ID and non-empty CSS up to 100 KiB.')
        }
        const scope = style.scope ?? 'scoped'
        if (scope !== 'scoped' && scope !== 'global') {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Style scope must be scoped or global.')
        }
        if (scope === 'scoped') {
          validateScopedCss(style.css)
        }
        if (stage.styles.has(style.id)) {
          throw new NativePackageError('CONTRIBUTION_DUPLICATE', `A style already uses the ID ${style.id}.`)
        }
        stage.styles.set(style.id, { id: style.id, css: style.css, scope })
      },
      openScreen: screenId => {
        signal.throwIfAborted()
        if (this.active.get(id) !== stage) {
          throw new NativePackageError('ACTIVATION_PENDING', 'Open screens after activation succeeds.')
        }
        if (!stage.screens.has(screenId)) {
          throw new NativePackageError('SCREEN_UNAVAILABLE', `Screen ${screenId} is unavailable in ${id}.`)
        }
        this.navigator?.(`/native-extension/${encodeURIComponent(id)}/${encodeURIComponent(screenId)}`)
      },
      onDispose: callback => {
        assertStaging()
        if (typeof callback !== 'function') {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a cleanup function.')
        }
        stage.disposers.push(callback)
      },
      loadData: async () => {
        signal.throwIfAborted()
        await this.writes.get(id)
        signal.throwIfAborted()
        const result = await this.data.load(id)
        signal.throwIfAborted()
        return result
      },
      saveData: async value => {
        signal.throwIfAborted()
        if (this.active.get(id) !== stage) {
          throw new NativePackageError('ACTIVATION_PENDING', 'Save data after activation succeeds.')
        }
        const snapshot = structuredClone(value)
        await enqueueWrite(() => this.data.save(id, snapshot, revision))
        this.onDataChanged?.(id)
      },
      getProgress: async () => {
        signal.throwIfAborted()
        await this.writes.get(id)
        signal.throwIfAborted()
        const result = await this.data.loadProgress?.(id)
        signal.throwIfAborted()
        return result
      },
      reportProgress: async progress => {
        signal.throwIfAborted()
        if (this.active.get(id) !== stage) {
          throw new NativePackageError('ACTIVATION_PENDING', 'Report progress after activation succeeds.')
        }
        const normalized = normalizeProgress(progress)
        await enqueueWrite(async () => {
          await this.data.saveProgress?.(id, normalized, revision)
        })
        this.onProgressChanged?.(id)
      },
      playSound: cue => {
        if (signal.aborted || this.active.get(id) !== stage) return
        this.soundPlayer?.(cue)
      },
    }
    let rejectOnAbort = () => {}
    const cancelled = new Promise<never>((_, reject) => {
      rejectOnAbort = () => reject(signal.reason)
      signal.addEventListener('abort', rejectOnAbort, { once: true })
    })
    const timeout = setTimeout(() => stage.controller.abort(
      new NativePackageError('ACTIVATION_TIMEOUT', `${id} did not finish activating.`),
    ), 10_000)
    try {
      const start = new Promise<void>(resolve =>
        resolve(createExtension(pkg.entry, this.hostModules).activate(context)),
      )
      void start.catch(() => undefined)
      await Promise.race([start, cancelled])
      assertStaging()
      clearTimeout(timeout)
      await commit?.()
      assertStaging()
      this.active.set(id, stage)
      if (previous) this.dispose(previous)
      // Run embedded setup AFTER previous version's cleanup has finished.
      for (const embedded of stage.embedded.values()) {
        signal.throwIfAborted()
        const cleanup = await embedded.setup(context)
        if (typeof cleanup === 'function') {
          if (signal.aborted || this.active.get(id) !== stage) {
            try {
              await cleanup()
            } catch (cleanupErr) {
              this.reportDisposalFailure(stage, cleanupErr)
            }
            signal.throwIfAborted()
          } else {
            stage.disposers.push(cleanup)
          }
        }
      }
      mountStyles(id, stage.styles)
      this.bumpContributions()
    } catch (error) {
      if (this.active.get(id) === stage) {
        this.active.delete(id)
        this.bumpContributions()
      }
      this.dispose(stage)
      throw error
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', rejectOnAbort)
      if (this.pending.get(id) === stage) this.pending.delete(id)
    }
  }

  getScreen(ownerId: string, screenId: string): NativeScreen | undefined {
    return this.active.get(ownerId)?.screens.get(screenId)
  }

  listScreens(ownerId: string): NativeScreen[] {
    return [...(this.active.get(ownerId)?.screens.values() ?? [])]
  }

  listCommands(ownerId: string): NativeCommand[] {
    return [...(this.active.get(ownerId)?.commands.values() ?? [])]
  }

  listEmbedded(ownerId: string): { id: string; title: string }[] {
    return [...(this.active.get(ownerId)?.embedded.values() ?? [])].map(({ id, title }) => ({ id, title }))
  }

  listStyles(ownerId: string): { id: string; scope: 'scoped' | 'global' }[] {
    return [...(this.active.get(ownerId)?.styles.values() ?? [])].map(({ id, scope }) => ({ id, scope }))
  }

  listOwnedCourseTools(ownerId: string): NativeRegisteredCourseTool[] {
    return [...(this.active.get(ownerId)?.courseTools.values() ?? [])]
  }

  listCourseToolsFor(courseId: string): readonly NativeRegisteredCourseTool[] {
    const cached = this.toolsCache.get(courseId)
    if (cached) return cached
    const out: NativeRegisteredCourseTool[] = []
    for (const activation of this.active.values()) {
      for (const tool of activation.courseTools.values()) {
        if (tool.targetCourses.includes('*') || tool.targetCourses.includes(courseId)) {
          out.push(tool)
        }
      }
    }
    const frozen = Object.freeze(out)
    this.toolsCache.set(courseId, frozen)
    return frozen
  }

  getContributionsVersion(): number {
    return this.toolsCacheVersion
  }

  getActiveRevision(ownerId: string): string | undefined {
    return this.active.get(ownerId)?.revision
  }

  retireStaleActivations(revisions: ReadonlyMap<string, string>): void {
    for (const [id, active] of this.active) {
      if (!revisions.has(id) || revisions.get(id) !== active.revision) this.disable(id)
    }
  }

  isActive(ownerId: string): boolean {
    return this.active.has(ownerId)
  }

  async runCommand(ownerId: string, commandId: string): Promise<void> {
    const activation = this.active.get(ownerId)
    const command = activation?.commands.get(commandId)
    if (!activation || !command) {
      throw new NativePackageError('COMMAND_UNAVAILABLE', `Command ${commandId} is unavailable in ${ownerId}.`)
    }
    try {
      await command.run()
    } catch (error) {
      if (this.active.get(ownerId) === activation) {
        this.active.delete(ownerId)
        this.dispose(activation)
        this.bumpContributions()
      }
      throw error
    }
  }

  disable(ownerId: string): void {
    const pending = this.pending.get(ownerId)
    const active = this.active.get(ownerId)
    this.pending.delete(ownerId)
    this.active.delete(ownerId)
    if (pending) this.dispose(pending)
    if (active && active !== pending) this.dispose(active)
    if (active || pending) this.bumpContributions()
  }

  private dispose(activation: Activation): void {
    activation.controller.abort()
    unmountStyles(activation.styles)
    for (const dispose of activation.disposers.splice(0).reverse()) {
      try {
        void Promise.resolve(dispose()).catch(error => this.reportDisposalFailure(activation, error))
      } catch (error) {
        this.reportDisposalFailure(activation, error)
      }
    }
  }

  private reportDisposalFailure(activation: Activation, error: unknown): void {
    try {
      this.reportCleanupError(activation.package.manifest.id, error)
    } catch {
      // Diagnostics must not interrupt cleanup or change the activation result.
    }
  }
}
