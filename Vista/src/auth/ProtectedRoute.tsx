import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function ProtectedRoute() {
  const { user, loading, sessionExpired } = useAuth()
  const location = useLocation()

  if (loading) return <div className="auth-loading">Loading your account…</div>
  if (sessionExpired) return <div className="auth-loading">Your session expired. Redirecting to sign in…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  return <Outlet />
}
