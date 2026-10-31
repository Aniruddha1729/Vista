declare global {
  namespace Express {
    interface Request {
      auth?: { sub: string; role?: string }
      event?: import('mongoose').HydratedDocument<{
        shareToken?: string
        status: string
        host: unknown
        title: string
        startDate: Date
        venue: string
        poster?: string
        inviteTemplate: string
        inviteMessage: string
      }>
    }
  }
}

export {}
