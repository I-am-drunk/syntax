import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  BookOpen,
  Compass,
  FileText,
  Home,
  Library,
  Moon,
  Puzzle,
  Search,
  Settings,
  Sun,
  Terminal,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContributionStore } from '../extensions/contributions.ts'
import { documentStore, type DocumentEnvelope } from '../extensions/documents.ts'
import { extensionManager } from '../extensions/manager.ts'
import { useExtensionStore } from '../extensions/store.ts'

export interface CommandPaletteProps {
  open: boolean
  theme: 'light' | 'dark'
  soundOn: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (path: string) => void
  onToggleTheme: () => void
  onToggleSound: () => void
}

interface PaletteItem {
  id: string
  group: 'Commands' | 'Courses & Extensions' | 'Saved Documents' | 'Workspace'
  title: string
  subtitle?: string
  keywords: string
  icon: 'command' | 'course' | 'extension' | 'doc' | 'home' | 'library' | 'hub' | 'settings' | 'profile' | 'theme' | 'sound'
  run: () => void
}

export function CommandPalette({
  open,
  theme,
  soundOn,
  onOpenChange,
  onNavigate,
  onToggleTheme,
  onToggleSound,
}: CommandPaletteProps) {
  const records = useExtensionStore(s => s.records)
  const runtimeById = useExtensionStore(s => s.runtime)
  const commands = useContributionStore(s => s.commands)
  const views = useContributionStore(s => s.views)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [documents, setDocuments] = useState<DocumentEnvelope[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    let cancelled = false
    void documentStore.list().then(list => {
      if (!cancelled) setDocuments(list)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const nameById = new Map(records.map(r => [r.id, r.manifest.name]))
    const kindById = new Map(records.map(r => [r.id, r.manifest.kind]))
    const nonEmbedViews = views.filter(v => v.placement !== 'embed')

    const list: PaletteItem[] = []

    for (const cmd of commands) {
      const rt = runtimeById[cmd.ownerId]
      if (rt && rt.status === 'failed' && !rt.hasLiveWorker) continue
      const ownerName = nameById.get(cmd.ownerId) ?? cmd.ownerId
      list.push({
        id: `cmd:${cmd.key}`,
        group: 'Commands',
        title: cmd.title,
        subtitle: ownerName,
        keywords: `${cmd.title} ${ownerName} ${cmd.id} command`,
        icon: 'command',
        run: () => {
          void extensionManager.runCommand(cmd.key).catch(err => {
            toast.error(`${ownerName}: ${err instanceof Error ? err.message : String(err)}`)
          })
        },
      })
    }

    for (const view of nonEmbedViews) {
      const ownerName = nameById.get(view.ownerId) ?? view.ownerId
      const isCourse = kindById.get(view.ownerId) === 'course'
      list.push({
        id: `view:${view.key}`,
        group: 'Courses & Extensions',
        title: view.title,
        subtitle: isCourse ? `${ownerName} · Course` : ownerName,
        keywords: `${view.title} ${ownerName} ${view.ownerId} ${isCourse ? 'course' : 'extension'}`,
        icon: isCourse ? 'course' : 'extension',
        run: () =>
          onNavigate(
            `/ext/${encodeURIComponent(view.ownerId)}/${encodeURIComponent(view.id)}`,
          ),
      })
    }

    for (const doc of documents) {
      const ownerName = nameById.get(doc.createdByExtensionId) ?? doc.createdByExtensionId
      const ownerViews = nonEmbedViews.filter(v => v.ownerId === doc.createdByExtensionId)
      const matchingView =
        ownerViews.find(v => v.docTypes.includes(doc.type)) ?? ownerViews[0]
      const viewId = matchingView?.id ?? 'main'
      list.push({
        id: `doc:${doc.id}`,
        group: 'Saved Documents',
        title: doc.title,
        subtitle: `${doc.type} · ${ownerName}`,
        keywords: `${doc.title} ${doc.type} ${ownerName} document`,
        icon: 'doc',
        run: () =>
          onNavigate(
            `/ext/${encodeURIComponent(doc.createdByExtensionId)}/${encodeURIComponent(viewId)}/${encodeURIComponent(doc.id)}`,
          ),
      })
    }

    list.push(
      {
        id: 'nav:home',
        group: 'Workspace',
        title: 'Go to Home',
        subtitle: 'Workspace overview',
        keywords: 'home start overview',
        icon: 'home',
        run: () => onNavigate('/'),
      },
      {
        id: 'nav:library',
        group: 'Workspace',
        title: 'Go to Library',
        subtitle: 'Courses, extensions, and saved documents',
        keywords: 'library courses documents widgets',
        icon: 'library',
        run: () => onNavigate('/library'),
      },
      {
        id: 'nav:extensions',
        group: 'Workspace',
        title: 'Manage Extensions & Courses',
        subtitle: 'Install, update, settings, and logs',
        keywords: 'extensions courses install plugins logs',
        icon: 'extension',
        run: () => onNavigate('/extensions'),
      },
      {
        id: 'nav:community',
        group: 'Workspace',
        title: 'Browse Community Hub',
        subtitle: 'Discover published packages',
        keywords: 'community hub catalog discover store',
        icon: 'hub',
        run: () => onNavigate('/community'),
      },
      {
        id: 'nav:settings',
        group: 'Workspace',
        title: 'Open Settings',
        subtitle: 'Appearance, sound, and Sema companion',
        keywords: 'settings preferences sema theme sound',
        icon: 'settings',
        run: () => onNavigate('/settings'),
      },
      {
        id: 'nav:profile',
        group: 'Workspace',
        title: 'Open Profile & Cloud Sync',
        subtitle: 'Account and sync status',
        keywords: 'profile account sync clerk',
        icon: 'profile',
        run: () => onNavigate('/profile'),
      },
      {
        id: 'act:theme',
        group: 'Workspace',
        title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: 'Change appearance',
        keywords: 'theme dark light mode appearance',
        icon: 'theme',
        run: onToggleTheme,
      },
      {
        id: 'act:sound',
        group: 'Workspace',
        title: soundOn ? 'Mute Sound Effects' : 'Enable Sound Effects',
        subtitle: 'Toggle interface audio',
        keywords: 'sound audio mute unmute',
        icon: 'sound',
        run: onToggleSound,
      },
    )

    return list
  }, [records, runtimeById, commands, views, documents, theme, soundOn, onNavigate, onToggleTheme, onToggleSound])

  const filtered = useMemo(() => {
    const joined = query.trim().toLowerCase()
    const tokens = joined.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) {
      let docCount = 0
      return items.filter(item => {
        if (item.group !== 'Saved Documents') return true
        docCount += 1
        return docCount <= 10
      })
    }
    const scored: Array<{ item: PaletteItem; score: number }> = []
    for (const item of items) {
      const titleLower = item.title.toLowerCase()
      const hay = `${titleLower} ${(item.subtitle ?? '').toLowerCase()} ${item.keywords.toLowerCase()}`
      if (!tokens.every(tok => hay.includes(tok))) continue
      let score = 1
      if (titleLower.includes(joined)) score = 3
      else if (tokens.every(tok => titleLower.includes(tok))) score = 2
      scored.push({ item, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.map(entry => entry.item)
  }, [items, query])

  const grouped = useMemo(() => {
    const order: PaletteItem['group'][] = [
      'Commands',
      'Courses & Extensions',
      'Saved Documents',
      'Workspace',
    ]
    const sections = order
      .map(group => ({
        group,
        entries: filtered.filter(i => i.group === group),
      }))
      .filter(section => section.entries.length > 0)

    if (query.trim()) {
      const firstIndex = new Map<PaletteItem['group'], number>()
      filtered.forEach((item, idx) => {
        if (!firstIndex.has(item.group)) firstIndex.set(item.group, idx)
      })
      sections.sort((a, b) => (firstIndex.get(a.group) ?? 999) - (firstIndex.get(b.group) ?? 999))
    }
    return sections
  }, [filtered, query])

  const flatItems = useMemo(() => grouped.flatMap(section => section.entries), [grouped])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const safeIndex = flatItems.length > 0 ? Math.min(activeIndex, flatItems.length - 1) : 0

  useEffect(() => {
    if (!open) return
    const selectedEl = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [open, safeIndex, query])

  function executeItem(item: PaletteItem) {
    onOpenChange(false)
    item.run()
  }

  function renderIcon(kind: PaletteItem['icon']) {
    switch (kind) {
      case 'command':
        return <Terminal size={15} aria-hidden="true" />
      case 'course':
        return <BookOpen size={15} aria-hidden="true" />
      case 'extension':
        return <Puzzle size={15} aria-hidden="true" />
      case 'doc':
        return <FileText size={15} aria-hidden="true" />
      case 'home':
        return <Home size={15} aria-hidden="true" />
      case 'library':
        return <Library size={15} aria-hidden="true" />
      case 'hub':
        return <Compass size={15} aria-hidden="true" />
      case 'settings':
        return <Settings size={15} aria-hidden="true" />
      case 'profile':
        return <User size={15} aria-hidden="true" />
      case 'theme':
        return theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />
      case 'sound':
        return soundOn ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />
    }
  }

  let flatIdx = -1

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sx-modal-backdrop" />
        <Dialog.Popup
          className="sx-modal sx-cmd-palette sx-dialog-popup"
          aria-label="Quick search and commands"
          data-testid="command-palette"
        >
          <div className="sx-cmd-input-row">
            <Search size={16} className="sx-cmd-search-icon" aria-hidden="true" />
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls="sx-cmd-listbox"
              aria-activedescendant={flatItems[safeIndex] ? `sx-cmd-opt-${safeIndex}` : undefined}
              className="sx-cmd-input"
              placeholder="Search commands, courses, extensions, documents..."
              aria-label="Search commands and workspace"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (flatItems.length > 0) setActiveIndex(i => (i + 1) % flatItems.length)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (flatItems.length > 0) {
                    setActiveIndex(i => (i - 1 + flatItems.length) % flatItems.length)
                  }
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  setActiveIndex(0)
                } else if (e.key === 'End') {
                  e.preventDefault()
                  if (flatItems.length > 0) setActiveIndex(flatItems.length - 1)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const picked = flatItems[safeIndex]
                  if (picked) executeItem(picked)
                }
              }}
              autoFocus
            />
            <kbd className="sx-kbd">Esc</kbd>
          </div>

          <div
            id="sx-cmd-listbox"
            ref={listRef}
            className="sx-cmd-results"
            role="listbox"
            aria-label="Results"
          >
            {grouped.length === 0 ? (
              <div className="sx-cmd-empty">No matching commands, views, or documents.</div>
            ) : (
              grouped.map(section => (
                <div key={section.group} className="sx-cmd-group">
                  <div className="sx-cmd-group-label">{section.group}</div>
                  {section.entries.map(item => {
                    flatIdx += 1
                    const idx = flatIdx
                    const selected = idx === safeIndex
                    return (
                      <button
                        key={item.id}
                        id={`sx-cmd-opt-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`sx-cmd-item${selected ? ' is-selected' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => executeItem(item)}
                      >
                        <span className="sx-cmd-item-icon">{renderIcon(item.icon)}</span>
                        <span className="sx-cmd-item-copy">
                          <strong>{item.title}</strong>
                          {item.subtitle && <small>{item.subtitle}</small>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="sx-cmd-footer" aria-hidden="true">
            <span><kbd className="sx-kbd">↑</kbd><kbd className="sx-kbd">↓</kbd> Navigate</span>
            <span><kbd className="sx-kbd">↵</kbd> Open</span>
            <span><kbd className="sx-kbd">Esc</kbd> Close</span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
