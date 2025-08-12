import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureAccessToken } from '../../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const base = process.env.CLIO_BASE_URL || 'https://app.clio.com'

    const tokens = await ensureAccessToken(firmId)

    const url = new URL(`${base}/api/v4/users`)
    url.searchParams.set('page', String(1))
    url.searchParams.set('per_page', String(50))

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json',
      },
    })

    const text = await resp.text()
    let json: any = null
    try { json = JSON.parse(text) } catch {}

    const result = {
      ok: resp.ok,
      status: resp.status,
      url: url.toString(),
      base,
      hasJson: Boolean(json),
      keys: json ? Object.keys(json) : null,
      sample: text.slice(0, 1000),
    }

    res.status(resp.ok ? 200 : 200).json({ ok: true, tokenScope: tokens.scope || null, result })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'debug users failed' })
  }
}