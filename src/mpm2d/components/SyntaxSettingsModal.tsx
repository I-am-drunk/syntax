import { Dialog } from '@base-ui/react/dialog'
import { Segmented, Toggle } from '../../settings/Controls'
import type { SyntaxPrefs } from '../storage'

export function SyntaxSettingsModal({
  open,
  onClose,
  theme,
  onChangeTheme,
  soundOn,
  onChangeSound,
  prefs,
  onPatchPrefs,
  onReplayWelcome,
}: {
  open: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  onChangeTheme: (t: 'light' | 'dark') => void
  soundOn: boolean
  onChangeSound: (v: boolean) => void
  prefs: SyntaxPrefs
  onPatchPrefs: (patch: Partial<SyntaxPrefs>) => void
  onReplayWelcome: () => void
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={v => {
        if (!v) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="syntax-settings-backdrop" />
        <Dialog.Popup className="syntax-settings-popup" aria-label="Settings">
          <div className="syntax-settings-bar">
            <Dialog.Title className="syntax-settings-title">Preferences</Dialog.Title>
            <button
              type="button"
              className="syntax-settings-close"
              aria-label="Close settings"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="syntax-settings-scroll">
            <article className="preferences syntax-settings-article" data-ready="true">
              <section aria-labelledby="pref-appearance">
                <h2 id="pref-appearance">Appearance</h2>
                <div className="preference-rows">
                  <div className="preference-row preference-choices">
                    <p>Choose your preferred color mode</p>
                    <Segmented
                      label="Color mode"
                      value={theme}
                      onChange={onChangeTheme}
                      options={[
                        { value: 'light', label: 'Light' },
                        { value: 'dark', label: 'Dark' },
                      ]}
                    />
                  </div>
                </div>
              </section>

              <hr />

              <section aria-labelledby="pref-learning">
                <h2 id="pref-learning">Learning &amp; Draw Mode</h2>
                <div className="preference-rows">
                  <div className="preference-row">
                    <div className="syntax-pref-copy">
                      <p>Enable Draw Mode</p>
                      <span>Draw a checkmark anywhere on the page to submit &amp; continue</span>
                    </div>
                    <Toggle
                      label="Enable Draw Mode"
                      checked={prefs.drawMode}
                      onChange={v => onPatchPrefs({ drawMode: v })}
                    />
                  </div>
                  <div className="preference-row">
                    <div className="syntax-pref-copy">
                      <p>Show catch-up paths</p>
                      <span>Display optional Grade 9/10 prerequisite tracks before lessons</span>
                    </div>
                    <Toggle
                      label="Show catch-up paths"
                      checked={prefs.showCatchupPaths}
                      onChange={v => onPatchPrefs({ showCatchupPaths: v })}
                    />
                  </div>
                </div>
              </section>

              <hr />

              <section aria-labelledby="pref-sounds">
                <h2 id="pref-sounds">Sounds &amp; Sema</h2>
                <div className="preference-rows">
                  <div className="preference-row">
                    <div className="syntax-pref-copy">
                      <p>Enable Sema narration in walkthroughs</p>
                      <span>Spoken guidance synced to Sema’s live animations</span>
                    </div>
                    <Toggle
                      label="Enable Sema narration"
                      checked={prefs.voiceOn}
                      onChange={v => onPatchPrefs({ voiceOn: v })}
                    />
                  </div>
                  <div className="preference-row">
                    <div className="syntax-pref-copy">
                      <p>Enable sound effects in lessons</p>
                      <span>Subtle tactile audio for checks, hints, and completions</span>
                    </div>
                    <Toggle
                      label="Enable sound effects"
                      checked={soundOn}
                      onChange={onChangeSound}
                    />
                  </div>
                </div>
              </section>

              <hr />

              <section aria-labelledby="pref-guide">
                <h2 id="pref-guide">Getting Started</h2>
                <div className="preference-rows">
                  <div className="preference-row">
                    <div className="syntax-pref-copy">
                      <p>Welcome tour with Sema</p>
                      <span>Re-open theme and Draw Mode setup anytime</span>
                    </div>
                    <button
                      type="button"
                      className="plain-button syntax-pref-btn"
                      onClick={() => {
                        onClose()
                        onReplayWelcome()
                      }}
                    >
                      Replay tour
                    </button>
                  </div>
                </div>
              </section>
            </article>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
