import type { IncomingMessage } from 'http'
import { getJson, setJson } from './kv'

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
  const tokens = await ensureAccessToken(firmId)
  const url = new URL(`${CLIO_BASE_URL}/api/v4${path}`)
  if (search) {
    Object.entries(search).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  }
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (resp.status === 401) {
    const refreshed = await refreshTokens(tokens)
    await saveTokens(firmId, refreshed)
    const retry = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${refreshed.access_token}` },
    })
    if (!retry.ok) throw new Error(`Clio API error: ${retry.status}`)
    return await retry.json() as T
  }
  if (!resp.ok) throw new Error(`Clio API error: ${resp.status}`)
  return await resp.json() as T
}

export async function listUsers(firmId: string): Promise<any[]> {
  // Basic pagination loop; refine as needed
  const users: any[] = []
  let page = 1
  while (true) {
    const res = await clioGet<{ users: any[] }>(firmId, '/users', { page, per_page: 200 })
    if (!res.users || res.users.length === 0) break
    users.push(...res.users)
    if (res.users.length < 200) break
    page += 1
  }
  return users
}