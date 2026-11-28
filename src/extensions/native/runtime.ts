import React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import {
  type NativeCommand,
  type NativeData,
  type NativeExtension,
  type NativeExtensionContext,
  type NativeScreen,
} from './api.ts'
import { NativePackageError } from './manifest.ts'
import type { NativePackage } from './package.ts'

export interface NativeDataStore {
  load(ownerId: string): Promise<NativeData | undefined>
  save(ownerId: string, value: NativeData): Promise<void>
}

interface Activation {
  package: NativePackage
  controller: AbortController
  screens: Map<string, NativeScreen>
  commands: Map<string, NativeCommand>
  disposers: (() => void | Promise<void>)[]
}

function createExtension(entry: string): NativeExtension {
  const requireHost = (name: string): unknown => {
    if (name === 'react') return React
    if (name === 'react/jsx-runtime') return jsxRuntime
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

export class NativeRuntime {
  private readonly active = new Map<string, Activation>()
  private readonly pending = new Map<string, Activation>()
  private readonly writes = new Map<string, Promise<void>>()
  private readonly reportCleanupError: (id: string, error: unknown) => void
  private readonly data: NativeDataStore

  constructor(data: NativeDataStore, reportCleanupError: (id: string, error: unknown) => void) {
    this.data = data
    this.reportCleanupError = reportCleanupError
  }

  async activate(pkg: NativePackage): Promise<void> {
    const id = pkg.manifest.id
    if (this.pending.has(id)) {
      throw new NativePackageError('ACTIVATION_BUSY', `${id} is already starting.`)
    }
    const previous = this.active.get(id)
    if (previous && previous.package.sourceUrl !== pkg.sourceUrl) {
      throw new NativePackageError('SOURCE_CONFLICT', `${id} is already active from a different manifest URL.`)
    }
    const stage: Activation = {
      package: pkg,
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
        const previousWrite = this.writes.get(id) ?? Promise.resolve()
        const write = previousWrite.then(() => this.data.save(id, snapshot))
        const tail = write.catch(() => undefined)
        this.writes.set(id, tail)
        try {
          await write
        } finally {
          if (this.writes.get(id) === tail) this.writes.delete(id)
        }
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
      const start = new Promise<void>(resolve => resolve(createExtension(pkg.entry).activate(context)))
      await Promise.race([start, cancelled])
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
