import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { SyntaxErrorBoundary } from '../core/ErrorBoundary'
import {
  RESERVED_HOST_IDS,
  getCompatibility,
  getEffectivePermissions,
  type SyntaxPackageManifest,
} from '../core/packages'
import { getVaultArchive } from '../core/packageVault'
import type { PluginBlockResult } from '../core/pluginBridge'
import { useInstalledPackages, useRegistryStore } from '../core/registry'
import { PluginSandboxFrame } from '../core/sandbox'
import { PackageIcon } from '../ui/PackageIcon'

interface CustomCourseStageProps {
  course: SyntaxPackageManifest
  theme: 'light' | 'dark'
}

export default function CustomCourseStage({ course, theme }: CustomCourseStageProps) {
  const installed = useInstalledPackages()
  const setPackageEnabled = useRegistryStore(s => s.setPackageEnabled)
  const units = course.customCourse?.units ?? []
  const [selectedChoice, setSelectedChoice] = useState<Record<string, number>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [blockResults, setBlockResults] = useState<Record<string, PluginBlockResult>>({})
  const [vaultHtmlById, setVaultHtmlById] = useState<Record<string, string>>({})

  const installedById = useMemo(
    () => new Map(installed.map(r => [r.manifest.id, r])),
    [installed],
  )

  const hasInlineBlocks = useMemo(
    () => units.some(u => u.lessons.some(l => Boolean(l.blocks && l.blocks.length > 0))),
    [units],
  )

  const requiredPluginIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [depKey] of Object.entries(getCompatibility(course).depends)) {
      if (!RESERVED_HOST_IDS.has(depKey)) ids.add(depKey)
    }
    for (const u of units) {
      for (const l of u.lessons) {
        for (const b of l.blocks ?? []) ids.add(b.plugin)
      }
    }
    return [...ids]
  }, [course, units])

  // Hydrate sandboxHtml from IndexedDB PackageVault for any large embedded plugin
  useEffect(() => {
    let cancelled = false
    for (const id of requiredPluginIds) {
      const rec = installedById.get(id)
      if (!rec || rec.manifest.sandboxHtml || vaultHtmlById[id]) continue
      void getVaultArchive(id).then(vault => {
        if (!cancelled && vault?.sandboxHtml) {
          setVaultHtmlById(prev => ({ ...prev, [id]: vault.sandboxHtml! }))
        }
      })
    }
    return () => {
      cancelled = true
    }
  }, [requiredPluginIds, installedById, vaultHtmlById])

  // Legacy v1 top-of-page embedded sandboxes when course doesn't declare inline lesson.blocks
  const legacyTopSandboxes = useMemo(() => {
    if (hasInlineBlocks) return []
    return requiredPluginIds
      .map(id => installedById.get(id))
      .filter((r): r is NonNullable<typeof r> =>
        Boolean(r && r.enabled && (r.manifest.sandboxHtml || vaultHtmlById[r.manifest.id])),
      )
      .map(r => r.manifest)
  }, [hasInlineBlocks, requiredPluginIds, installedById, vaultHtmlById])

  return (
    <main className="sx-course-page">
      <div className="sx-course-hero">
        <PackageIcon id={course.id} kind={course.kind} svg={course.iconSvg} size={52} />
        <div>
          <h1>{course.name}</h1>
          <span className="sx-modal-meta">@{course.author.handle}</span>
        </div>
      </div>

      {legacyTopSandboxes.map(sandboxPkg => {
        const html = sandboxPkg.sandboxHtml ?? vaultHtmlById[sandboxPkg.id]
        if (!html) return null
        return (
          <SyntaxErrorBoundary
            key={sandboxPkg.id}
            scope={`embedded-plugin:${sandboxPkg.id}`}
            pluginName={sandboxPkg.name}
            onDisablePlugin={() => setPackageEnabled(sandboxPkg.id, false)}
            resetKeys={[sandboxPkg.id]}
          >
            <PluginSandboxFrame
              pluginId={sandboxPkg.id}
              title={sandboxPkg.name}
              html={html}
              theme={theme}
              permissions={getEffectivePermissions(sandboxPkg)}
              networkAccess={sandboxPkg.safety.networkAccess}
              onDisablePlugin={() => setPackageEnabled(sandboxPkg.id, false)}
            />
          </SyntaxErrorBoundary>
        )
      })}

      {units.map((unit, uIdx) => (
        <section key={`${uIdx}:${unit.title}`} className="sx-course-lessons">
          <h2>{unit.title}</h2>
          {unit.lessons.map(lesson => {
            const picked = selectedChoice[lesson.id]
            const isChecked = Boolean(checked[lesson.id])
            const isRight =
              isChecked &&
              typeof lesson.answerIndex === 'number' &&
              picked === lesson.answerIndex

            return (
              <article key={lesson.id} className="sx-course-lesson-card">
                <strong>{lesson.title}</strong>
                {lesson.prompt && <p className="sx-modal-copy">{lesson.prompt}</p>}

                {/* Inline Interactive Plugin Lesson Blocks */}
                {(lesson.blocks ?? []).map((block, bIdx) => {
                  const blockKey = `${lesson.id}:${block.id ?? bIdx}`
                  const rec = installedById.get(block.plugin)
                  const html = rec?.manifest.sandboxHtml ?? vaultHtmlById[block.plugin]
                  const blockDef = rec?.manifest.contributes?.blocks?.find(
                    b => b.type === block.type,
                  )
                  const result = blockResults[blockKey]

                  if (!rec || !rec.enabled || !html) {
                    return (
                      <div key={blockKey} className="sx-inline-block-missing">
                        Block <code>{block.type}</code> requires active plugin{' '}
                        <code>{block.plugin}</code>.
                      </div>
                    )
                  }

                  return (
                    <div key={blockKey} className="sx-inline-block-wrap">
                      {(block.title || result) && (
                        <div className="sx-inline-block-head">
                          <span>{block.title ?? blockDef?.title ?? rec.manifest.name}</span>
                          {result && (
                            <span
                              className={`sx-status-pill${result.correct ? ' is-ok' : ''}`}
                            >
                              {result.correct && (
                                <CheckCircle2 size={12} aria-hidden="true" />
                              )}
                              <span>
                                {result.summary ??
                                  (result.correct
                                    ? 'Completed'
                                    : typeof result.score === 'number'
                                      ? `Score ${Math.round(result.score * 100)}%`
                                      : 'Updated')}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                      <SyntaxErrorBoundary
                        scope={`lesson-block:${block.plugin}:${blockKey}`}
                        pluginName={rec.manifest.name}
                        onDisablePlugin={() => setPackageEnabled(rec.manifest.id, false)}
                        resetKeys={[blockKey]}
                      >
                        <PluginSandboxFrame
                          pluginId={rec.manifest.id}
                          title={block.title ?? rec.manifest.name}
                          html={html}
                          theme={theme}
                          minHeight={blockDef?.minHeight ?? 240}
                          permissions={getEffectivePermissions(rec.manifest)}
                          networkAccess={rec.manifest.safety.networkAccess}
                          blockProps={block.props}
                          onResult={res =>
                            setBlockResults(prev => ({ ...prev, [blockKey]: res }))
                          }
                          onDisablePlugin={() => setPackageEnabled(rec.manifest.id, false)}
                        />
                      </SyntaxErrorBoundary>
                    </div>
                  )
                })}

                {lesson.choices && lesson.choices.length > 0 && (
                  <div className="sx-course-choices">
                    {lesson.choices.map((choice, cIdx) => {
                      const cls =
                        isChecked && picked === cIdx
                          ? isRight
                            ? ' is-correct'
                            : ' is-wrong'
                          : ''
                      return (
                        <button
                          key={`${lesson.id}:${cIdx}`}
                          type="button"
                          aria-pressed={picked === cIdx}
                          className={`sx-course-choice${cls}`}
                          style={
                            !isChecked && picked === cIdx
                              ? { borderColor: 'var(--accent-blue, #456dff)' }
                              : undefined
                          }
                          onClick={() => {
                            setSelectedChoice(prev => ({ ...prev, [lesson.id]: cIdx }))
                            setChecked(prev => ({ ...prev, [lesson.id]: false }))
                          }}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                )}
                {lesson.choices && typeof picked === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      className="sx-btn-primary"
                      onClick={() => setChecked(prev => ({ ...prev, [lesson.id]: true }))}
                    >
                      Check
                    </button>
                    {isChecked && (
                      <span className={`sx-status-pill${isRight ? ' is-ok' : ''}`}>
                        {isRight ? 'Correct' : 'Try again'}
                      </span>
                    )}
                  </div>
                )}
                {isChecked && lesson.explanation && (
                  <p className="sx-modal-copy">{lesson.explanation}</p>
                )}
              </article>
            )
          })}
        </section>
      ))}
    </main>
  )
}
