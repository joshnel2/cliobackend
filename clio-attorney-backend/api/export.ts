import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../lib/clio'
import { buildWorkbook, type MetricsPayload } from '../lib/excel'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    // Placeholder: derive metrics from users until algorithms are provided
    const users = await listUsers(firmId)
    const byAttorney = users.map((u: any) => ({
      id: u.id,
      name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || `User ${u.id}`,
      working: 0,
      originating: 0,
      referral: 0,
    }))

    const metrics: MetricsPayload = {
      generatedAt: new Date().toISOString(),
      firmId,
      totals: {
        attorneys: byAttorney.length,
        working: 0,
        originating: 0,
        referral: 0,
      },
      byAttorney,
    }

    const buf = await buildWorkbook(metrics)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${firmId}.xlsx"`)
    res.status(200).send(buf)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export failed' })
  }
}