import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/useTheme'
import { useLocation } from 'react-router-dom'
import { usePendingInvitationCount } from '../hooks/usePendingInvitationCount'

const GooeyNav = lazy(() => import('./GooeyNav'))

function LoggedInHeader() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const pendingInvitations = usePendingInvitationCount()

  useEffect(() => {
    if (!menuOpen) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])
  const signedInNavigation = [
    { label: 'Events', href: '/events' },
    { label: 'Registered', href: '/registered-events' },
    { label: 'My events', href: '/my-events' },
    { label: 'Notifications', href: '/notifications', icon: pendingInvitations > 0 ? <span className="notification-dot" aria-label={`${pendingInvitations} pending invitation${pendingInvitations === 1 ? '' : 's'}`} /> : undefined },
  ]
  const activeIndex = location.pathname === '/' || location.pathname === '/saved-events' ? -1 : location.pathname === '/registered-events' ? 1 : location.pathname === '/my-events' ? 2 : location.pathname === '/notifications' ? 3 : 0

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className={`logged-in-header${location.pathname === '/' ? ' logged-in-header-home' : ''}`}>
      <Link className="logged-in-brand" to="/" aria-label="Vista home">
        <img className="brand-wordmark" src="/vista-wordmark.png" alt="Vista" />
      </Link>

      <Suspense fallback={<nav className="site-nav-fallback logged-in-nav-fallback" aria-label="Main navigation">{signedInNavigation.map((item) => <Link to={item.href} key={item.label}>{item.label}{item.icon}</Link>)}</nav>}>
        <GooeyNav items={signedInNavigation} activeIndex={activeIndex} onChange={(_index: number, item: { label: string; href?: string }) => { setMenuOpen(false); if (item.href) navigate(item.href) }} style={{}} theme="light" color="#c8f246" activeTextColor="#11130f" size="sm" frame={false} particleCount={12} spread={36} animationTime={480} className="site-gooey-nav logged-in-gooey-nav" />
      </Suspense>

      <div className="logged-in-actions" ref={profileMenuRef}>
        {user && <Link className="free-tier" to="/plans" aria-label="View plan options">{user.plan === 'pro' ? 'Pro plan' : 'Free tier'} <span aria-hidden="true">↗</span></Link>}
        <button className="profile-button" type="button" aria-label="Open profile menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span className="profile-mark">{user?.name?.[0]?.toUpperCase() || 'V'}</span>
        </button>
        {menuOpen && <div className="profile-menu">
          {user ? <><span className="profile-menu-name">{user.name}</span><Link to="/profile" onClick={() => setMenuOpen(false)}>View profile</Link><Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link><button type="button" onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button><button type="button" onClick={handleLogout}>Sign out</button></> : <><Link to="/login">Sign in</Link><Link to="/signup">Create account</Link><button type="button" onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button></>}
        </div>}
      </div>
    </header>
  )
}

export default LoggedInHeader
