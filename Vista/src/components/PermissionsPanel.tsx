import { useState } from 'react'
import { eventsRequest } from '../data/eventsApi'
import type { EventRecord } from '../data/eventsApi'

type PermissionsPanelProps = { event: EventRecord; token: string; onChanged: (event: EventRecord) => void; isOwner: boolean }

function PermissionsPanel({ event, token, onChanged, isOwner }: PermissionsPanelProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function refreshStaff() {
    const result = await eventsRequest<{ event: EventRecord }>(`/${event._id}/manage`, token)
    onChanged(result.event)
  }

  async function addStaff(submitEvent: React.FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    setError('')
    setSaving(true)
    try {
      await eventsRequest(`/${event._id}/cohosts`, token, { method: 'POST', body: JSON.stringify({ email }) })
      setEmail('')
      await refreshStaff()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not add staff.')
    } finally {
      setSaving(false)
    }
  }

  async function removeStaff(userId: string) {
    try {
      await eventsRequest(`/${event._id}/cohosts/${userId}`, token, { method: 'DELETE' })
      await refreshStaff()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not remove staff.')
    }
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading"><div><span className="section-eyebrow">Event team</span><h2>Set event staff.</h2></div><span className="workspace-panel-count">{event.coHosts?.length || 0} staff members</span></div>
      {isOwner && <form className="permissions-add-form" onSubmit={addStaff}><label className="workspace-search"><span aria-hidden="true">⌕</span><input aria-label="Staff email" onChange={(input) => setEmail(input.target.value)} placeholder="Add a Vista account by email" required type="email" value={email} /></label><button className="workspace-resend" disabled={saving} type="submit">{saving ? 'Adding…' : 'Add staff'}</button></form>}
      {error && <p role="alert">{error}</p>}
      <div className="workspace-table" role="table" aria-label="Event staff">
        <div className="workspace-table-row workspace-table-header" role="row"><span>Username</span><span>Email</span><span>Access</span></div>
        {(event.coHosts || []).map((member) => <div className="workspace-table-row" key={member._id} role="row"><strong>{member.username}</strong><span>{member.email}</span>{isOwner && <button className="workspace-resend" onClick={() => removeStaff(member._id)} type="button">Remove</button>}</div>)}
        {!event.coHosts?.length && <p>No staff added yet.</p>}
      </div>
    </section>
  )
}

export default PermissionsPanel
