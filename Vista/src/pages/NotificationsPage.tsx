import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { eventsRequest, getMyTeamInvitations } from '../data/eventsApi'
import type { TeamInvitationData } from '../data/eventsApi'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import Footer from '../components/Footer'
import { invitationsChangedEvent } from '../hooks/usePendingInvitationCount'

function NotificationsPage() {
  const { accessToken, user } = useAuth()
  const [items, setItems] = useState<TeamInvitationData[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!accessToken) return
    getMyTeamInvitations(accessToken).then(setItems).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load notifications.'))
  }, [accessToken])
  async function accept(id: string) {
    if (!accessToken) return
    setBusy(id); setError(''); setMessage('')
    try {
      const result = await eventsRequest<{ status: string; message: string }>(`/team-registrations/${id}/join`, accessToken, { method: 'POST', body: JSON.stringify({}) })
      setItems((current) => current.map((item) => item.id === id ? { ...item, memberStatus: 'accepted', status: result.status === 'confirmed' ? 'confirmed' : item.status } : item))
      window.dispatchEvent(new Event(invitationsChangedEvent))
      setMessage(result.message)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not accept the invitation.') }
    finally { setBusy('') }
  }
  return <div className="collection-page"><div className="collection-layout"><aside className="collection-sidebar"><SidebarUnfoldableExample /></aside><div className="collection-content"><main className="collection-main notification-main"><section className="collection-intro"><div><span className="section-eyebrow">Updates for @{user?.username}</span><h1>You’re<br /><em>invited.</em></h1><p>Team invitations sent to your account appear here. Accept to join the team registration.</p></div></section>{error && <p role="alert">{error}</p>}{message && <p className="team-notice" role="status">{message}</p>}{items.length ? <div className="notification-list">{items.map((item) => <article className="notification-card" key={item.id}><header><div><span className="section-eyebrow">{item.event?.title || 'Campus event'}</span><h2><Link className="notification-invitation-link" to={`/team-registration-invites/${item.id}`}>{item.teamName}</Link></h2></div><span className="notification-status">{item.memberStatus === 'accepted' ? 'Accepted' : 'Invitation'}</span></header><p>@{item.leader?.username || 'teammate'} invited you to join a team of {item.teamSize} · {item.event?.startDate ? new Date(item.event.startDate).toLocaleString() : ''}</p><Link className="notification-open-link" to={`/team-registration-invites/${item.id}`}>Open team registration ↗</Link>{item.memberStatus === 'pending' && item.status === 'pending' ? <button className="team-accept-button" disabled={busy === item.id} onClick={() => void accept(item.id)} type="button">{busy === item.id ? 'Joining…' : 'Accept invitation'}</button> : item.memberStatus === 'accepted' && item.status === 'pending' ? <small>Your acceptance is saved. Waiting for the rest of the team.</small> : item.status === 'confirmed' ? <Link to="/registered-events" className="team-accept-button">View registered event ↗</Link> : <small>This invitation can no longer be completed. Contact the team leader.</small>}</article>)}</div> : !error && <div className="notification-empty"><h2>No notifications</h2><p>When someone invites you to register as part of a team, it will show up here.</p></div>}</main><Footer /></div></div></div>
}
export default NotificationsPage
