import { create } from 'zustand'
import { extensionDiagnostics } from './diagnostics.ts'

export interface OwnedCommand {
  /** Globally unique key: `${ownerId}:${id}` */
  key: string
  id: string
  ownerId: string
  activationId: string
  title: string
  run: string
}

export interface OwnedToolbarItem {
  key: string
  id: string
  ownerId: string
  activationId: string
  label: string
  commandKey?: string
  viewId?: string
}

export interface OwnedView {
  key: string
  id: string
  ownerId: string
  activationId: string
  title: string
  entryUrl: string
  placement: 'page' | 'tab' | 'embed'
  docTypes: string[]
}

export interface StagedContributions {
  ownerId: string
  activationId: string
  commands: OwnedCommand[]
  toolbar: OwnedToolbarItem[]
  views: OwnedView[]
}

export interface ContributionStoreState {
  commands: OwnedCommand[]
  toolbar: OwnedToolbarItem[]
  views: OwnedView[]
  /** Atomically replaces prior contributions for staged.ownerId without disturbing other extensions. */
  commitStaged: (staged: StagedContributions) => void
  /** Removes every contribution owned by ownerId. */
  removeByOwner: (ownerId: string) => void
  clearAll: () => void
  getCommand: (key: string) => OwnedCommand | undefined
  getView: (ownerId: string, viewId: string) => OwnedView | undefined
}

export function qualifyContributionKey(ownerId: string, localId: string): string {
  return `${ownerId}:${localId}`
}

export const useContributionStore = create<ContributionStoreState>((set, get) => ({
  commands: [],
  toolbar: [],
  views: [],

  commitStaged(staged) {
    set(state => {
      const commands = [
        ...state.commands.filter(c => c.ownerId !== staged.ownerId),
        ...staged.commands,
      ]
      const toolbar = [
        ...state.toolbar.filter(t => t.ownerId !== staged.ownerId),
        ...staged.toolbar,
      ]
      const views = [
        ...state.views.filter(v => v.ownerId !== staged.ownerId),
        ...staged.views,
      ]
      extensionDiagnostics.setCounter('commands', commands.length)
      extensionDiagnostics.setCounter('toolbarItems', toolbar.length)
      return { commands, toolbar, views }
    })
  },

  removeByOwner(ownerId) {
    set(state => {
      const commands = state.commands.filter(c => c.ownerId !== ownerId)
      const toolbar = state.toolbar.filter(t => t.ownerId !== ownerId)
      const views = state.views.filter(v => v.ownerId !== ownerId)
      extensionDiagnostics.setCounter('commands', commands.length)
      extensionDiagnostics.setCounter('toolbarItems', toolbar.length)
      return { commands, toolbar, views }
    })
  },

  clearAll() {
    extensionDiagnostics.setCounter('commands', 0)
    extensionDiagnostics.setCounter('toolbarItems', 0)
    set({ commands: [], toolbar: [], views: [] })
  },

  getCommand(key) {
    return get().commands.find(c => c.key === key)
  },

  getView(ownerId, viewId) {
    return get().views.find(v => v.ownerId === ownerId && v.id === viewId)
  },
}))
