import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../lib/clio.js'
import { getTokens } from '../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const debug = req.query.debug === '1'

    const users = await listUsers(firmId)
    const results = users.map((u: any) => {
      const first = u.first_name || ''
      const last = u.last_name || ''
      const composed = `${first} ${last}`.trim()
      const displayName = (u.name && String(u.name).trim()) || composed
      return {
        id: u.id,
        first_name: first,
        last_name: last,
        name: composed,
        displayName,
        email: u.email || '',
      }
    })

    if (!debug) {
      return res.status(200).json({ ok: true, users: results })
    }

    const tokens = await getTokens(firmId)
    res.status(200).json({
      ok: true,
      count: results.length,
      baseUrl: process.env.CLIO_BASE_URL || 'https://app.clio.com',
      scope: tokens?.scope || null,
      users: results,
    })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'users failed' })
  }
}