import { useEffect, useMemo, useState } from 'react'
import Card from './Card'
import { getSavedEventIds, listEvents, toEventCard } from '../data/eventsApi'
import type { EventCardData } from '../data/eventsApi'
import { useAuth } from '../auth/useAuth'

function Events() {
  const { accessToken } = useAuth()
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<EventCardData[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(3)

  useEffect(() => {
    Promise.all([listEvents(), accessToken ? getSavedEventIds(accessToken).catch(() => new Set<string>()) : Promise.resolve(new Set<string>())])
      .then(([records, saved]) => setEvents(records.map((record) => ({ ...toEventCard(record), isSaved: saved.has(record._id) }))))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load events.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  const filteredEvents = useMemo(() => {
    const searchTerm = query.trim().toLowerCase()
    if (!searchTerm) return events
    return events.filter((event) => [event.title, event.description, event.location, event.category].join(' ').toLowerCase().includes(searchTerm))
  }, [events, query])

  return (
    <section className="events-section" id="events">
      <div className="events-heading"><span className="section-eyebrow">Explore together</span><h2>Find an event<br /><em>worth remembering.</em></h2></div>
      <label className="events-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(input) => setQuery(input.target.value)} placeholder="Search events, places, or categories" aria-label="Search events" /></label>
      {loading ? <p className="events-empty">Loading upcoming events…</p> : error ? <p className="events-empty" role="alert">{error}</p> : filteredEvents.length ? (
        <div className="events-grid">{filteredEvents.slice(0, visibleCount).map((event) => <Card key={event.id} {...event} />)}</div>
      ) : <p className="events-empty">No upcoming events match your search.</p>}
      {!loading && !error && filteredEvents.length > visibleCount && <button className="events-show-more" onClick={() => setVisibleCount((count) => count + 3)} type="button">Show more events <span>↓</span></button>}
    </section>
  )
}

export default Events
