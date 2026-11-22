import type { ReactNode } from 'react'
import { Segmented, Spinner, Toggle } from './Controls'
import { notificationGroups, type BooleanPreference } from './notificationGroups'
import { useVoiceSample } from './useVoiceSample'
import type { usePreferences } from './usePreferences'

function Row({ label, children, choices = false }: { label: string; children: ReactNode; choices?: boolean }) {
  return <div className={`preference-row${choices ? ' preference-choices' : ''}`}>
    <p>{label}</p>{children}
  </div>
}

export function PreferencesPage({ settings }: { settings: ReturnType<typeof usePreferences> }) {
  const { preferences: p, pending, spinners, change } = settings
  const voice = useVoiceSample()
  if (!p) return <main className="initial-loading" aria-label="Loading preferences">
    {settings.error ? <p role="alert">{settings.error} <button onClick={settings.retry}>Retry</button></p> : <Spinner />}
  </main>
  const toggle = (key: BooleanPreference, label: string) => <Row key={key} label={label}>
    <Toggle label={label} checked={p[key]} disabled={pending[key]} loading={spinners[key]}
      onChange={value => { if (key === 'narration' && !value) voice.stop(); void change(key, value) }} />
  </Row>
  return <main className="settings-layout">
    <nav className="settings-nav" aria-label="Settings">
      <a href="/settings/account/">Account</a>
      <a href="/settings/preferences/" aria-current="page">Preferences</a>
    </nav>
    <a className="settings-back" href="/settings/account/" aria-label="Back to settings">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m14.5 3-9 9 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
    <article className="preferences" aria-label="Preferences" data-ready="true">
      <section aria-labelledby="appearance-title">
        <h2 id="appearance-title">Appearance</h2>
        <div className="preference-rows">
          <Row label="Choose your preferred color mode" choices>
            <Segmented label="Color mode" value={p.colorMode} onChange={v => void change('colorMode', v)}
              options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </Row>
          <Row label="Reduce motion" choices>
            <Segmented label="Reduce motion" value={p.motion} disabled={pending.motion} loading={spinners.motion}
              onChange={v => void change('motion', v)}
              options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'system', label: 'Auto' }]} />
          </Row>
        </div>
      </section>
      <hr />
      <section aria-labelledby="sounds-title">
        <h2 id="sounds-title">Sounds</h2>
        <div className="preference-rows">
          {toggle('narration', 'Enable Koji narration in lessons')}
          {p.narration && <Row label="Choose Koji’s Voice" choices>
            <div className="voice-controls">
              <button type="button" className="voice-play" aria-label="Play voice sample" onClick={() => void voice.play(p.voice)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 0.233887L15.9437 8.00008L3 15.7663V0.233887Z" fill="currentColor" />
                </svg>
              </button>
              <Segmented label="Koji voice" value={p.voice} disabled={pending.voice} loading={spinners.voice}
                onChange={v => { void change('voice', v); void voice.play(v) }}
                options={[{ value: 'melodic', label: 'Melodic' }, { value: 'deep', label: 'Deep' }]} />
            </div>
          </Row>}
          {toggle('soundEffects', 'Enable sound effects in lessons')}
        </div>
        {voice.error && <p role="alert">{voice.error}</p>}
      </section>
      <hr />
      <section aria-labelledby="email-title" className="notification-section">
        <h2 id="email-title">Email notifications</h2>
        {notificationGroups.map(group => <div className="notification-group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="preference-rows">{group.items.map(item => toggle(item.key, item.title))}</div>
        </div>)}
        <div className="notification-group">
          <h3>Global Settings</h3>
          {toggle('unsubscribeAll', "Don't send me anything (aside from vital account emails such as password reset notifications)")}
        </div>
      </section>
    </article>
  </main>
}
