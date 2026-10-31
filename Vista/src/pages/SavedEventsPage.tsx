import { useEffect, useState } from 'react'
import EventCollectionPage from '../components/EventCollectionPage'
import { useAuth } from '../auth/useAuth'
import { eventsRequest, getSavedEvents, toEventCard } from '../data/eventsApi'

function SavedEventsPage() {
  const { accessToken } = useAuth()
  const [events, setEvents] = useState<ReturnType<typeof toEventCard>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState('')

  useEffect(() => {
    if (!accessToken) return
    getSavedEvents(accessToken).then((items) => setEvents(items.map((item) => ({ ...toEventCard(item), isSaved: true }))))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load saved events.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  async function removeSavedEvent(eventId: string) {
    if (!accessToken) return
    setRemovingId(eventId)
    setError('')
    try {
      await eventsRequest(`/${eventId}/save`, accessToken, { method: 'DELETE' })
      setEvents((current) => current.filter((item) => item.id !== eventId))
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the saved event.')
    } finally {
      setRemovingId('')
    }
  }

  return (
    <EventCollectionPage
      description="Keep an eye on the campus events you’ve saved for later and plan your semester around what inspires you."
      events={events}
      loading={loading}
      error={error}
      onRemoveSaved={removeSavedEvent}
      removingSavedId={removingId}
      eyebrow="Your saved list"
      title={<>Keep learning.<br /><em>Stay curious.</em></>}
    />
  )
}

export default SavedEventsPage
