import { useEffect, useState } from 'react'
import EventCollectionPage from '../components/EventCollectionPage'
import { useAuth } from '../auth/useAuth'
import { getMyEvents, getSavedEventIds } from '../data/eventsApi'
import type { EventCardData } from '../data/eventsApi'

function MyEventsPage() {
  const { accessToken, user } = useAuth()
  const [events, setEvents] = useState<EventCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) return
    Promise.all([getMyEvents(accessToken, user?.id), getSavedEventIds(accessToken).catch(() => new Set<string>())])
      .then(([registrations, saved]) => setEvents(registrations.map((event) => ({ ...event, isSaved: saved.has(event.id) }))))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load your registrations.'))
      .finally(() => setLoading(false))
  }, [accessToken, user?.id])

  return (
    <EventCollectionPage
      actionHref="/host-event"
      actionLabel="Host a new event"
      description="Your registered campus events, ready for the next big idea, new skill, or meaningful connection."
      events={events}
      loading={loading}
      error={error}
      showTickets
      eyebrow="Registered events"
      title={<>Events you’re<br /><em>going to.</em></>}
    />
  )
}

export default MyEventsPage
