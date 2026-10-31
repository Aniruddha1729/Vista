const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || ''

export function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('/uploads/'))) return `${apiBaseUrl}${input}`
  if (input instanceof URL && (input.pathname.startsWith('/api/') || input.pathname.startsWith('/uploads/'))) return `${apiBaseUrl}${input.pathname}${input.search}${input.hash}`
  return input
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const hasAuthorization = new Headers(init.headers).has('Authorization')
  const response = await fetch(resolveApiUrl(input), init)

  if (response.status === 401 && hasAuthorization && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('vista:session-expired'))
  }

  return response
}
