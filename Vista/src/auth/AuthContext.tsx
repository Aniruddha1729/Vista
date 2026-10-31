import { createContext } from 'react'

export type User = {
  id: string
  name: string
  username: string
  email: string
  role: 'student' | 'organizer' | 'admin'
  plan: 'free' | 'pro'
  sidebarStyle: 'hover' | 'dock'
  avatarUrl?: string
  profile: Record<string, unknown>
}

type Credentials = { identifier: string; password: string }
type SignupDetails = { name: string; username: string; email: string; password: string }
export type AuthContextValue = {
  user: User | null
  accessToken: string | null
  loading: boolean
  sessionExpired: boolean
  login: (credentials: Credentials) => Promise<void>
  signup: (details: SignupDetails) => Promise<string>
  logout: () => Promise<void>
  updateUser: (user: User) => void
  clearSessionExpired: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
