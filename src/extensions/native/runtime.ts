import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {
  type NativeCommand,
  type NativeCourseProgress,
  type NativeData,
  type NativeExtension,
  type NativeExtensionContext,
  type NativeScreen,
  type NativeSoundCue,
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
}

interface Activation {
  package: NativePackage
  revision?: string
  controller: AbortController
  screens: Map<string, NativeScreen>
  commands: Map<string, NativeCommand>
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
  private navigator: ((path: string) => void) | null = null

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
  }

  setNavigator(navigator: ((path: string) => void) | null): void {
    this.navigator = navigator
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
        register(stage.screens, screen)
      },
      registerCommand: command => {
        assertStaging()
        if (typeof command?.run !== 'function') {
          throw new NativePackageError('CONTRIBUTION_INVALID', 'Supply a run function for the command.')
        }
        register(stage.commands, command)
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
    } catch (error) {
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
  }

  private dispose(activation: Activation): void {
    activation.controller.abort()
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
