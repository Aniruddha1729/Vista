import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import { eventsRequest, getEvent } from '../data/eventsApi'
import type { EventRecord } from '../data/eventsApi'
import Footer from '../components/Footer'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './EventRegistrationPage.css'

function formatPaise(paise: number) { return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}.${String(paise % 100).padStart(2, '0')}` }
function platformFeePaise(basePaise: number) { return Math.floor((basePaise * 300 + 5_000) / 10_000) }

function EventRegistrationPage() {
  const [submitted, setSubmitted] = useState(false)
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { eventId = '' } = useParams()
  const [eventInfo, setEventInfo] = useState<EventRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [ticketError, setTicketError] = useState('')
  const [registrationId, setRegistrationId] = useState('')
  const [teamSize, setTeamSize] = useState(1)
  const [memberEmails, setMemberEmails] = useState<string[]>([])
  const [teamRequest, setTeamRequest] = useState<{ teamName: string; members: { email: string; status: string }[]; expiresAt: string } | null>(null)
  const isEventHost = Boolean(user && eventInfo?.host?._id && String(eventInfo.host._id) === String(user.id))

  useEffect(() => {
    getEvent(eventId).then((loadedEvent) => {
      setEventInfo(loadedEvent)
      setTeamSize(loadedEvent.minTeamSize || 1)
    })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load this event.'))
      .finally(() => setLoading(false))
  }, [eventId])

  async function handleRegistration(form: HTMLFormElement) {
    if (!user || !accessToken) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    setSubmitting(true)
    setError('')
    let registrationCreated = false
    const formEntries = new FormData(form)
    const teamName = String(formEntries.get('teamName') || '')
    const formData = Object.fromEntries([...formEntries.entries()].filter(([key]) => !['teamSize', 'teamName', 'memberEmails'].includes(key)))
    try {
      if (teamSize > 1) {
        if ((eventInfo?.priceAmountPaise || 0) > 0) throw new Error('Paid team registration is not available yet. Please contact the organiser for an alternative.')
        const result = await eventsRequest<{ teamRegistration: { teamName: string; members: { email: string; status: string }[]; expiresAt: string } }>(`/${eventInfo?._id}/register-team`, accessToken, {
          method: 'POST',
          body: JSON.stringify({ teamName, teamSize, formData, memberEmails }),
        })
        setTeamRequest(result.teamRegistration)
        setSubmitted(true)
        return
      }
      let id = ''
      if ((eventInfo?.priceAmountPaise || 0) > 0) {
        const order = await eventsRequest<{ orderId: string; amount: number; baseAmountPaise: number; platformFeePaise: number; currency: string; keyId: string; eventName: string }>(`/${eventInfo?._id}/payment-order`, accessToken, { method: 'POST', body: JSON.stringify({ formData }) })
        await new Promise<void>((resolve, reject) => {
          const openCheckout = () => {
            const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay
            if (!Razorpay) return reject(new Error('Razorpay Checkout did not load. Please try again.'))
            const checkout = new Razorpay({ key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: 'Vista', description: order.eventName, handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
              try {
                const verified = await eventsRequest<{ registrationId: string }>('/payments/verify', accessToken, { method: 'POST', body: JSON.stringify(payment) })
                id = verified.registrationId
                resolve()
              } catch (verifyError) { reject(verifyError) }
            }, modal: { ondismiss: () => reject(new Error('Payment was cancelled. You can try again when ready.')) }, prefill: { name: user?.name, email: user?.email }, theme: { color: '#9bcf27' } })
            checkout.open()
          }
          const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]')
          if ((window as Window & { Razorpay?: unknown }).Razorpay) openCheckout()
          else if (existing) { existing.addEventListener('load', openCheckout, { once: true }); existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout.')), { once: true }) }
          else { const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = openCheckout; script.onerror = () => reject(new Error('Could not load Razorpay Checkout.')); document.body.appendChild(script) }
        })
      } else {
        const result = await eventsRequest<{ registration: { _id: string } }>(`/${eventInfo?._id}/register`, accessToken, { method: 'POST', body: JSON.stringify({ formData }) })
        id = result.registration._id
      }
      setRegistrationId(id)
      setSubmitted(true)
      registrationCreated = true
      const ticketResponse = await authenticatedFetch(`/api/registrations/${id}/qr`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!ticketResponse.ok) throw new Error('Your place is registered, but we could not load the ticket QR code.')
      const ticket = await ticketResponse.json() as { qrDataUrl: string }
      setQrDataUrl(ticket.qrDataUrl)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Could not register for this event.'
      if (registrationCreated) setTicketError(message)
      else setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="registration-page">
      <div className={`registration-shell registration-theme-${eventInfo?.registrationTemplate || 'vista'}`}>
        <aside className="registration-sidebar"><SidebarUnfoldableExample /></aside>
        <div className="registration-body">
          <main className="registration-main">
            <Link className="registration-back" to={`/events/${eventInfo?._id || eventId}`}>← Back to event</Link>
            <div className="registration-heading">
              <span className="section-eyebrow">{eventInfo?.title || 'Event registration'}</span>
              <h1>{(eventInfo?.maxTeamSize || 1) === 1 ? <>Save your<br /><em>place.</em></> : <>Register your<br /><em>team.</em></>}</h1>
              <p>{(eventInfo?.maxTeamSize || 1) === 1 ? 'Share a few details and you’ll be registered.' : 'Register solo or invite your teammates. Team places are confirmed after everyone accepts.'}</p>
            </div>
            {loading ? <p>Loading registration form…</p> : error && !eventInfo ? <p role="alert">{error}</p> : submitted && teamRequest ? (
              <section className="registration-success team-registration-pending">
                <span>✉</span>
                <h2>Team request sent.</h2>
                <p><strong>{teamRequest.teamName}</strong> will be registered for {eventInfo?.title} once every teammate accepts and there are enough places for the full team. Requests expire {new Date(teamRequest.expiresAt).toLocaleString()}.</p>
                <div className="team-request-status-list">{teamRequest.members.map((member) => <div key={member.email}><span>{member.email}</span><strong>{member.status === 'accepted' ? 'Accepted' : 'Waiting'}</strong></div>)}</div>
                <Link to="/registered-events">View registered events ↗</Link>
                <Link to={`/events/${eventInfo?._id || eventId}`}>Return to event</Link>
              </section>
            ) : isEventHost ? (
              <section className="registration-success"><span>✦</span><h2>You’re hosting this event.</h2><p>Organisers can’t register for their own event. You can manage it from your event workspace.</p><Link to={`/host-event?id=${eventInfo?._id}`}>Open event workspace ↗</Link></section>
            ) : submitted ? (
              <section className="registration-success">
                <span>✓</span>
                <h2>You’re registered.</h2>
                <p>Your place for {eventInfo?.title} is confirmed{eventInfo?.priceAmountPaise ? ' and your payment was verified' : ''}. Show this QR code at the entrance.</p>
                {qrDataUrl ? <img className="registration-ticket-qr" src={qrDataUrl} alt="Your signed event entry pass" /> : ticketError ? <p role="alert">{ticketError}</p> : <p>Preparing your ticket QR…</p>}
                {registrationId && <a href={`/tickets/${registrationId}`}>Open saved ticket</a>}
                <Link to={`/events/${eventInfo?._id || eventId}`}>Return to event</Link>
              </section>
            ) : (
              <form className="registration-form" onSubmit={(event) => {
                event.preventDefault()
                void handleRegistration(event.currentTarget)
              }}>
                <FormSection title="Personal details">
                  <label>Full name<input name="name" defaultValue={user?.name || ''} required placeholder="Your name" /></label>
                  <label>Username<input name="username" defaultValue={user?.username || ''} required placeholder="@username" /></label>
                  <label>Email address<input name="email" defaultValue={user?.email || ''} required type="email" placeholder="you@university.edu" /></label>
                  <label>Phone number<input name="phone" defaultValue={String(user?.profile.phone || '')} required type="tel" placeholder="+91 98765 43210" /></label>
                </FormSection>
                <FormSection title="Academic details">
                  <label>College / university<input name="college" defaultValue={String(user?.profile.college || '')} required placeholder="Your institution" /></label>
                  <label>Course or branch<input name="course" defaultValue={String(user?.profile.branch || user?.profile.degree || '')} required placeholder="e.g. B.Tech Computer Science" /></label>
                  <label>Year of study<select name="year" defaultValue="" required><option disabled value="">Select year</option><option>1st year</option><option>2nd year</option><option>3rd year</option><option>4th year</option><option>Postgraduate</option></select></label>
                  <label>Student ID<input name="studentId" required placeholder="College roll number" /></label>
                </FormSection>
                <FormSection title="Team details">
                  {eventInfo && (eventInfo.maxTeamSize || 1) > 1 && <label>Team size<select name="teamSize" value={teamSize} onChange={(change) => {
                    const nextSize = Number(change.target.value)
                    setTeamSize(nextSize)
                    setMemberEmails((current) => Array.from({ length: nextSize - 1 }, (_, index) => current[index] || ''))
                  }}>{Array.from({ length: (eventInfo.maxTeamSize || 1) - (eventInfo.minTeamSize || 1) + 1 }, (_, index) => (eventInfo.minTeamSize || 1) + index).map((size) => <option key={size} value={size}>{size === 1 ? 'Solo (just me)' : `${size} people including me`}</option>)}</select></label>}
                  {teamSize > 1 && <>
                    <label>Team name<input name="teamName" required minLength={2} maxLength={100} placeholder="Name your team" /></label>
                    <div className="registration-wide team-member-fields">
                      <span className="team-member-label">Invite teammates by email</span>
                      <p>They can create an account if needed, then verify this email and accept within 48 hours.</p>
                      {memberEmails.map((email, index) => <label key={index}>Teammate {index + 1} email<input name="memberEmails" type="email" required value={email} onChange={(change) => setMemberEmails((current) => current.map((value, currentIndex) => currentIndex === index ? change.target.value : value))} placeholder="teammate@university.edu" /></label>)}
                    </div>
                  </>}
                  <label className="registration-wide">What are you planning to build?<textarea name="idea" required placeholder="Share a short idea or problem statement" /></label>
                </FormSection>
                <FormSection title="Additional information">
                  <label>GitHub / portfolio link<input name="portfolio" defaultValue={String(user?.profile.github || user?.profile.portfolio || '')} type="url" placeholder="https://github.com/username" /></label>
                  <label>Dietary or accessibility needs<input name="accessibility" placeholder="Optional" /></label>
                  <label className="registration-wide">Anything we should know?<textarea name="notes" placeholder="Optional message for the organisers" /></label>
                </FormSection>
                <label className="registration-consent"><input required type="checkbox" /> I confirm that these details are accurate and agree to receive event updates from the organisers.</label>
                {error && <p role="alert">{error}</p>}
                {Boolean(eventInfo?.priceAmountPaise) && <p className="registration-fee-breakdown">Event fee {formatPaise(eventInfo?.priceAmountPaise || 0)}{eventInfo?.platformFeePayer === 'applicant' ? ` + Vista service fee ${formatPaise(platformFeePaise(eventInfo?.priceAmountPaise || 0))}` : ' · Vista’s 3% service fee is deducted from organiser earnings'}</p>}
                <button className="registration-submit" disabled={submitting} type="submit">{submitting ? 'Processing…' : eventInfo?.priceAmountPaise ? `Pay ${formatPaise((eventInfo.priceAmountPaise || 0) + (eventInfo.platformFeePayer === 'applicant' ? platformFeePaise(eventInfo.priceAmountPaise || 0) : 0))} and register` : 'Complete registration'} <span>↗</span></button>
              </form>
            )}
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="registration-section"><h2>{title}</h2><div className="registration-fields">{children}</div></section>
}

export default EventRegistrationPage
