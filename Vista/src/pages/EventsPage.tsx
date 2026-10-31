import { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Card from '../components/Card'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import Footer from '../components/Footer'
import './EventsPage.css'
import { allEventsCategory, getEventDiscovery, getSavedEventIds, listEvents, toEventCard } from '../data/eventsApi'
import { useAuth } from '../auth/useAuth'

function EventsPage() {
  const { accessToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const requestedCategory = searchParams.get('category')
  const category = categories.includes(requestedCategory || '') ? requestedCategory! : allEventsCategory
  const [events, setEvents] = useState<ReturnType<typeof toEventCard>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleCount, setVisibleCount] = useState(9)

  useEffect(() => {
    Promise.all([listEvents(), getEventDiscovery(), accessToken ? getSavedEventIds(accessToken).catch(() => new Set<string>()) : Promise.resolve(new Set<string>())])
      .then(([items, discovery, saved]) => { setCategories(discovery.categories); setEvents(items.map((item) => ({ ...toEventCard(item), isSaved: saved.has(item._id) }))) })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load events.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  const filteredEvents = useMemo(() => {
    const searchTerm = query.trim().toLowerCase()

    return events.filter((event) => {
      const matchesCategory = category === 'All events' || event.category === category
      const matchesSearch = !searchTerm
        || [event.title, event.description, event.location, event.category]
          .join(' ')
          .toLowerCase()
          .includes(searchTerm)

      return matchesCategory && matchesSearch
    })
  }, [category, events, query])

  return (
    <div className="events-page">
      <div className="events-page-layout">
        <aside className="events-page-sidebar" aria-label="Events navigation">
          <SidebarUnfoldableExample />
        </aside>
        <div className="events-page-content">
          <main className="events-page-main">
        <section className="events-page-intro">
          <div>
            <span className="section-eyebrow">The Vista calendar</span>
            <h1>Find your next<br /><em>good moment.</em></h1>
            <p>Discover gatherings, ideas, and experiences worth making time for.</p>
          </div>
          <div className="events-page-count">
            <strong>{filteredEvents.length.toString().padStart(2, '0')}</strong>
            <span>events<br />to explore</span>
          </div>
        </section>

        <section className="events-page-toolbar" aria-label="Filter events">
          <label className="events-page-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events, places, or categories"
              aria-label="Search events"
            />
          </label>
          <div className="events-page-filters" role="group" aria-label="Event categories">
            {[allEventsCategory, ...categories].map((item) => (
              <button
                className={category === item ? 'selected' : ''}
                key={item}
                onClick={() => setSearchParams(item === allEventsCategory ? {} : { category: item })}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {loading ? <p className="events-page-empty">Loading events…</p> : error ? <p className="events-page-empty" role="alert">{error}</p> : filteredEvents.length > 0 ? (
          <section className="events-page-grid" aria-live="polite">
            {filteredEvents.slice(0, visibleCount).map((event) => <Card key={event.id} {...event} />)}
          </section>
        ) : (
          <p className="events-page-empty">No events match those filters. Try another search.</p>
        )}
        {!loading && !error && filteredEvents.length > visibleCount && <button className="events-show-more" onClick={() => setVisibleCount((count) => count + 9)} type="button">Show more events <span>↓</span></button>}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}

export default EventsPage
