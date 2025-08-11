import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getTokens } from '../lib/clio'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    const envStatus = {
      CLIO_CLIENT_ID: Boolean(process.env.CLIO_CLIENT_ID),
      CLIO_CLIENT_SECRET: Boolean(process.env.CLIO_CLIENT_SECRET),
      CLIO_REDIRECT_URI: Boolean(process.env.CLIO_REDIRECT_URI),
      CLIO_BASE_URL: process.env.CLIO_BASE_URL || 'missing',
      DEFAULT_SCOPE: process.env.DEFAULT_SCOPE || 'missing',
      KV_URL: Boolean(process.env.KV_URL),
      KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
      KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    }

    const tokens = await getTokens(firmId)

    res.status(200).json({
      ok: true,
      firmId,
      env: envStatus,
      tokensPresent: Boolean(tokens),
    })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'health check failed' })
  }
}