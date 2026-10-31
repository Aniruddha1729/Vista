import { useState } from 'react'
import type { ChangeEvent } from 'react'
import type { EventRecord } from '../data/eventsApi'

const teamSizeChoices = [
  { value: '1-1', label: 'Individual registration only' },
  { value: '2-2', label: 'Teams of 2' },
  { value: '2-3', label: 'Teams of 2–3' },
  { value: '2-4', label: 'Teams of 2–4' },
  { value: '2-5', label: 'Teams of 2–5' },
]

function teamSizePreset(event: EventRecord | null) {
  if (event?.minTeamSize && event.maxTeamSize) return `${event.minTeamSize}-${event.maxTeamSize}`
  const match = event?.teamSize?.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i)
  if (match) return `${match[1]}-${match[2]}`
  const single = event?.teamSize?.match(/\d+/)
  return single ? `${single[0]}-${single[0]}` : '1-1'
}

type EditEventFormProps = {
  event: EventRecord | null
  onDraftChange: (draft: Partial<EventRecord> | null, isDirty: boolean) => void
}

function dateForInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function EditEventForm({ event, onDraftChange }: EditEventFormProps) {
  const [feeType, setFeeType] = useState(event?.price && event.price !== 'Free' ? 'paid' : 'free')

  function readDraft(form: HTMLFormElement) {
    const fields = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value)]))
    const body = {
      title: fields.title,
      description: fields.description,
      category: fields.category,
      poster: fields.poster,
      startDate: fields.startDate ? new Date(fields.startDate).toISOString() : '',
      endDate: fields.endDate ? new Date(fields.endDate).toISOString() : undefined,
      registrationDeadline: fields.registrationDeadline ? new Date(fields.registrationDeadline).toISOString() : undefined,
      venue: fields.venue,
      mode: fields.mode,
      capacity: Number(fields.capacity),
      price: fields.feeType === 'free' ? 'Free' : `₹${Number(fields.priceAmount || (event?.priceAmountPaise || 0) / 100).toFixed(2)} / ${fields.priceUnit === 'team' ? 'team' : 'person'}`,
      priceAmountPaise: fields.feeType === 'free' ? 0 : Math.round(Number(fields.priceAmount || (event?.priceAmountPaise || 0) / 100) * 100),
      priceUnit: fields.feeType === 'free' ? 'individual' : fields.priceUnit,
      platformFeePayer: fields.platformFeePayer,
      eligibility: fields.eligibility,
      minTeamSize: Number(String(fields.teamSizePreset).split('-')[0]),
      maxTeamSize: Number(String(fields.teamSizePreset).split('-')[1]),
      status: event?.status || 'draft',
      overview: fields.overview,
      tags: String(fields.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      prizes: String(fields.prizes || '').split('\n').map((prize) => prize.trim()).filter(Boolean),
    }

    return body
  }

  function handleChange(changeEvent: ChangeEvent<HTMLFormElement>) {
    const form = changeEvent.currentTarget
    const dirty = Array.from(form.elements).some((element) => {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return false
      const defaultValue = element instanceof HTMLSelectElement
        ? Array.from(element.options).find((option) => option.defaultSelected)?.value ?? element.options[0]?.value ?? ''
        : element.defaultValue
      return element.value !== defaultValue
    })
    onDraftChange(dirty ? readDraft(form) as Partial<EventRecord> : null, dirty)
  }

  return (
    <form className="event-editor-form" onChange={handleChange} onSubmit={(submitEvent) => submitEvent.preventDefault()}>
      <div className="event-editor-heading">
        <div><span className="section-eyebrow">Event details</span><h2>Tell students what to expect.</h2></div>
      </div>
      <div className="event-form-grid">
        <label className="event-form-field event-form-wide">Event name<input name="title" defaultValue={event?.title || ''} required minLength={3} /></label>
        <label className="event-form-field">Event category<input name="category" defaultValue={event?.category || ''} minLength={2} required placeholder="Enter an event category" /></label>
        <label className="event-form-field">Format<select name="mode" defaultValue={event?.mode || 'In person'}><option>In person</option><option>Online</option><option>Hybrid</option></select></label>
        <label className="event-form-field">Venue or meeting link<input name="venue" defaultValue={event?.venue || ''} required /></label>
        <label className="event-form-field">Start date and time<input name="startDate" type="datetime-local" defaultValue={dateForInput(event?.startDate)} required /></label>
        <label className="event-form-field">End date and time<input name="endDate" type="datetime-local" defaultValue={dateForInput(event?.endDate)} /></label>
        <label className="event-form-field">Registration deadline<input name="registrationDeadline" type="datetime-local" defaultValue={dateForInput(event?.registrationDeadline)} /></label>
        <label className="event-form-field">Capacity<input name="capacity" type="number" min="1" defaultValue={event?.capacity || 100} required /></label>
        <div className="event-form-field">Registration fee
          <select name="feeType" defaultValue={feeType} onChange={(change) => setFeeType(change.target.value)}>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
          {feeType === 'paid' && <div className="locked-paid-fields">
            <label>Fee amount (INR)<input name="priceAmount" type="number" min="1" step="0.01" defaultValue={event?.priceAmountPaise ? event.priceAmountPaise / 100 : ''} required /></label>
            <label>Charge per<select name="priceUnit" defaultValue={event?.priceUnit || 'individual'}><option value="individual">Individual</option><option disabled value="team">Team · coming soon</option></select></label>
            <label className="event-form-field">Who pays Vista’s 3% platform fee?<select name="platformFeePayer" defaultValue={event?.platformFeePayer || 'organiser'}><option value="organiser">Organiser absorbs it from earnings</option><option value="applicant">Add it to applicant’s checkout</option></select></label>
          </div>}
          <small className="paid-feature-lock">The platform fee is 3% of the event fee. If the organiser pays, it is deducted from net earnings; if the applicant pays, it is added at checkout. Team payments are not enabled yet.</small>
        </div>
        <label className="event-form-field">Team registration<select name="teamSizePreset" defaultValue={teamSizePreset(event)}>{teamSizeChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select><small>For team events, the team leader invites each member to accept.</small></label>
        <label className="event-form-field event-form-wide">Short description<textarea name="description" defaultValue={event?.description || ''} required minLength={10} /></label>
        <label className="event-form-field event-form-wide">Full event overview<textarea name="overview" defaultValue={event?.overview || ''} /></label>
        <label className="event-form-field">Eligibility<input name="eligibility" defaultValue={event?.eligibility || ''} /></label>
        <label className="event-form-field">Tags<input name="tags" defaultValue={event?.tags?.join(', ') || ''} placeholder="coding, AI, teamwork" /></label>
        <label className="event-form-field event-form-wide">Cover image URL<input name="poster" type="url" defaultValue={event?.poster || ''} /></label>
        <label className="event-form-field event-form-wide">Rewards and prizes<textarea name="prizes" placeholder={'Add one reward per line, for example:\n1st place — $500\nMentor session with a local startup'} defaultValue={event?.prizes?.join('\n') || ''} /><small>Each line is saved and displayed as a separate prize on the public event page.</small></label>
      </div>
    </form>
  )
}

export default EditEventForm
