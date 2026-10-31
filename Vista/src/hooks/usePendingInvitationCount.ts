import { useCallback, useEffect, useState } from 'react'
import { getMyTeamInvitations } from '../data/eventsApi'
import { useAuth } from '../auth/useAuth'

export const invitationsChangedEvent = 'vista:invitations-changed'

export function usePendingInvitationCount() {
  const { accessToken } = useAuth()
  const [count, setCount] = useState(0)
  const refresh = useCallback(() => {
    if (!accessToken) return
    getMyTeamInvitations(accessToken)
      .then((items) => setCount(items.filter((item) => item.memberStatus === 'pending' && item.status === 'pending').length))
      .catch(() => setCount(0))
  }, [accessToken])

  useEffect(() => {
    refresh()
    window.addEventListener(invitationsChangedEvent, refresh)
    const interval = window.setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener(invitationsChangedEvent, refresh)
      window.clearInterval(interval)
    }
  }, [refresh])

  return count
}
