import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './AuthPage.css'

type AuthPageProps = { mode: 'login' | 'signup' }

function AuthPage({ mode }: AuthPageProps) {
  const isSignup = mode === 'signup'
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from || '/events'
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      if (isSignup) {
        const email = String(form.get('email'))
        const signupMessage = await signup({
          name: String(form.get('name')),
          username: String(form.get('username')),
          email,
          password: String(form.get('password')),
        })
        navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true, state: { from: returnTo, notice: signupMessage } })
        return
      } else {
        await login({ identifier: String(form.get('identifier')), password: String(form.get('password')) })
      }
      navigate(returnTo, { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page-layout">
    <aside className="auth-page-sidebar"><SidebarUnfoldableExample /></aside>
    <main className="auth-page">
      <section className="auth-card">
        <span className="section-eyebrow">Campus events, made simple</span>
        <h1>{isSignup ? <>Join the<br /><em>community.</em></> : <>Welcome<br /><em>back.</em></>}</h1>
        <p>{isSignup ? 'Create an account to save events and keep your registrations in one place.' : 'Sign in to see your events and continue where you left off.'}</p>
        {typeof (location.state as { notice?: unknown } | null)?.notice === 'string' && <p className="verify-email-note" role="status">{(location.state as { notice: string }).notice}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && <label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={80} /></label>}
          {isSignup && <label>Username<input name="username" autoComplete="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" /></label>}
          <label>{isSignup ? 'Email address' : 'Email or username'}<input name={isSignup ? 'email' : 'identifier'} type={isSignup ? 'email' : 'text'} autoComplete={isSignup ? 'email' : 'username'} required /></label>
          <label>Password<input name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={isSignup ? 8 : undefined} maxLength={72} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} <span>↗</span></button>
        </form>
        {!isSignup && <div className="auth-switch"><Link to="/verify-email">Resend verification email</Link></div>}
        <div className="auth-switch">{isSignup ? 'Already have an account?' : 'New to Vista?'} <Link to={isSignup ? '/login' : '/signup'} state={{ from: returnTo }}>{isSignup ? 'Sign in' : 'Create an account'}</Link></div>
      </section>
    </main>
    </div>
  )
}

export default AuthPage
