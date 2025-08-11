import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../lib/clio'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    const users = await listUsers(firmId)

    // TODO: Replace with your real algorithms. This is a placeholder structure.
    const metrics = {
      generatedAt: new Date().toISOString(),
      firmId,
      totals: {
        attorneys: users.length,
        working: 0,
        originating: 0,
        referral: 0,
      },
      byAttorney: users.map(u => ({
        id: u.id,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
        working: 0,
        originating: 0,
        referral: 0,
      })),
    }

    res.status(200).json({ ok: true, metrics })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' })
  }
}