import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import './AuthPage.css'

function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const token = searchParams.get('token')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [message, setMessage] = useState(token ? 'Checking your verification link…' : notice || 'Enter the email you used to create your account and we’ll send a verification link.')
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [sending, setSending] = useState(false)
  const attempted = useRef(false)
  const returnTo = (location.state as { from?: string } | null)?.from || '/events'

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true
    authenticatedFetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json() as { message?: string }
      if (!response.ok) throw new Error(result.message || 'This verification link is invalid or expired.')
      setVerified(true)
      setMessage(result.message || 'Your email is verified. You can now sign in.')
    }).catch((verifyError: unknown) => {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify this email address.')
      setMessage('')
    })
  }, [token])

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const response = await authenticatedFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json() as { message?: string }
      if (!response.ok) throw new Error(result.message || 'Could not send a new verification link.')
      setMessage(result.message || 'If this account needs verification, a new link will be sent.')
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send a new verification link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="auth-page-layout">
    <aside className="auth-page-sidebar"><SidebarUnfoldableExample /></aside>
    <main className="auth-page verify-email-page">
      <section className="auth-card">
        <span className="section-eyebrow">One quick check</span>
        <h1>{verified ? <>Email<br /><em>verified.</em></> : <>Check your<br /><em>inbox.</em></>}</h1>
        {message && <p className="verify-email-note" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {verified ? (
          <Link className="auth-submit verify-sign-in" to="/login" state={{ from: returnTo, notice: 'Your email is verified. Sign in to continue.' }}>Continue to sign in <span>↗</span></Link>
        ) : (
          <form className="auth-form" onSubmit={resend}>
            <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <button className="auth-submit" disabled={sending} type="submit">{sending ? 'Sending…' : 'Send verification link'} <span>↗</span></button>
          </form>
        )}
        <div className="auth-switch"><Link to="/login" state={{ from: returnTo }}>Back to sign in</Link></div>
      </section>
    </main>
    </div>
  )
}

export default VerifyEmailPage
