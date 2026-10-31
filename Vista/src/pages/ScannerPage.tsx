import { useRef, useState } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './ScannerPage.css'

type ScanResult = { name: string; type: 'registered' | 'invited'; status: string; checkedInAt?: string }
type ScanFailure = { code: string; message: string; checkedInAt?: string }

function ScannerPage() {
  const { eventId = '' } = useParams()
  const { accessToken } = useAuth()
  const [result, setResult] = useState<ScanResult | null>(null)
  const [failure, setFailure] = useState<ScanFailure | null>(null)
  const [cameraError, setCameraError] = useState('')
  const locked = useRef(false)

  async function handleScan(codes: IDetectedBarcode[]) {
    if (locked.current || !codes.length || !accessToken) return
    locked.current = true
    setResult(null)
    setFailure(null)
    try {
      const response = await authenticatedFetch(`/api/events/${eventId}/scan`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: codes[0].rawValue }),
      })
      const payload = await response.json() as ScanResult | ScanFailure
      if (!response.ok) setFailure(payload as ScanFailure)
      else setResult(payload as ScanResult)
    } catch {
      setFailure({ code: 'network_error', message: 'Could not reach the Vista API. Try scanning again.' })
    }
  }

  function scanNextTicket() {
    locked.current = false
    setResult(null)
    setFailure(null)
  }

  return (
    <div className="scanner-page">
      <aside className="scanner-sidebar"><SidebarUnfoldableExample /></aside>
      <div className="scanner-content"><main className="scanner-main">
        <Link to={`/host-event?id=${eventId}`}>← Back to event workspace</Link>
        <span className="section-eyebrow">Entry check-in</span>
        <h1>Scan a<br /><em>ticket.</em></h1>
        <p>Point the camera at a Vista event ticket QR code.</p>
        <div className="scanner-frame"><Scanner onScan={handleScan} onError={(error) => setCameraError(error.message)} constraints={{ facingMode: 'environment' }} /></div>
        {cameraError && <p className="scanner-camera-error" role="alert">Camera unavailable: {cameraError}. Allow camera access and use a secure connection.</p>}
        {result && <section className="scanner-result scanner-result-success" aria-live="polite"><span className="scanner-result-icon">✓</span><div><h2>{result.name}</h2><p className="scanner-verified">Verified</p></div><button onClick={scanNextTicket} type="button">Scan next ticket</button></section>}
        {failure && <section className="scanner-result scanner-result-error" aria-live="polite"><span className="scanner-result-icon">!</span><div><h2>{failure.code === 'already_used' ? 'Ticket already used' : failure.code === 'wrong_event' ? 'Wrong event' : failure.code === 'cancelled' ? 'Registration cancelled' : failure.code === 'invalid_signature' || failure.code === 'invalid_ticket' ? 'Not recognised / invalid' : 'Could not check in'}</h2><p>{failure.message}</p>{failure.checkedInAt && <small>First scanned {new Date(failure.checkedInAt).toLocaleString()}</small>}</div><button onClick={scanNextTicket} type="button">Scan another ticket</button></section>}
      </main>
      </div>
    </div>
  )
}

export default ScannerPage
