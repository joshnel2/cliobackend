import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ensureAccessToken } from '../../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const path = (req.query.path as string) || ''
    if (!path) return res.status(400).json({ ok: false, error: 'Missing ?path (e.g., payment_distributions, bills, activities, matters)' })

    const base = process.env.CLIO_BASE_URL || 'https://app.clio.com'
    const tokens = await ensureAccessToken(firmId)

    const url = new URL(`${base}/api/v4/${path}`)
    url.searchParams.set('page', String(1))
    url.searchParams.set('per_page', String(25))

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
      sampleItemKeys: json && Array.isArray(json.data) && json.data.length ? Object.keys(json.data[0]) : null,
      sample: text.slice(0, 1200),
    }

    res.status(200).json({ ok: true, tokenScope: tokens.scope || null, result })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'debug raw failed' })
  }
}