import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Card, { type EventCardData } from './Card'
import Footer from './Footer'
import { SidebarUnfoldableExample } from './Sidebar'
import './EventCollectionPage.css'

type EventCollectionPageProps = {
  eyebrow: string
  title: ReactNode
  description: string
  events: EventCardData[]
  loading?: boolean
  error?: string
  showTickets?: boolean
  showManageLinks?: boolean
  actionLabel?: string
  actionHref?: string
  onRemoveSaved?: (eventId: string) => void
  removingSavedId?: string
}

function EventCollectionPage({
  eyebrow,
  title,
  description,
  events,
  loading = false,
  error = '',
  showTickets = false,
  showManageLinks = false,
  actionLabel,
  actionHref,
  onRemoveSaved,
  removingSavedId = '',
}: EventCollectionPageProps) {
  const [visibleCount, setVisibleCount] = useState(9)
  return (
    <div className="collection-page">
      <div className="collection-layout">
        <aside className="collection-sidebar">
          <SidebarUnfoldableExample />
        </aside>
        <div className="collection-content">
          <main className="collection-main">
            <section className="collection-intro">
              <div>
                <span className="section-eyebrow">{eyebrow}</span>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
              {actionLabel && actionHref && (
                <a className="collection-action" href={actionHref}>
                  {actionLabel} <span>↗</span>
                </a>
              )}
            </section>
            <div className="collection-summary">
              <span>{events.length.toString().padStart(2, '0')} events</span>
              <span>Campus calendar</span>
            </div>
            {loading ? <p>Loading your events…</p> : error ? <p role="alert">{error}</p> : events.length ? (
              <section className="collection-grid" aria-label="Campus events">
                {events.slice(0, visibleCount).map((event) => <div className="collection-event-card" key={event.id}><Card {...event} />{onRemoveSaved && <button className="collection-remove-saved" disabled={removingSavedId === event.id} onClick={() => onRemoveSaved(event.id)} type="button">{removingSavedId === event.id ? 'Removing…' : 'Remove from saved'}</button>}{showTickets && event.registrationId && <Link className="collection-ticket-link" to={`/tickets/${event.registrationId}`}>View entry QR code ↗</Link>}{showManageLinks && <Link className="collection-ticket-link" to={`/host-event?id=${encodeURIComponent(event.id)}`}>Manage event ↗</Link>}</div>)}
              </section>
            ) : <p>No events to show yet.</p>}
            {!loading && !error && events.length > visibleCount && <button className="events-show-more" onClick={() => setVisibleCount((count) => count + 9)} type="button">Show more events <span>↓</span></button>}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}

export default EventCollectionPage
