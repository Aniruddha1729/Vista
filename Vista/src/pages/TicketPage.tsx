import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './TicketPage.css'

function TicketPage() {
  const { registrationId = '' } = useParams()
  const { accessToken } = useAuth()
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) return
    authenticatedFetch(`/api/registrations/${registrationId}/qr`, { credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json() as { message?: string }
          throw new Error(result.message || 'Could not load this ticket.')
        }
        return response.json() as Promise<{ qrDataUrl: string }>
      })
      .then((ticket) => setQrDataUrl(ticket.qrDataUrl))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load this ticket.'))
  }, [accessToken, registrationId])

  return (
    <div className="ticket-page">
      <aside className="ticket-sidebar"><SidebarUnfoldableExample /></aside>
      <main className="ticket-card">
        <span className="section-eyebrow">Your entry pass</span>
        <h1>Ready to<br /><em>check in.</em></h1>
        <p>Show this QR at the event entrance. It contains a signed ticket code and no personal details.</p>
        {error ? <p role="alert">{error}</p> : qrDataUrl ? <img className="ticket-qr" src={qrDataUrl} alt="Signed event entry pass QR code" /> : <p>Loading your ticket…</p>}
        {qrDataUrl && <a className="ticket-download" download="vista-entry-ticket.png" href={qrDataUrl}>Download ticket QR</a>}
        <Link className="ticket-back" to="/my-events">Back to my events</Link>
      </main>
    </div>
  )
}

export default TicketPage
