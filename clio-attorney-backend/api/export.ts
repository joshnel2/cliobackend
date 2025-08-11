import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../lib/clio.js'
import { buildSplitWorkbook, type SplitPayload } from '../lib/excel.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    // Placeholder: derive matters and splits until real algorithms are provided
    const users = await listUsers(firmId)
    const someMatters = [
      { matterId: 1001, matterName: 'Matter A' },
      { matterId: 1002, matterName: 'Matter B' },
    ]

    const originator = users[0]
    const worker = users[1] || users[0]

    const payload: SplitPayload = {
      generatedAt: new Date().toISOString(),
      firmId,
      matters: someMatters.map((m, idx) => ({
        matterId: m.matterId,
        matterName: m.matterName,
        totalCollected: 1000 + idx * 500,
        shares: [
          { id: originator?.id || 'o', name: `${originator?.first_name ?? ''} ${originator?.last_name ?? ''}`.trim() || 'Originator', role: 'originator', amount: 400 + idx * 100 },
          { id: worker?.id || 'w', name: `${worker?.first_name ?? ''} ${worker?.last_name ?? ''}`.trim() || 'Attorney', role: 'working', amount: 600 + idx * 400 },
        ],
      })),
    }

    const buf = await buildSplitWorkbook(payload)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="metrics-${firmId}.xlsx"`)
    res.status(200).send(buf)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export failed' })
  }
}