import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const [scheme, token] = (request.get('authorization') || '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ code: 'authentication_required', message: 'Please log in to continue.' })
  }

  try {
    request.auth = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as jwt.JwtPayload & { sub: string }
    next()
  } catch {
    response.status(401).json({ code: 'session_expired', message: 'Your session expired. Please log in again.' })
  }
}
