import { useEffect, useState } from 'react'
import { eventsRequest } from '../data/eventsApi'
import type { EventRecord } from '../data/eventsApi'

type SharePanelProps = { event: EventRecord; token: string; onChanged: (event: EventRecord) => void; isOwner: boolean }

function SharePanel({ event, token, onChanged, isOwner }: SharePanelProps) {
  const [copied, setCopied] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (event.status !== 'published') {
      return () => { active = false }
    }
    eventsRequest<{ publicUrl: string; qrDataUrl: string }>(`/${event._id}/share-qr`, token)
      .then((result) => { if (active) { setError(''); setPublicUrl(result.publicUrl); setQrDataUrl(result.qrDataUrl) } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the event QR code.') })
    return () => { active = false }
  }, [event._id, token, event.shareToken, event.status])

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy automatically. Select the link and copy it manually.')
    }
  }

  async function regenerateLink() {
    if (event.status !== 'published' || !window.confirm('Regenerate this event QR? The current link and printed QR code will stop working.')) return
    try {
      const result = await eventsRequest<{ shareToken: string }>(`/${event._id}/share-token`, token, { method: 'POST' })
      onChanged({ ...event, shareToken: result.shareToken })
      const qr = await eventsRequest<{ publicUrl: string; qrDataUrl: string }>(`/${event._id}/share-qr`, token)
      setPublicUrl(qr.publicUrl)
      setQrDataUrl(qr.qrDataUrl)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not regenerate the event link.')
    }
  }

  return (
    <section className="workspace-panel share-panel">
      <div className="workspace-panel-heading"><div><span className="section-eyebrow">Spread the word</span><h2>Share your event.</h2></div></div>
      <div className="share-content">
        {event.status === 'published' && qrDataUrl && <img className="event-share-qr" src={qrDataUrl} alt={`QR code linking to ${event.title}`} />}
        <div className="share-link-content">
          <span className="section-eyebrow">Public event link</span>
          <p>Invite students to register for {event.title}.</p>
          <div className="share-link-box">{publicUrl ? <a href={publicUrl} rel="noreferrer" target="_blank">{publicUrl}</a> : <span>{event.status === 'published' ? 'Loading link…' : 'Publish the event to create a public link.'}</span>}<button disabled={!publicUrl} onClick={copyLink} type="button">{copied ? 'Copied ✓' : 'Copy link'}</button></div>
          {event.status === 'published' && qrDataUrl && <a className="share-download-link" download={`${event.slug}-qr.png`} href={qrDataUrl}>Download QR (PNG)</a>}
          {isOwner && event.status === 'published' && <button className="share-regenerate-button" onClick={regenerateLink} type="button">Regenerate QR and link</button>}
          {(error || (event.status !== 'published' ? 'Make this event public and save the change before sharing its public link.' : '')) && <p role="alert">{error || 'Make this event public and save the change before sharing its public link.'}</p>}
        </div>
      </div>
    </section>
  )
}

export default SharePanel
