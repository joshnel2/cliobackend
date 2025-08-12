import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const users = await listUsers(firmId)
    const results = users.map((u: any) => ({
      id: u.id,
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
      email: u.email || '',
    }))
    res.status(200).json({ ok: true, users: results })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'users failed' })
  }
}