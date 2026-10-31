import { useEffect, useState } from 'react'
import EventCollectionPage from '../components/EventCollectionPage'
import { useAuth } from '../auth/useAuth'
import { getMyHostedEvents, toEventCard } from '../data/eventsApi'
import type { EventCardData } from '../data/eventsApi'

function MyEventsPage() {
  const { accessToken } = useAuth()
  const [events, setEvents] = useState<EventCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) return
    getMyHostedEvents(accessToken)
      .then((items) => setEvents(items.map(toEventCard)))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load your hosted events.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  return (
    <EventCollectionPage
      actionHref="/host-event"
      actionLabel="Host a new event"
      description="Events you created or co-host, all in one place."
      events={events}
      loading={loading}
      error={error}
      showManageLinks
      eyebrow="Your hosted events"
      title={<>Events you<br /><em>host.</em></>}
    />
  )
}

export default MyEventsPage
