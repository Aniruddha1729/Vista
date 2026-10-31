import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch, resolveApiUrl } from '../auth/authenticatedFetch'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './ProfilePage.css'

type ProfileForm = {
  name: string; phone: string; gender: string; dob: string; college: string; degree: string; branch: string;
  graduationYear: string; city: string; state: string; skills: string; bio: string; linkedin: string; github: string; portfolio: string
}

function initialForm(name: string, profile: Record<string, unknown>): ProfileForm {
  const value = (key: string) => String(profile[key] ?? '')
  const dob = value('dob')
  return {
    name, phone: value('phone'), gender: value('gender'), dob: dob ? dob.slice(0, 10) : '',
    college: value('college'), degree: value('degree'), branch: value('branch'), graduationYear: value('graduationYear'),
    city: value('city'), state: value('state'), skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
    bio: value('bio'), linkedin: value('linkedin'), github: value('github'), portfolio: value('portfolio'),
  }
}

function ProfilePage() {
  const { user, accessToken, updateUser } = useAuth()
  const [form, setForm] = useState(() => initialForm(user?.name || '', user?.profile || {}))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [bank, setBank] = useState({ accountHolder: '', bankName: '', ifsc: '', accountNumber: '', accountLast4: '' })
  const [bankMessage, setBankMessage] = useState('')
  const [bankError, setBankError] = useState('')
  const [savingBank, setSavingBank] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    authenticatedFetch('/api/auth/profile/payout-bank', { credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => response.ok ? response.json() as Promise<{ bank: { accountHolder: string; bankName: string; ifsc: string; accountLast4: string } | null }> : null)
      .then((result) => { if (result?.bank) setBank({ ...result.bank, accountNumber: '' }) })
      .catch(() => undefined)
  }, [accessToken])

  async function saveBankDetails() {
    if (!accessToken) return
    setSavingBank(true); setBankError(''); setBankMessage('')
    try {
      const response = await authenticatedFetch('/api/auth/profile/payout-bank', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(bank) })
      const result = await response.json() as { bank?: { accountHolder: string; bankName: string; ifsc: string; accountLast4: string }; message?: string }
      if (!response.ok || !result.bank) throw new Error(result.message || 'Could not save bank details.')
      setBank({ ...result.bank, accountNumber: '' }); setBankMessage('Bank details saved securely.');
    } catch (error) { setBankError(error instanceof Error ? error.message : 'Could not save bank details.') }
    finally { setSavingBank(false) }
  }

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken) return
    setSaving(true)
    setError('')
    setMessage('')
    const profile = {
      phone: form.phone, gender: form.gender, dob: form.dob || undefined,
      college: form.college, degree: form.degree, branch: form.branch,
      graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
      city: form.city, state: form.state,
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      bio: form.bio, linkedin: form.linkedin, github: form.github, portfolio: form.portfolio,
    }
    try {
      const response = await authenticatedFetch('/api/auth/profile', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: form.name, profile }),
      })
      const result = await response.json() as { user?: typeof user; message?: string }
      if (!response.ok || !result.user) throw new Error(result.message || 'Could not save your profile.')
      updateUser(result.user)
      setMessage('Profile saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file || !accessToken) return
    setUploading(true)
    setError('')
    setMessage('')
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const response = await authenticatedFetch('/api/auth/avatar', { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` }, body: formData })
      const result = await response.json() as { user?: typeof user; message?: string }
      if (!response.ok || !result.user) throw new Error(result.message || 'Could not upload the photo.')
      updateUser(result.user)
      setMessage('Profile photo updated.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the photo.')
    } finally {
      setUploading(false)
    }
  }

  const field = (key: keyof ProfileForm, label: string, type = 'text') => (
    <label className="profile-field">{label}<input type={type} value={form[key]} onChange={(event) => setField(key, event.target.value)} /></label>
  )

  return (
    <div className="profile-page">
      <div className="profile-layout">
      <aside className="profile-sidebar"><SidebarUnfoldableExample /></aside>
      <main className="profile-main">
        <header className="profile-heading"><span className="section-eyebrow">Your Vista profile</span><h1>Make it<br /><em>yours.</em></h1></header>
        <section className="profile-photo-card">
          <div className="profile-photo-preview">{user?.avatarUrl ? <img src={String(resolveApiUrl(user.avatarUrl))} alt={`${user.name} profile`} /> : <span>{user?.name?.[0]?.toUpperCase() || 'V'}</span>}</div>
          <div><h2>{user?.name}</h2><p>Profile photo · JPG, PNG, or WebP up to 5 MB. Stored on this server.</p><label className="profile-upload-button">{uploading ? 'Uploading…' : 'Upload photo'}<input accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void uploadAvatar(event.target.files?.[0])} type="file" /></label></div>
        </section>
        <form className="profile-form" onSubmit={saveProfile}>
          <section className="profile-section"><h2>Personal</h2><div className="profile-fields">{field('name', 'Full name')}{field('phone', 'Phone number', 'tel')}{field('gender', 'Gender')}{field('dob', 'Date of birth', 'date')}{field('city', 'City')}{field('state', 'State')}<label className="profile-field profile-wide">Bio<textarea maxLength={1000} value={form.bio} onChange={(event) => setField('bio', event.target.value)} /></label></div></section>
          <section className="profile-section"><h2>Education</h2><div className="profile-fields">{field('college', 'College / university')}{field('degree', 'Degree')}{field('branch', 'Branch / major')}{field('graduationYear', 'Graduation year', 'number')}</div></section>
          <section className="profile-section"><h2>Skills</h2><div className="profile-fields"><label className="profile-field profile-wide">Skills, separated by commas<input value={form.skills} onChange={(event) => setField('skills', event.target.value)} placeholder="React, Node.js, Product design" /></label></div></section>
          <section className="profile-section"><h2>Links</h2><div className="profile-fields">{field('linkedin', 'LinkedIn URL', 'url')}{field('github', 'GitHub URL', 'url')}{field('portfolio', 'Portfolio URL', 'url')}</div></section>
          <section className="profile-section"><h2>Organiser payouts</h2><p>Bank details are encrypted before they are stored. Vista only shows the last four account digits.</p><div className="profile-fields">
            <label className="profile-field">Account holder<input autoComplete="off" value={bank.accountHolder} onChange={(event) => setBank({ ...bank, accountHolder: event.target.value })} /></label>
            <label className="profile-field">Bank name<input autoComplete="off" value={bank.bankName} onChange={(event) => setBank({ ...bank, bankName: event.target.value })} /></label>
            <label className="profile-field">IFSC code<input autoComplete="off" maxLength={11} value={bank.ifsc} onChange={(event) => setBank({ ...bank, ifsc: event.target.value.toUpperCase() })} /></label>
            <label className="profile-field">Account number{bank.accountLast4 && <small>Saved account ending {bank.accountLast4}; enter again to replace it.</small>}<input autoComplete="new-password" inputMode="numeric" value={bank.accountNumber} onChange={(event) => setBank({ ...bank, accountNumber: event.target.value.replace(/\D/g, '') })} /></label>
          </div>{bankError && <p className="profile-error" role="alert">{bankError}</p>}{bankMessage && <p className="profile-saved" role="status">{bankMessage}</p>}<button className="profile-save" disabled={savingBank} onClick={() => void saveBankDetails()} type="button">{savingBank ? 'Saving…' : 'Save payout details'} <span>↗</span></button></section>
          {error && <p className="profile-error" role="alert">{error}</p>}{message && <p className="profile-saved" role="status">{message}</p>}
          <button className="profile-save" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save profile'} <span>↗</span></button>
        </form>
      </main>
      </div>
    </div>
  )
}

export default ProfilePage
