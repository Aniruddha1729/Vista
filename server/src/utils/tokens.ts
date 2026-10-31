import jwt from 'jsonwebtoken'

type TokenUser = { id: string; role: string }

export function createAccessToken(user: TokenUser) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET as string, { expiresIn: '15m' })
}

export function createRefreshToken(user: TokenUser) {
  return jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' })
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as jwt.JwtPayload & { sub: string }
}

import type { CookieOptions } from 'express-serve-static-core'

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}
