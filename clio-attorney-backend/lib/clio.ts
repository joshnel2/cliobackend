import type { IncomingMessage } from 'http'
import { getJson, setJson } from './kv.js'

const CLIO_BASE_URL = process.env.CLIO_BASE_URL || 'https://app.clio.com'
const CLIENT_ID = process.env.CLIO_CLIENT_ID || ''
const CLIENT_SECRET = process.env.CLIO_CLIENT_SECRET || ''

export interface ClioTokens {
  access_token: string
  refresh_token: string
  token_type: string
  scope?: string
  expires_at: number
}

const TOKEN_KEY = (firmId: string) => `clio:toks:${firmId}`

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function getTokens(firmId: string): Promise<ClioTokens | null> {
  return await getJson<ClioTokens>(TOKEN_KEY(firmId))
}

export async function saveTokens(firmId: string, tokens: ClioTokens): Promise<void> {
  await setJson(TOKEN_KEY(firmId), tokens)
}

export async function refreshTokens(tokens: ClioTokens): Promise<ClioTokens> {
  const url = `${CLIO_BASE_URL}/oauth/token`
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!resp.ok) {
    throw new Error(`Failed to refresh Clio token: ${resp.status} ${await resp.text()}`)
  }
  const data = await resp.json() as any
  const expiresIn: number = data.expires_in ?? 3600
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    token_type: data.token_type ?? 'Bearer',
    scope: data.scope,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn - 60,
  }
}

export async function ensureAccessToken(firmId: string): Promise<ClioTokens> {
  const tokens = await getTokens(firmId)
  if (!tokens) throw new Error('No tokens stored for firm')
  const now = Math.floor(Date.now() / 1000)
  if (tokens.expires_at - now < 60) {
    const refreshed = await refreshTokens(tokens)
    await saveTokens(firmId, refreshed)
    return refreshed
  }
  return tokens
}

export async function clioGet<T>(firmId: string, path: string, search?: Record<string, string | number | boolean>): Promise<T> {
  const makeUrl = () => {
    const url = new URL(`${CLIO_BASE_URL}/api/v4${path}`)
    if (search) {
      Object.entries(search).forEach(([k, v]) => url.searchParams.set(k, String(v)))
    }
    return url.toString()
  }

  let tokens = await ensureAccessToken(firmId)
  let attempt = 0
  const maxAttempts = 3

  while (true) {
    attempt += 1
    const resp = await fetch(makeUrl(), { headers: { Authorization: `Bearer ${tokens.access_token}` } })

    if (resp.status === 401 && attempt <= maxAttempts) {
      tokens = await refreshTokens(tokens)
      await saveTokens(firmId, tokens)
      continue
    }

    if (resp.status === 429 && attempt < maxAttempts) {
      const retryAfterHeader = resp.headers.get('retry-after')
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 1000 * attempt
      await sleep(Math.min(retryAfterMs || 1000, 5000))
      continue
    }

    if (!resp.ok) {
      throw new Error(`Clio API error: ${resp.status}`)
    }

    return await resp.json() as T
  }
}

export async function listUsers(firmId: string): Promise<any[]> {
  type UsersResponse = { users?: any[]; data?: any[]; meta?: { records?: number } }

  // Cache users briefly to avoid rate limits
  const cacheKey = `clio:users:${firmId}`
  const cached = await getJson<any[]>(cacheKey)
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached
  }

  const users: any[] = []
  const MAX_PAGES = Number(process.env.CLIO_MAX_USER_PAGES || '1')

  async function fetchPage(path: string, page: number): Promise<any[]> {
    const res = await clioGet<UsersResponse>(firmId, path, { page, per_page: 200 })
    const pageUsers = (res.users ?? res.data ?? []) as any[]
    return pageUsers
  }

  // Try /users first, then fallback to /users.json if needed
  let page = 1
  try {
    for (; page <= MAX_PAGES; page++) {
      const pageUsers = await fetchPage('/users', page)
      if (pageUsers.length === 0) break
      users.push(...pageUsers)
      if (pageUsers.length < 200) break
    }
  } catch (e) {
    for (page = 1; page <= MAX_PAGES; page++) {
      const pageUsers = await fetchPage('/users.json', page)
      if (pageUsers.length === 0) break
      users.push(...pageUsers)
      if (pageUsers.length < 200) break
    }
  }

  // Normalize minimal fields (v4 may return only id and name)
  const normalized = users.map(u => {
    const name = (u.name || `${u.first_name ?? ''} ${u.last_name ?? ''}` || '').trim()
    return {
      id: u.id,
      name,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
    }
  })

  // Store in KV for 5 minutes
  if (normalized.length > 0) {
    await setJson(cacheKey, normalized, 300)
  }

  return normalized
}