import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { EventCardData } from '../data/eventsApi'

export type { EventCardData } from '../data/eventsApi'

type EventCardProps = EventCardData

function getCountdown(startsAt: string, now: number) {
  const milliseconds = new Date(startsAt).getTime() - now
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'Passed'
  const minutes = Math.ceil(milliseconds / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const remainingMinutes = minutes % 60
  if (days) return `Starts in ${days}d ${hours}h`
  if (hours) return `Starts in ${hours}h ${remainingMinutes}m`
  return `Starts in ${minutes}m`
}

function Card({ id, title, description, date, location, category, image, invitedBy, startsAt, isSaved, priceLabel }: EventCardProps) {
  const [now, setNow] = useState(() => Date.now())
  const countdown = getCountdown(startsAt, now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <Link className="event-card" to={`/events/${encodeURIComponent(id)}`}>
      <span className="event-card-image-wrap">
        {image ? <img className="event-card-image" src={image} alt="" /> : <span className="event-card-image-placeholder" aria-hidden="true"><i>VISTA / EVENT</i><strong>{category}</strong><b>↗</b></span>}
        <span className="event-card-badges">
          <span className={`event-time-badge${countdown === 'Passed' ? ' passed' : ''}`}>{countdown}</span>
          {isSaved && <span className="event-saved-badge" aria-label="Saved event">♥</span>}
        </span>
      </span>
      <div className="event-card-content">
        <span className="event-card-category">{category}</span>
        {invitedBy && <span className="event-invited-tag">Invited by @{invitedBy}</span>}
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="event-card-meta">
          <span>{date}</span>
          <span>{location}</span>
          <span className="event-card-price">{priceLabel}</span>
        </div>
      </div>
    </Link>
  )
}

export default Card
