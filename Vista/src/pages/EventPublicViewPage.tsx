import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import Footer from '../components/Footer'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import { useAuth } from '../auth/useAuth'
import { eventsRequest, getEvent } from '../data/eventsApi'
import type { EventRecord } from '../data/eventsApi'
import './EventPublicViewPage.css'

function EventPublicViewPage() {
  const { eventId = '' } = useParams()
  const { user, accessToken } = useAuth()
  const [searchParams] = useSearchParams()
  const previewMode = searchParams.get('preview') === '1'
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const ownsEvent = Boolean(user && event?.host?._id && String(event.host._id) === String(user.id))

  useEffect(() => {
    const load = previewMode && accessToken ? eventsRequest<{ event: EventRecord }>(`/${eventId}/preview`, accessToken).then((result) => result.event) : getEvent(eventId)
    load.then((loadedEvent) => {
      setEvent(loadedEvent)
      if (user && accessToken) {
        return eventsRequest<{ registrations: { event: EventRecord | null }[] }>('/mine/registrations', accessToken)
          .then(({ registrations }) => setAlreadyRegistered(registrations.some((registration) => registration.event?._id === loadedEvent._id)))
          .catch(() => undefined)
      }
    })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load this event.'))
      .finally(() => setLoading(false))
  }, [eventId, user, accessToken, previewMode])

  async function toggleSaved() {
    if (!user || !accessToken) {
      navigate('/login', { state: { from: `/events/${event?._id || eventId}` } })
      return
    }
    setSaveError('')
    try {
      await eventsRequest(`/${event?._id}/save`, accessToken, { method: saved ? 'DELETE' : 'PUT' })
      setSaved(!saved)
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : 'Could not save this event.')
    }
  }

  return (
    <div className="public-event-page">
      <div className={`public-event-shell public-theme-${event?.registrationTemplate || 'vista'}`}>
        <aside className="public-event-sidebar"><SidebarUnfoldableExample /></aside>
        <div className="public-event-body">
          <main className="public-event-main">
            {loading ? <p>Loading event…</p> : error || !event ? <p role="alert">{error || 'Event not found.'}</p> : (
              <>
              <nav className="public-event-toolbar" aria-label="Event navigation">
                {ownsEvent ? <Link className="public-event-back" to={`/host-event?id=${event._id}`}><span aria-hidden="true">←</span> Back to event editor</Link> : <Link className="public-event-back" to="/events"><span aria-hidden="true">←</span> Back to events</Link>}
              </nav>
              <div className="public-event-layout">
                <article className="public-event-content">
                  {event.poster ? <img className="public-event-cover" src={event.poster} alt="" /> : <div className="public-event-cover-placeholder" aria-hidden="true"><span>VISTA / EVENT</span><strong>{event.category}</strong></div>}
                  <section className="public-event-summary">
                    <span className="public-event-mode">● {event.mode}</span>
                    <h1>{event.title}</h1>
                    <p className="public-event-organiser">{event.host?.name || 'Campus organiser'}</p>
                    <div className="public-event-facts">
                      <div><span>⌖</span><strong>Location</strong><p>{event.venue}</p></div>
                      <div><span>◷</span><strong>Date</strong><p>{new Date(event.startDate).toLocaleString()}</p></div>
                    </div>
                    <div className="public-event-tags"><span>{event.category}</span>{event.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  </section>
                  {event.eligibility && <PublicSection title="Eligibility"><p>{event.eligibility}</p></PublicSection>}
                  <PublicSection title="About this event"><p>{event.overview || event.description}</p><p><strong>Registration:</strong> {(event.maxTeamSize || 1) === 1 ? 'Individual registration' : `Teams of ${event.minTeamSize || 1}–${event.maxTeamSize} people, including the team leader. Teammates must accept their email invitations before the team is confirmed.`}</p></PublicSection>
                  <PublicSection title="Event details">
                    <ul>
                      <li><strong>Date:</strong> {new Date(event.startDate).toLocaleString()}</li>
                      {event.endDate && <li><strong>Ends:</strong> {new Date(event.endDate).toLocaleString()}</li>}
                      {event.registrationDeadline && <li><strong>Registration deadline:</strong> {new Date(event.registrationDeadline).toLocaleDateString()}</li>}
                      <li><strong>Venue:</strong> {event.venue}</li>
                      <li><strong>Registration fee:</strong> {event.price}</li>
                      <li><strong>Available places:</strong> {Math.max(0, event.capacity - event.registeredCount)}</li>
                    </ul>
                  </PublicSection>
                  {event.prizes?.length ? <PublicSection title="Rewards and prizes"><div className="public-prizes">{event.prizes.map((prize, index) => <div className="public-prize-card" key={`${index}-${prize}`}><span aria-hidden="true">🏆</span><strong>Prize {index + 1}</strong><p>{prize}</p></div>)}</div></PublicSection> : null}
                </article>
                <aside className="public-event-register">
                  <div className="public-register-card">
                    <strong>{event.price}</strong><span>Registration fee</span><hr />
                    <h2>Ready to join?</h2>
                    <p>{event.registeredCount} of {event.capacity} places taken.</p>
                    {previewMode ? <span className="public-register-button already-registered" role="status">Private preview · event is offline</span> : ownsEvent ? <span className="public-register-button already-registered" role="status">You’re hosting this event</span> : alreadyRegistered ? <span className="public-register-button already-registered" role="status">✓ Already registered</span> : <Link className="public-register-button" to={`/events/${event._id}/register`}>Register now</Link>}
                    {!previewMode && <button className="public-save-button" type="button" onClick={toggleSaved}>{saved ? 'Saved ✓' : 'Save event ♡'}</button>}
                    {!previewMode && saveError && <small role="alert">{saveError}</small>}
                    <hr />
                    <span>♧ Registered <b>{event.registeredCount}</b></span>
                  </div>
                </aside>
              </div>
              </>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}

function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="public-section"><h2>{title}</h2>{children}</section>
}

export default EventPublicViewPage
