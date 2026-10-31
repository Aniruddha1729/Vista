import { useState } from 'react'
import type { FormEvent } from 'react'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import { useTheme } from '../theme/useTheme'
import { Link } from 'react-router-dom'
import './SettingsPage.css'

type SidebarStyle = 'hover' | 'dock'

function SettingsPage() {
  const { user, accessToken, updateUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [savingStyle, setSavingStyle] = useState(false)
  const [styleMessage, setStyleMessage] = useState('')
  const [styleError, setStyleError] = useState('')
  const [reportMessage, setReportMessage] = useState('')
  const [reportError, setReportError] = useState('')
  const [sendingReport, setSendingReport] = useState(false)

  async function saveSidebarStyle(sidebarStyle: SidebarStyle) {
    if (!accessToken || sidebarStyle === user?.sidebarStyle) return
    setSavingStyle(true)
    setStyleError('')
    setStyleMessage('')
    try {
      const response = await authenticatedFetch('/api/auth/settings', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ sidebarStyle }),
      })
      const result = await response.json() as { user?: typeof user; message?: string }
      if (!response.ok || !result.user) throw new Error(result.message || 'Could not save this preference.')
      updateUser(result.user)
      setStyleMessage('Navigation preference saved.')
    } catch (saveError) {
      setStyleError(saveError instanceof Error ? saveError.message : 'Could not save this preference.')
    } finally {
      setSavingStyle(false)
    }
  }

  async function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken) return
    const form = event.currentTarget
    setSendingReport(true)
    setReportError('')
    setReportMessage('')
    try {
      const response = await authenticatedFetch('/api/auth/report-issue', {
        method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` }, body: new FormData(form),
      })
      const result = await response.json() as { message?: string }
      if (!response.ok) throw new Error(result.message || 'Could not send the report.')
      setReportMessage(result.message || 'Issue report sent.')
      form.reset()
    } catch (reportFailure) {
      setReportError(reportFailure instanceof Error ? reportFailure.message : 'Could not send the report.')
    } finally {
      setSendingReport(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-layout">
        <aside className="settings-sidebar"><SidebarUnfoldableExample /></aside>
        <main className="settings-main">
          <header><span className="section-eyebrow">Your preferences</span><h1>Settings</h1></header>
          <section className="settings-card">
            <div className="settings-card-heading"><div><span className="section-eyebrow">Display</span><h2>Choose your navigation.</h2></div><span className="settings-current">Current: {user?.sidebarStyle === 'dock' ? 'Dock' : 'Hover sidebar'}</span></div>
            <div className="sidebar-style-options">
              <button className={`sidebar-style-option${user?.sidebarStyle !== 'dock' ? ' selected' : ''}`} disabled={savingStyle} onClick={() => void saveSidebarStyle('hover')} type="button">
                <span className="sidebar-preview sidebar-preview-hover"><i>V</i><i>⌕</i><i>♡</i><i>◷</i></span><strong>Hover sidebar</strong><small>Expand the current side navigation on hover.</small>
              </button>
              <button className={`sidebar-style-option${user?.sidebarStyle === 'dock' ? ' selected' : ''}`} disabled={savingStyle} onClick={() => void saveSidebarStyle('dock')} type="button">
                <span className="sidebar-preview sidebar-preview-dock"><i>⌕</i><i>♡</i><i>◷</i><i>⚙</i></span><strong>Dock</strong><small>A compact bottom dock with magnifying icons and labels.</small>
              </button>
            </div>
            {styleError && <p className="settings-error" role="alert">{styleError}</p>}{styleMessage && <p className="settings-saved" role="status">{styleMessage}</p>}
          </section>
          <section className="settings-card theme-setting-card">
            <div><span className="section-eyebrow">Appearance</span><h2>Color theme</h2><p>Currently using {theme} mode. By default, Vista follows your device setting.</p></div>
            <button className="settings-secondary-button" onClick={toggleTheme} type="button">Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button>
          </section>
          <section className="settings-card upgrade-plan-card">
            <div><span className="section-eyebrow">More room to grow</span><h2>{user?.plan === 'pro' ? 'You’re on Pro.' : 'Upgrade your plan.'}</h2><p>{user?.plan === 'pro' ? 'Your Pro plan includes unlimited invitations, permissions, and premium styles.' : 'Unlock unlimited invitations and event staff, plus premium event page styles for ₹500 per month.'}</p></div>
            <Link className="settings-submit" to="/plans">{user?.plan === 'pro' ? 'Manage plan' : 'View plans'} <span>↗</span></Link>
          </section>
          <section className="settings-card">
            <div className="settings-card-heading"><div><span className="section-eyebrow">Help us improve Vista</span><h2>Report an issue.</h2><p>We’ll include your name and email with the message.</p></div></div>
            <form className="issue-report-form" onSubmit={submitIssue}>
              <label>Subject<input name="subject" required maxLength={150} minLength={3} /></label>
              <label>Description<textarea name="description" required maxLength={5000} minLength={10} rows={6} /></label>
              <label>Screenshot (optional)<input name="screenshot" type="file" accept="image/png,image/jpeg" /></label>
              {reportError && <p className="settings-error" role="alert">{reportError}</p>}{reportMessage && <p className="settings-saved" role="status">{reportMessage}</p>}
              <button className="settings-submit" disabled={sendingReport} type="submit">{sendingReport ? 'Sending…' : 'Send report'} <span>↗</span></button>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}

export default SettingsPage
