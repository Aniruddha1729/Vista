import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import ApplicantsPanel from '../components/ApplicantsPanel'
import EditEventForm from '../components/EditEventForm'
import InvitePanel from '../components/InvitePanel'
import PermissionsPanel from '../components/PermissionsPanel'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import SharePanel from '../components/SharePanel'
import { eventsRequest } from '../data/eventsApi'
import type { EventRecord } from '../data/eventsApi'
import './HostEventPage.css'

const editorSections = ['Edit', 'Invite', 'Permissions', 'Applicants', 'Withdraw', 'Share', 'Style']
const registrationTemplates = [
  { id: 'vista', name: 'Vista Signature', note: 'Lime accents, calm canvas, confident type.' },
  { id: 'editorial', name: 'Editorial', note: 'Warm paper, serif headlines, gallery feel.' },
  { id: 'electric', name: 'Electric', note: 'Violet energy and bright event-night contrast.' },
  { id: 'midnight', name: 'Midnight', note: 'Deep ink, crisp surfaces, luminous details.' },
  { id: 'botanical', name: 'Botanical', note: 'Sage greens and a soft, welcoming tone.' },
  { id: 'studio', name: 'Studio', note: 'Clean monochrome with bold graphic blocks.' },
  { id: 'summit', name: 'Summit', note: 'Confident blue for talks and conferences.' },
  { id: 'minimal', name: 'Minimal', note: 'Quiet neutrals and focused registration.' },
] as const

type FinanceSummary = { applicants: number; grossPaise: number; refundsPaise: number; pendingRefundsPaise: number; gatewayFeesPaise: number; platformFeesPaise: number; netPaise: number; withdrawnPaise: number; pendingPaise: number; availablePaise: number; unreconciledGatewayFees: boolean; eligible: boolean; bankOnFile: boolean; withdrawals: { id: string; amountPaise: number; status: string; createdAt: string }[] }

function moneyFromPaise(paise: number) { return `₹${Math.floor(paise / 100).toLocaleString('en-IN')}.${String(paise % 100).padStart(2, '0')}` }
function parseRupeesToPaise(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/)
  return match ? Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) : 0
}

