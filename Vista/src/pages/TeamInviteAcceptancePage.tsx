import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import { eventsRequest } from '../data/eventsApi'
import { getMyTeamInvitations } from '../data/eventsApi'

type TeamInvitation = {
  teamName: string
  teamSize: number
  leaderName: string
  invitedEmail: string
  memberStatus: 'pending' | 'accepted'
  status: string
  expiresAt: string
  event: { title: string; startDate: string; venue: string }
}

function TeamInviteAcceptancePage() {
  const { token = '', teamId = '' } = useParams()
  const { accessToken, user } = useAuth()
  const [invitation, setInvitation] = useState<TeamInvitation | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    const loadInvitation = teamId
      ? getMyTeamInvitations(accessToken).then((items) => {
        const item = items.find((entry) => entry.id === teamId)
        if (!item || !item.event) throw new Error('This team invitation is not available for your account.')
        return { invitation: { event: item.event, teamName: item.teamName, teamSize: item.teamSize, leaderName: item.leader?.name || item.leader?.username || 'A teammate', invitedEmail: user?.email || '', memberStatus: item.memberStatus, status: item.status, expiresAt: item.expiresAt } }
      })
      : eventsRequest<{ invitation: TeamInvitation }>(`/team-invitations/${encodeURIComponent(token)}`, accessToken)
    loadInvitation
      .then((result) => setInvitation(result.invitation))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load this team request.'))
      .finally(() => setLoading(false))
  }, [accessToken, teamId, token, user?.email])

  async function accept() {
    if (!accessToken) return
    setAccepting(true)
    setError('')
    try {
      const acceptPath = teamId ? `/team-registrations/${encodeURIComponent(teamId)}/join` : `/team-registrations/${encodeURIComponent(token)}/accept`
      const result = await eventsRequest<{ status: string; message: string }>(acceptPath, accessToken, { method: 'POST', body: JSON.stringify({}) })
      setMessage(result.message)
      if (invitation) setInvitation({ ...invitation, status: result.status === 'confirmed' ? 'confirmed' : invitation.status, memberStatus: 'accepted' })
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not accept this team request.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="team-invite-layout">
      <aside className="team-invite-sidebar"><SidebarUnfoldableExample /></aside>
      <main className="team-invite-page">
      <section className="team-invite-card">
        <span className="section-eyebrow">Team registration</span>
        {loading ? <p>Loading team request…</p> : error && !invitation ? <p className="team-invite-error" role="alert">{error}</p> : invitation ? <>
          <h1>Join <em>{invitation.teamName}</em></h1>
          <p>{invitation.leaderName} invited you to register with a team of {invitation.teamSize} for <strong>{invitation.event.title}</strong>.</p>
          <div className="team-invite-details"><span>Invited email</span><strong>{invitation.invitedEmail}</strong><span>Event date</span><strong>{new Date(invitation.event.startDate).toLocaleString()}</strong><span>Location</span><strong>{invitation.event.venue}</strong><span>Request expires</span><strong>{new Date(invitation.expiresAt).toLocaleString()}</strong></div>
          {user?.email.toLowerCase() !== invitation.invitedEmail.toLowerCase() && <p className="team-invite-error">Sign in using <strong>{invitation.invitedEmail}</strong> to accept this request.</p>}
          {message && <p className="team-invite-message" role="status">{message}</p>}
          {error && <p className="team-invite-error" role="alert">{error}</p>}
          {invitation.status === 'confirmed' ? <Link className="team-invite-button" to="/registered-events">View your ticket ↗</Link> : <button className="team-invite-button" disabled={accepting || invitation.memberStatus === 'accepted' || user?.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()} onClick={() => void accept()} type="button">{accepting ? 'Accepting…' : invitation.memberStatus === 'accepted' ? 'Waiting for teammates' : 'Accept and join team ↗'}</button>}
        </> : null}
        <Link className="team-invite-back" to="/events">Browse events</Link>
      </section>
      </main>
    </div>
  )
}

export default TeamInviteAcceptancePage
