import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getTokens } from '../lib/clio.js'
import { kv } from '@vercel/kv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    const envStatus = {
      CLIO_CLIENT_ID: Boolean(process.env.CLIO_CLIENT_ID),
      CLIO_CLIENT_SECRET: Boolean(process.env.CLIO_CLIENT_SECRET),
      CLIO_REDIRECT_URI: process.env.CLIO_REDIRECT_URI || 'missing',
      CLIO_BASE_URL: process.env.CLIO_BASE_URL || 'missing',
      DEFAULT_SCOPE: process.env.DEFAULT_SCOPE || 'missing',
      KV_URL: Boolean(process.env.KV_URL),
      KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
      KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    }

    // Verify redirect host matches current request host
    const currentHost = req.headers.host || ''
    let redirectHostMatch: boolean | string = false
    try {
      const u = new URL(String(envStatus.CLIO_REDIRECT_URI))
      redirectHostMatch = u.host === currentHost
    } catch {
      redirectHostMatch = 'invalid_redirect_uri'
    }

    // KV connectivity test
    let kvOk = false
    let kvError: string | undefined
    try {
      const key = `health:test:${Date.now()}`
      await kv.set(key, 'ok', { ex: 10 })
      const val = await kv.get<string>(key)
      kvOk = val === 'ok'
    } catch (e: any) {
      kvError = e?.message || String(e)
    }

    const tokens = await getTokens(firmId)
    const nowSec = Math.floor(Date.now() / 1000)
    const tokenInfo = tokens
      ? { present: true, expiresInSeconds: (tokens.expires_at ?? 0) - nowSec }
      : { present: false }

    res.status(200).json({
      ok: true,
      firmId,
      env: envStatus,
      redirectHostMatch,
      kv: { ok: kvOk, error: kvError },
      token: tokenInfo,
    })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'health check failed' })
  }
}