function HostEventPage() {
  const { accessToken, user } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const eventId = searchParams.get('id')
  const [event, setEvent] = useState<EventRecord | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<EventRecord> | null>(null)
  const [editIsDirty, setEditIsDirty] = useState(false)
  const [draftTemplate, setDraftTemplate] = useState<EventRecord['registrationTemplate'] | null>(null)
  const [draftStatus, setDraftStatus] = useState<EventRecord['status'] | null>(null)
  const [savingChanges, setSavingChanges] = useState(false)
  const [leaveTarget, setLeaveTarget] = useState('')
  const dirtyRef = useRef(false)
  const workspaceUrlRef = useRef(window.location.href)
  const [activeSection, setActiveSection] = useState('Edit')
  const [error, setError] = useState('')
  const [finance, setFinance] = useState<FinanceSummary | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMessage, setWithdrawMessage] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const withdrawRequestRef = useRef<{ key: string; amountPaise: number } | null>(null)

  const styleIsDirty = Boolean(event && draftTemplate && draftTemplate !== (event.registrationTemplate || 'vista'))
  const statusIsDirty = Boolean(event && draftStatus && draftStatus !== event.status)
  const hasUnsavedChanges = editIsDirty || styleIsDirty || statusIsDirty || (!event && editIsDirty)

  useEffect(() => {
    dirtyRef.current = hasUnsavedChanges
    workspaceUrlRef.current = `${location.pathname}${location.search}${location.hash}`
  }, [hasUnsavedChanges, location.hash, location.pathname, location.search])

  useEffect(() => {
    function clearDrafts() {
      setEditDraft(null)
      setEditIsDirty(false)
      setDraftTemplate(null)
      setDraftStatus(null)
      dirtyRef.current = false
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    function handleDocumentClick(event: MouseEvent) {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank') return
      const destination = new URL(link.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return
      event.preventDefault()
      event.stopPropagation()
      setLeaveTarget(`${destination.pathname}${destination.search}${destination.hash}`)
    }
    function handlePopState(event: PopStateEvent) {
      if (!dirtyRef.current) return
      const stay = window.confirm('You have unsaved event changes. Choose OK to keep editing or Cancel to discard changes and leave.')
      if (stay) {
        event.stopImmediatePropagation()
        window.history.pushState({}, '', workspaceUrlRef.current)
      } else clearDrafts()
    }
    document.addEventListener('click', handleDocumentClick, true)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState, true)
    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState, true)
    }
  }, [])

  useEffect(() => {
    if (!eventId || !accessToken) return
    eventsRequest<{ event: EventRecord }>(`/${eventId}/manage`, accessToken)
      .then((result) => setEvent(result.event))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load this event.'))
  }, [accessToken, eventId])

  useEffect(() => {
    if (!event || activeSection !== 'Withdraw' || !accessToken || event.host?._id !== user?.id) return
    eventsRequest<FinanceSummary>(`/${event._id}/finance`, accessToken).then(setFinance).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load payout summary.'))
  }, [activeSection, accessToken, event, user?.id])

  async function requestWithdrawal() {
    if (!event || !accessToken || !withdrawAmount) return
    setError(''); setWithdrawMessage('')
    setWithdrawBusy(true)
    try {
      const amountPaise = parseRupeesToPaise(withdrawAmount)
      if (!amountPaise) throw new Error('Enter a valid amount with up to two decimal places.')
      if (!withdrawRequestRef.current || withdrawRequestRef.current.amountPaise !== amountPaise) withdrawRequestRef.current = { key: crypto.randomUUID(), amountPaise }
      const result = await eventsRequest<{ message: string }>(`/${event._id}/withdraw`, accessToken, { method: 'POST', headers: { 'Idempotency-Key': withdrawRequestRef.current.key }, body: JSON.stringify({ amountPaise }) })
      withdrawRequestRef.current = null
      setWithdrawMessage(result.message); setWithdrawAmount('')
      setFinance(await eventsRequest<FinanceSummary>(`/${event._id}/finance`, accessToken))
    } catch (withdrawError) { setError(withdrawError instanceof Error ? withdrawError.message : 'Could not request withdrawal.') }
    finally { setWithdrawBusy(false) }
  }

  const loading = Boolean(eventId && event?._id !== eventId && !error)

  function handleSaved(savedEvent: EventRecord) {
    setEvent((current) => current ? { ...current, ...savedEvent, coHosts: savedEvent.coHosts || current.coHosts } : savedEvent)
    setEditDraft(null)
    setEditIsDirty(false)
    setDraftTemplate(null)
    setDraftStatus(null)
    navigate(`/host-event?id=${savedEvent._id}`, { replace: true })
  }

  async function saveEventChanges() {
    if (!accessToken || savingChanges || !hasUnsavedChanges) return
    const editForm = document.querySelector<HTMLFormElement>('.event-editor-form')
    if (activeSection === 'Edit' && editForm && !editForm.reportValidity()) return
    const candidate = { ...event, ...editDraft }
    if (editDraft && (String(candidate.title || '').trim().length < 3 || String(candidate.description || '').trim().length < 10 || !candidate.venue || !candidate.startDate || Number.isNaN(new Date(candidate.startDate).getTime()))) {
      setError('Complete the required event details before saving.')
      setActiveSection('Edit')
      return
    }
    if (editDraft && candidate.price !== 'Free' && !(candidate.priceAmountPaise && candidate.priceAmountPaise > 0)) {
      setError('Enter a valid event fee before saving.')
      setActiveSection('Edit')
      return
    }
    setError('')
    setSavingChanges(true)
    try {
      const body = {
        ...(editDraft || {}),
        ...(styleIsDirty && draftTemplate ? { registrationTemplate: draftTemplate } : {}),
        ...(statusIsDirty && draftStatus ? { status: draftStatus } : {}),
      }
      const result = await eventsRequest<{ event: EventRecord }>(event ? `/${event._id}` : '', accessToken, {
        method: event ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      setEvent(result.event)
      setEditDraft(null)
      setEditIsDirty(false)
      setDraftTemplate(null)
      setDraftStatus(null)
      if (!event) navigate(`/host-event?id=${result.event._id}`, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save event changes.')
    } finally {
      setSavingChanges(false)
    }
  }

  function discardAndLeave() {
    setEditDraft(null)
    setEditIsDirty(false)
    setDraftTemplate(null)
    setDraftStatus(null)
    dirtyRef.current = false
    const destination = leaveTarget
    setLeaveTarget('')
    navigate(destination)
  }

  async function handleDelete() {
    if (!event || !accessToken || !window.confirm(`Delete “${event.title}”? This also removes its registrations and saved entries.`)) return
    try {
      await eventsRequest(`/${event._id}`, accessToken, { method: 'DELETE' })
      setEvent(null)
      navigate('/host-event', { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this event.')
    }
  }

  async function togglePublicStatus() {
    if (!event) return
    const currentStatus = draftStatus || event.status || 'draft'
    setDraftStatus(currentStatus === 'published' ? 'draft' : 'published')
  }

  async function chooseRegistrationTemplate(template: typeof registrationTemplates[number]['id']) {
    if (!event) return
    setDraftTemplate(template)
  }

  return (
    <div className="host-event-page">
      <div className="host-event-layout">
        <aside className="host-event-sidebar"><SidebarUnfoldableExample /></aside>
        <main className="host-event-main">
          <div className="host-event-topbar">
            <div><span className="section-eyebrow">Event workspace</span><h1>{event?.title || 'New campus event'}</h1></div>
            <div className="host-event-actions">
              {event && <button className="host-event-delete" onClick={handleDelete} type="button">Delete event</button>}
              {event && <button className={`host-event-public-toggle${(draftStatus || event.status) === 'published' ? ' is-live' : ''}`} onClick={() => void togglePublicStatus()} type="button">{(draftStatus || event.status) === 'published' ? 'Take offline' : 'Make public'} <span>{(draftStatus || event.status) === 'published' ? '●' : '↗'}</span></button>}
              {event && <Link className="host-event-public" to={`/events/${event._id}${event.status === 'published' ? '' : '?preview=1'}`}>{event.status === 'published' ? 'Public view' : 'Preview event'} <span>↗</span></Link>}
              <button className="host-event-save" disabled={!hasUnsavedChanges || savingChanges} onClick={() => void saveEventChanges()} type="button">{savingChanges ? 'Saving…' : 'Save changes'}</button>
              {event && <Link className="host-event-public" to={`/scanner/${event._id}`}>Scan tickets <span>⌕</span></Link>}
            </div>
          </div>
          {error && <p role="alert">{error}</p>}
          <nav className="host-event-tabs" aria-label="Event workspace sections">
            {editorSections.map((section) => (
              <button className={activeSection === section ? 'active' : ''} key={section} onClick={() => setActiveSection(section)} type="button">
                {section}
              </button>
            ))}
          </nav>
          {loading ? <p>Loading event…</p> : activeSection === 'Edit' ? (
            <EditEventForm key={event?._id || 'new'} event={event ? { ...event, ...editDraft } : null} onDraftChange={(draft, dirty) => { setEditDraft(draft); setEditIsDirty(dirty) }} />
          ) : !event ? <p>Save the event details first to use this section.</p> : (
            <>
              {activeSection === 'Invite' && <InvitePanel key={event._id} event={event} token={accessToken || ''} onChanged={handleSaved} />}
              {activeSection === 'Permissions' && <PermissionsPanel event={event} token={accessToken || ''} onChanged={setEvent} isOwner={event.host?._id === user?.id} />}
              {activeSection === 'Applicants' && <ApplicantsPanel eventId={event._id} token={accessToken || ''} />}
              {activeSection === 'Withdraw' && event.host?._id === user?.id && <section className="workspace-panel finance-panel">
                <header className="finance-heading"><div><span className="section-eyebrow">Event earnings</span><h2>Financial overview</h2><p>Payment activity and funds available for withdrawal.</p></div><span className={`finance-eligibility${finance?.eligible ? ' ready' : ''}`}>{finance?.eligible ? 'Withdrawal window open' : 'Settlement pending'}</span></header>
                {finance ? <>
                  <div className="finance-primary-grid"><article className="finance-highlight"><small>Available to withdraw</small><strong>{moneyFromPaise(finance.availablePaise)}</strong><span>{finance.eligible ? 'Ready for payout request' : 'Available after the event settles'}</span></article><article><small>Net earnings</small><strong>{moneyFromPaise(finance.netPaise)}</strong><span>After fees and refunds</span></article><article><small>Gross collected</small><strong>{moneyFromPaise(finance.grossPaise)}</strong><span>{finance.applicants} paid applicants</span></article></div>
                  <section className="finance-breakdown"><div className="finance-section-title"><h3>Collection breakdown</h3><span>INR</span></div><div className="finance-breakdown-row"><span>Gross collected</span><strong>{moneyFromPaise(finance.grossPaise)}</strong></div><div className="finance-breakdown-row deduction"><span>Refunds</span><strong>− {moneyFromPaise(finance.refundsPaise)}</strong></div><div className="finance-breakdown-row deduction"><span>Payment gateway fee + GST</span><strong>− {moneyFromPaise(finance.gatewayFeesPaise)}</strong></div><div className="finance-breakdown-row deduction"><span>Vista platform fee</span><strong>− {moneyFromPaise(finance.platformFeesPaise)}</strong></div><div className="finance-breakdown-row total"><span>Net earnings</span><strong>{moneyFromPaise(finance.netPaise)}</strong></div></section>
                  <section className="finance-payout-strip"><div><span>Paid out</span><strong>{moneyFromPaise(finance.withdrawnPaise)}</strong></div><div><span>Pending payout</span><strong>{moneyFromPaise(finance.pendingPaise)}</strong></div><div><span>Available balance</span><strong>{moneyFromPaise(finance.availablePaise)}</strong></div></section>
                  {!finance.eligible && <p className="finance-notice">Withdrawals unlock 48 hours after the event ends.</p>}{finance.pendingRefundsPaise > 0 && <p className="finance-notice" role="status">Payouts are paused while {moneyFromPaise(finance.pendingRefundsPaise)} in refunds are processing.</p>}{finance.unreconciledGatewayFees && <p className="finance-notice" role="status">Payouts are paused until Razorpay’s gateway fee and GST are reconciled.</p>}{!finance.bankOnFile && <p className="finance-notice">Add payout bank details in your profile before requesting a withdrawal.</p>}
                  <div className="finance-request"><div><h3>Request a withdrawal</h3><p>Requests are reviewed against your available balance.</p></div><label>Amount in INR<input inputMode="decimal" min="0.01" max={(finance.availablePaise / 100).toFixed(2)} step="0.01" type="number" value={withdrawAmount} onChange={(change) => setWithdrawAmount(change.target.value)} /></label><button className="event-form-submit" disabled={withdrawBusy || !finance.eligible || !finance.bankOnFile || !finance.availablePaise || finance.pendingRefundsPaise > 0 || finance.unreconciledGatewayFees || !withdrawAmount} onClick={() => void requestWithdrawal()} type="button">{withdrawBusy ? 'Submitting…' : 'Request withdrawal ↗'}</button></div>
                  <section className="finance-history"><div className="finance-section-title"><h3>Withdrawal history</h3><span>{finance.withdrawals.length} requests</span></div>{finance.withdrawals.length ? <div className="finance-history-list">{finance.withdrawals.map((item) => <article key={item.id}><div><strong>{moneyFromPaise(item.amountPaise)}</strong><small>{new Date(item.createdAt).toLocaleDateString()}</small></div><span className={`finance-status ${item.status}`}>{item.status}</span></article>)}</div> : <p>No withdrawal requests yet.</p>}</section>
                </> : <p>Loading financial summary…</p>}{withdrawMessage && <p className="invite-saved" role="status">{withdrawMessage}</p>}
              </section>}
              {activeSection === 'Share' && <SharePanel event={event} token={accessToken || ''} onChanged={handleSaved} isOwner={event.host?._id === user?.id} />}
              {activeSection === 'Style' && (user?.plan !== 'pro' ? <section className="workspace-panel style-lock-panel"><span className="style-lock-icon" aria-hidden="true">🔒</span><span className="section-eyebrow">Vista Pro</span><h2>Make your registration page yours.</h2><p>Registration page styles are included with Pro. Your event stays on the Vista Signature template on the Free plan.</p><Link className="event-form-submit" to="/plans">Upgrade to Pro · ₹500/month ↗</Link></section> : <section className="workspace-panel registration-style-panel"><span className="section-eyebrow">Registration page design</span><h2>Set the tone before they arrive.</h2><p>Choose a visual theme for your event registration page, then save changes to publish it.</p><div className="registration-template-grid">{registrationTemplates.map((template, index) => { const selectedTemplate = draftTemplate || event.registrationTemplate || 'vista'; return <button aria-pressed={selectedTemplate === template.id} className={`registration-template-card theme-${template.id}${selectedTemplate === template.id ? ' selected' : ''}`} key={template.id} onClick={() => chooseRegistrationTemplate(template.id)} type="button"><span className="registration-template-preview"><i/><b/><em>{String(index + 1).padStart(2, '0')}</em></span><strong>{template.name}</strong><small>{template.note}</small><span className="registration-template-select">{selectedTemplate === template.id ? 'Selected' : 'Choose theme ↗'}</span></button> })}</div></section>)}
            </>
          )}
        </main>
      </div>
      {leaveTarget && <div className="unsaved-dialog-backdrop" role="presentation"><section aria-labelledby="unsaved-dialog-title" aria-modal="true" className="unsaved-dialog" role="dialog"><span className="section-eyebrow">Unsaved changes</span><h2 id="unsaved-dialog-title">Leave without saving?</h2><p>Your event details, visibility, or registration design have changes that haven’t been saved.</p><div><button onClick={() => setLeaveTarget('')} type="button">Keep editing</button><button onClick={discardAndLeave} type="button">Discard changes and leave</button></div></section></div>}
    </div>
  )
}

export default HostEventPage
