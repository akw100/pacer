import { getAccessToken } from './supabase'

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

if (!apiBaseUrl) {
  throw new Error('Missing VITE_API_URL environment variable')
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}) {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error || response.statusText)
  }

  return body as T
}
