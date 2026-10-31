import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { eventsRequest } from '../data/eventsApi'
import { SidebarUnfoldableExample } from '../components/Sidebar'

function SharedEventPage() {
  const { shareToken = '' } = useParams()
  const [eventId, setEventId] = useState('')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    eventsRequest<{ id: string }>(`/share/${encodeURIComponent(shareToken)}`)
      .then((result) => setEventId(result.id))
      .catch(() => setExpired(true))
  }, [shareToken])

  if (eventId) return <Navigate to={`/events/${eventId}`} replace />
  if (expired) return (
    <div className="expired-link-layout"><aside className="expired-link-sidebar"><SidebarUnfoldableExample /></aside><main className="expired-link-page">
      <span className="section-eyebrow">Event link expired</span>
      <h1>This QR code is<br /><em>out of date.</em></h1>
      <p>The host has made a new event link. Ask them to share the latest QR code with you.</p>
      <Link to="/events">Browse campus events</Link>
    </main></div>
  )
  return <div className="expired-link-layout"><aside className="expired-link-sidebar"><SidebarUnfoldableExample /></aside><main className="expired-link-page"><p>Opening event…</p></main></div>
}

export default SharedEventPage
