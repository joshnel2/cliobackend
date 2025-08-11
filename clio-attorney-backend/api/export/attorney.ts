import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../../lib/clio'
import { buildSingleAttorneyWorkbook } from '../../lib/excel'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const attorneyId = req.query.attorneyId as string
    if (!attorneyId) return res.status(400).json({ error: 'Missing attorneyId' })

    const users = await listUsers(firmId)
    const user = users.find((u: any) => String(u.id) === String(attorneyId))
    if (!user) return res.status(404).json({ error: 'Attorney not found' })

    const attorney = {
      id: user.id,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || `User ${user.id}`,
      working: 0,
      originating: 0,
      referral: 0,
    }

    const buf = await buildSingleAttorneyWorkbook(attorney)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="attorney-${attorney.id}.xlsx"`)
    res.status(200).send(buf)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export attorney failed' })
  }
}