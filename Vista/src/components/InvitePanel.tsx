import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { eventsRequest } from '../data/eventsApi'
import type { EventRecord } from '../data/eventsApi'

type TemplateName = NonNullable<EventRecord['inviteTemplate']>
type InviteRecord = {
  _id: string
  inviteEmail: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
  createdAt: string
}

type InvitePanelProps = { event: EventRecord; token: string; onChanged: (event: EventRecord) => void }

const templates: { id: TemplateName; title: string; detail: string }[] = [
  { id: 'minimal', title: 'Minimal', detail: 'Clean, calm, and clear' },
  { id: 'bold-gradient', title: 'Bold Gradient', detail: 'Colorful and celebratory' },
  { id: 'dark-neon', title: 'Dark Neon', detail: 'A modern night-time look' },
  { id: 'formal', title: 'Formal', detail: 'A classic personal invitation' },
]

function InvitePanel({ event, token, onChanged }: InvitePanelProps) {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState('')
  const [template, setTemplate] = useState<TemplateName>(event.inviteTemplate || 'minimal')
  const [message, setMessage] = useState(event.inviteMessage || 'We would love to see you there.')
  const [invites, setInvites] = useState<InviteRecord[]>([])
  const [preview, setPreview] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadInvites = useCallback(async () => {
    const result = await eventsRequest<{ invites: InviteRecord[] }>(`/${event._id}/invites`, token)
    setInvites(result.invites)
  }, [event._id, token])

  useEffect(() => {
    eventsRequest<{ invites: InviteRecord[] }>(`/${event._id}/invites`, token)
      .then((result) => setInvites(result.invites))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load invitations.'))
  }, [event._id, token])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      eventsRequest<{ html: string }>(`/${event._id}/invite-preview`, token, {
        method: 'POST',
        body: JSON.stringify({ template, personalMessage: message }),
      }).then((result) => { if (!cancelled) setPreview(result.html) })
        .catch((previewError: unknown) => { if (!cancelled) setError(previewError instanceof Error ? previewError.message : 'Could not render the preview.') })
    }, 180)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [event._id, message, template, token])

  const filteredInvites = useMemo(() => {
    const term = query.trim().toLowerCase()
    return invites.filter((invite) => `${invite.inviteEmail} ${invite.status}`.toLowerCase().includes(term))
  }, [invites, query])

  async function saveDesign() {
    setError('')
    setBusy(true)
    try {
      const result = await eventsRequest<{ event: EventRecord }>(`/${event._id}`, token, {
        method: 'PATCH', body: JSON.stringify({ inviteTemplate: template, inviteMessage: message }),
      })
      onChanged(result.event)
      setStatusMessage('Invitation design saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the invitation design.')
    } finally {
      setBusy(false)
    }
  }

  async function sendInvite(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    setError('')
    setStatusMessage('')
    setBusy(true)
    try {
      const saved = await eventsRequest<{ event: EventRecord }>(`/${event._id}`, token, {
        method: 'PATCH', body: JSON.stringify({ inviteTemplate: template, inviteMessage: message }),
      })
      onChanged(saved.event)
      await eventsRequest(`/${event._id}/invites`, token, { method: 'POST', body: JSON.stringify({ email }) })
      setEmail('')
      await loadInvites()
      setStatusMessage('Invitation sent. It will stay pending until the recipient accepts.')
      setView('list')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the invitation.')
    } finally {
      setBusy(false)
    }
  }

  async function resendInvite(inviteId: string) {
    setError('')
    try {
      await eventsRequest(`/${event._id}/invites/${inviteId}/resend`, token, { method: 'POST' })
      setStatusMessage('Invitation sent again.')
      await loadInvites()
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the invitation.')
    }
  }

  async function deleteInvite(invite: InviteRecord) {
    if (!window.confirm(`Delete the pending invitation for ${invite.inviteEmail}?`)) return
    try {
      await eventsRequest(`/${event._id}/invites/${invite._id}`, token, { method: 'DELETE' })
      await loadInvites()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the invitation.')
    }
  }

  return (
    <section className="invite-panel">
      <div className="invite-panel-heading">
        <div><span className="section-eyebrow">Guest list</span><h2>Invite your campus community.</h2></div>
        <div className="invite-toggle" role="tablist" aria-label="Invitation options">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} role="tab" type="button">List of invites</button>
          <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')} role="tab" type="button">Edit invitation</button>
        </div>
      </div>
      {error && <p className="invite-error" role="alert">{error}</p>}
      {statusMessage && <p className="invite-saved" role="status">{statusMessage}</p>}
      {view === 'list' ? (
        <div className="invite-list-view">
          <label className="invite-search"><span aria-hidden="true">⌕</span><input aria-label="Search invitations" onChange={(input) => setQuery(input.target.value)} placeholder="Search by email or status" type="search" value={query} /></label>
          <div className="invite-list-header"><span>Email</span><span>Status / action</span></div>
          <div className="invite-list">
            {filteredInvites.map((invite) => (
              <div className="invite-row" key={invite._id}>
                <div className="invite-person"><span className="invite-avatar">{invite.inviteEmail[0]?.toUpperCase()}</span><span><strong>{invite.inviteEmail}</strong><small>Sent {new Date(invite.createdAt).toLocaleDateString()}</small></span></div>
                <div className="invite-row-actions"><span className={`invite-status ${invite.status}`}>{invite.status}</span>{invite.status === 'pending' && <><button onClick={() => resendInvite(invite._id)} type="button">Resend</button><button onClick={() => deleteInvite(invite)} type="button">Delete</button></>}</div>
              </div>
            ))}
            {!filteredInvites.length && <p>No invitations match this search.</p>}
          </div>
        </div>
      ) : (
        <div className="invitation-editor">
          <form className="invitation-form" onSubmit={sendInvite}>
            <label className="event-form-field">Invitee email<input type="email" onChange={(input) => setEmail(input.target.value)} required value={email} /></label>
            <fieldset className="invite-template-options"><legend>Choose a design</legend>
              {templates.map((choice) => <button aria-pressed={template === choice.id} className={`invite-template-choice ${template === choice.id ? 'selected' : ''}`} key={choice.id} onClick={() => setTemplate(choice.id)} type="button"><span className={`invite-template-swatch ${choice.id}`} aria-hidden="true"><i /><b /><em /></span><strong>{choice.title}</strong><span>{choice.detail}</span></button>)}
            </fieldset>
            <label className="event-form-field">Personal message<textarea maxLength={1000} onChange={(input) => setMessage(input.target.value)} value={message} /></label>
            <div className="invite-editor-actions"><button className="workspace-resend" disabled={busy} onClick={saveDesign} type="button">Save design</button><button className="event-form-submit" disabled={busy} type="submit">{busy ? 'Sending…' : 'Send invitation'}</button></div>
          </form>
          <div className="invite-preview"><span className="section-eyebrow">Live email preview</span><iframe title="Invitation email preview" sandbox="" srcDoc={preview} /></div>
        </div>
      )}
    </section>
  )
}

export default InvitePanel
