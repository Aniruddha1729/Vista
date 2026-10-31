import { authenticatedFetch } from '../auth/authenticatedFetch'

export type EventRecord = {
  _id: string
  slug: string
  title: string
  description: string
  category: string
  poster?: string
  startDate: string
  endDate?: string
  registrationDeadline?: string
  venue: string
  mode: 'In person' | 'Online' | 'Hybrid'
  capacity: number
  registeredCount: number
  price: string
  priceAmountPaise?: number
  priceUnit?: 'individual' | 'team'
  platformFeePayer?: 'organiser' | 'applicant'
  status?: 'draft' | 'published' | 'cancelled'
  host?: { _id?: string; name: string; username: string }
  coHosts?: { _id: string; name: string; username: string; email: string }[]
  shareToken?: string
  eligibility?: string
  minTeamSize?: number
  maxTeamSize?: number
  teamSize?: string
  tags?: string[]
  overview?: string
  prizes?: string[]
  inviteTemplate?: 'minimal' | 'bold-gradient' | 'dark-neon' | 'formal'
  inviteMessage?: string
  registrationTemplate?: 'vista' | 'editorial' | 'electric' | 'midnight' | 'botanical' | 'studio' | 'summit' | 'minimal'
}

export type EventCardData = {
  id: string
  slug: string
  title: string
  description: string
  date: string
  location: string
  category: string
  image?: string
  startsAt: string
  isSaved?: boolean
  registrationId?: string
  invitedBy?: string
  priceLabel: string
}

export const allEventsCategory = 'All events'

export async function getEventDiscovery() {
  return eventsRequest<{ categories: string[]; publishedEvents: number; registeredPlaces: number }>('/discovery')
}

export function toEventCard(event: EventRecord): EventCardData {
  const priceLabel = event.priceAmountPaise && event.priceAmountPaise > 0
    ? `${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(event.priceAmountPaise / 100)}${event.priceUnit === 'team' ? ' / team' : ' / person'}`
    : event.price || 'Free'
  return {
    id: event._id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    date: new Date(event.startDate).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    location: event.venue,
    category: event.category,
    image: event.poster || undefined,
    startsAt: event.startDate,
    priceLabel,
  }
}

export async function eventsRequest<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(`/api/events${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(result?.message || 'Could not load event information.')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function listEvents(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : ''
  const result = await eventsRequest<{ events: EventRecord[] }>(query)
  return result.events
}

export async function getEvent(eventId: string) {
  const result = await eventsRequest<{ event: EventRecord }>(`/${encodeURIComponent(eventId)}`)
  return result.event
}

export async function getSavedEvents(token: string) {
  const result = await eventsRequest<{ events: EventRecord[] }>('/mine/saved', token)
  return result.events
}

export async function getSavedEventIds(token: string) {
  const events = await getSavedEvents(token)
  return new Set(events.map((event) => event._id))
}

export async function getMyEvents(token: string, userId?: string) {
  const result = await eventsRequest<{ registrations: { _id: string; event: EventRecord | null; teamLeader?: { _id: string; name: string; username: string } | null }[] }>('/mine/registrations', token)
  return result.registrations
    .filter((registration): registration is { _id: string; event: EventRecord; teamLeader?: { _id: string; name: string; username: string } | null } => Boolean(registration.event))
    .map((registration) => ({ ...toEventCard(registration.event), registrationId: registration._id, invitedBy: registration.teamLeader && registration.teamLeader._id !== userId ? registration.teamLeader.username : undefined }))
}

export async function getMyHostedEvents(token: string) {
  const result = await eventsRequest<{ events: EventRecord[] }>('/mine/hosted', token)
  return result.events
}

export type TeamInvitationData = {
  id: string
  teamName: string
  teamSize: number
  status: 'pending' | 'processing' | 'confirmed' | 'capacity_full'
  expiresAt: string
  event: { title: string; slug: string; startDate: string; venue: string } | null
  leader: { name: string; username: string } | null
  memberStatus: 'pending' | 'accepted'
}

export async function getMyTeamInvitations(token: string) {
  const result = await eventsRequest<{ invitations: TeamInvitationData[] }>('/mine/team-invitations', token)
  return result.invitations
}
