import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './InviteAcceptancePage.css'

type Invitation = {
  event: { title: string; poster?: string; venue: string; startDate: string; host?: { _id?: string; name: string } }
  expiresAt: string
}

function InviteAcceptancePage() {
  const { token = '' } = useParams()
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [invite, setInvite] = useState<Invitation | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const isEventHost = Boolean(user && invite?.event.host?._id && String(invite.event.host._id) === String(user.id))

  useEffect(() => {
    authenticatedFetch(`/api/invites/${encodeURIComponent(token)}`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json() as Invitation | { message?: string }
        if (!response.ok) throw new Error('message' in data ? data.message || 'This invitation has expired.' : 'This invitation has expired.')
        return data as Invitation
      })
      .then(setInvite)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'This invitation has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  async function acceptInvitation() {
    if (!user || !accessToken) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    setAccepting(true)
    setError('')
    try {
      const response = await authenticatedFetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` },
      })
      const result = await response.json() as { registration?: { _id: string }; message?: string }
      if (!response.ok || !result.registration) throw new Error(result.message || 'Could not accept this invitation.')
      navigate(`/tickets/${result.registration._id}`, { replace: true })
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Could not accept this invitation.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="invite-acceptance-layout">
      <aside className="invite-acceptance-sidebar"><SidebarUnfoldableExample /></aside>
      <div className="invite-acceptance-page">
      <main className="invite-acceptance-card">
        {loading ? <p>Loading invitation…</p> : error && !invite ? <><span className="section-eyebrow">Invitation unavailable</span><h1>This invite is<br /><em>no longer active.</em></h1><p>{error}</p><Link to="/events">Browse campus events</Link></> : invite ? <>
          <span className="section-eyebrow">You’re invited</span>
          <h1>Join us at<br /><em>{invite.event.title}</em></h1>
          {invite.event.poster && <img src={invite.event.poster} alt="" />}
          <p>{invite.event.startDate && new Date(invite.event.startDate).toLocaleString()}<br />{invite.event.venue}</p>
          <p>Hosted by {invite.event.host?.name || 'your campus host'}.</p>
          <p>Your invitation stays pending until you accept. Sign in using the email address that received the invitation.</p>
          {isEventHost && <p className="invite-acceptance-error" role="status">You’re the organiser of this event, so you can’t register for it.</p>}
          {error && <p className="invite-acceptance-error" role="alert">{error}</p>}
          <button onClick={acceptInvitation} disabled={accepting || isEventHost} type="button">{accepting ? 'Accepting…' : 'Accept invitation'} <span>↗</span></button>
        </> : null}
      </main>
      </div>
    </div>
  )
}

export default InviteAcceptancePage
