import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'

type HeaderProps = { authPage?: 'login' | 'signup' | 'verify' }

function Header({ authPage }: HeaderProps) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) return
    const frame = window.requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash, location.pathname])

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Vista home">
        <img className="brand-wordmark" src="/vista-wordmark.png" alt="Vista" />
      </Link>

      <nav className="main-nav" aria-label="Main navigation">
        <Link className={location.pathname === '/events' ? 'active' : ''} to="/events">Events</Link>
        <Link className={location.hash === '#how-it-works' ? 'active' : ''} to="/#how-it-works">How it works</Link>
        <Link className={location.hash === '#about' ? 'active' : ''} to="/#about">About</Link>
      </nav>

      <div className="header-actions">
        <button className="header-theme-toggle" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span><span className="header-theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
        {user ? <Link className="sign-in" to="/registered-events">Registered events</Link> : authPage === 'login' ? <Link className="sign-in" to="/signup">Create account</Link> : <Link className="sign-in" to="/login">Sign in</Link>}
      </div>
    </header>
  )
}

export default Header
