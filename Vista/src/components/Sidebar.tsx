import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import './Sidebar.css'
import { usePendingInvitationCount } from '../hooks/usePendingInvitationCount'

const exploreLinks = [
  { icon: '⌕', label: 'Discover events', href: '/events' },
  { icon: '♡', label: 'Saved events', href: '/saved-events' },
]

const organiseLinks = [
  { icon: '◷', label: 'Registered events', href: '/registered-events' },
  { icon: '✦', label: 'My events', href: '/my-events' },
  { icon: '•', label: 'Notifications', href: '/notifications' },
  { icon: '+', label: 'Host an event', href: '/host-event' },
]

function SidebarLinks({ links, pendingInvitations = 0 }: { links: typeof exploreLinks; pendingInvitations?: number }) {
  return (
    <div className="vista-sidebar-links">
      {links.map((link) => (
        <NavLink
          className={({ isActive }) => `vista-sidebar-link${isActive ? ' active' : ''}`}
          end={link.href === '/events'}
          to={link.href}
          key={link.label}
          data-tooltip={link.label}
        >
          <span className="vista-sidebar-icon" aria-hidden="true">{link.icon}</span>
          <span className="vista-sidebar-text">{link.label}</span>
          {link.href === '/notifications' && pendingInvitations > 0 && <span className="sidebar-notification-dot" aria-label={`${pendingInvitations} pending invitation${pendingInvitations === 1 ? '' : 's'}`} />}
        </NavLink>
      ))}
    </div>
  )
}

export function SidebarUnfoldableExample() {
  const { user } = useAuth()
  const dock = user?.sidebarStyle === 'dock'
  const pendingInvitations = usePendingInvitationCount()
  const [dockVisible, setDockVisible] = useState(false)
  const dockLinks = [
    { icon: '⌂', label: 'Home', href: '/' },
    { icon: '⌕', label: 'Discover events', href: '/events' },
    { icon: '♡', label: 'Saved events', href: '/saved-events' },
    { icon: '◷', label: 'Registered events', href: '/registered-events' },
    { icon: '✦', label: 'My events', href: '/my-events' },
    { icon: '•', label: 'Notifications', href: '/notifications' },
    { icon: '+', label: 'Host an event', href: '/host-event' },
    { icon: '⚙', label: 'Settings', href: '/settings' },
  ]

  useEffect(() => {
    document.body.classList.toggle('vista-sidebar-dock-mode', Boolean(user && dock))
    return () => document.body.classList.remove('vista-sidebar-dock-mode')
  }, [user, dock])

  useEffect(() => {
    if (!dock) return
    let hideTimer = 0
    const handlePointerMove = (event: PointerEvent) => {
      const isDockTarget = event.target instanceof Element && Boolean(event.target.closest('.vista-sidebar-dock'))
      if (window.innerHeight - event.clientY <= 92 || isDockTarget) {
        window.clearTimeout(hideTimer)
        setDockVisible(true)
        return
      }
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => setDockVisible(false), 280)
    }
    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.clearTimeout(hideTimer)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [dock])

  if (!user) return null

  if (dock) {
    return (
      <nav className={`vista-sidebar vista-sidebar-dock${dockVisible ? ' vista-sidebar-dock-visible' : ''}`} aria-label="Quick navigation">
        {dockLinks.map((link) => (
          <NavLink
            aria-label={link.label}
            className={({ isActive }) => `vista-sidebar-link vista-dock-icon${isActive ? ' active' : ''}`}
            data-tooltip={link.label}
            end={link.href === '/'}
            key={link.label}
            to={link.href}
          >
            <span className="vista-sidebar-icon" aria-hidden="true">{link.icon}</span>
            {link.href === '/notifications' && pendingInvitations > 0 && <span className="sidebar-notification-dot" aria-label={`${pendingInvitations} pending invitations`} />}
          </NavLink>
        ))}
      </nav>
    )
  }

  return (
    <nav className="vista-sidebar" aria-label="Sidebar navigation">
      <NavLink className="vista-sidebar-logo" to="/" aria-label="Vista home" data-tooltip="Home">
        <span>V</span>
        <strong className="vista-sidebar-text">Vista</strong>
      </NavLink>
      <div className="vista-sidebar-section">
        <span className="vista-sidebar-heading vista-sidebar-text">Explore events</span>
        <SidebarLinks links={exploreLinks} />
      </div>
      <div className="vista-sidebar-section">
        <span className="vista-sidebar-heading vista-sidebar-text">Organise events</span>
        <SidebarLinks links={organiseLinks} pendingInvitations={pendingInvitations} />
      </div>
      <div className="vista-sidebar-bottom">
        <NavLink className={({ isActive }) => `vista-sidebar-link${isActive ? ' active' : ''}`} to="/settings" data-tooltip="Settings">
          <span className="vista-sidebar-icon" aria-hidden="true">⚙</span>
          <span className="vista-sidebar-text">Settings</span>
        </NavLink>
      </div>
    </nav>
  )
}

export default SidebarUnfoldableExample
