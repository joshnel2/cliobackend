import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    const envStatus = {
      CLIO_CLIENT_ID: Boolean(process.env.CLIO_CLIENT_ID),
      CLIO_CLIENT_SECRET: Boolean(process.env.CLIO_CLIENT_SECRET),
      CLIO_REDIRECT_URI: process.env.CLIO_REDIRECT_URI || 'missing',
      CLIO_BASE_URL: process.env.CLIO_BASE_URL || 'missing',
      DEFAULT_SCOPE: process.env.DEFAULT_SCOPE || 'missing',
      KV_URL_set: Boolean(process.env.KV_URL),
      KV_REST_API_URL_set: Boolean(process.env.KV_REST_API_URL),
      KV_REST_API_TOKEN_set: Boolean(process.env.KV_REST_API_TOKEN),
    }

    const currentHost = req.headers.host || ''
    let redirectHostMatch: boolean | string = false
    try {
      const u = new URL(String(envStatus.CLIO_REDIRECT_URI))
      redirectHostMatch = u.host === currentHost
    } catch {
      redirectHostMatch = 'invalid_redirect_uri'
    }

    res.status(200).json({ ok: true, firmId, host: currentHost, env: envStatus, redirectHostMatch })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'env check failed' })
  }
}