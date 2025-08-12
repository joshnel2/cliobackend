import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../../lib/clio.js'
import { buildSplitWorkbook, type SplitPayload } from '../../lib/excel.js'
import { sendEmailWithAttachment } from '../../lib/email.js'

function prevMonthRange(): { y: number; m: number; label: string } {
  const now = new Date()
  const m = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()
  const y = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  const label = `${y}-${String(m).padStart(2, '0')}`
  return { y, m, label }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    // TODO: replace with real data fetch and split logic
    const users = await listUsers(firmId)
    const origin = users[0]
    const worker = users[1] || origin

    const payload: SplitPayload = {
      generatedAt: new Date().toISOString(),
      firmId,
      matters: [
        {
          matterId: 'demo-1',
          matterName: 'Demo Matter',
          totalCollected: 1000,
          shares: [
            { id: origin?.id || 'o', name: `${origin?.first_name ?? ''} ${origin?.last_name ?? ''}`.trim() || 'Originator', role: 'originator', amount: 500 },
            { id: worker?.id || 'w', name: `${worker?.first_name ?? ''} ${worker?.last_name ?? ''}`.trim() || 'Attorney', role: 'working', amount: 500 },
          ],
          selfOrigSelfBilled: 300,
          selfOrigOthersBilled: 200,
          nonOrigSelfBilled: 0,
          originatorComputedAmount: 500,
        },
      ],
    }

    const xlsx = await buildSplitWorkbook(payload)

    const { label } = prevMonthRange()
    await sendEmailWithAttachment(
      `Attorney Splits ${label}`,
      `Attached are the originator splits for ${label}.`,
      `attorney-splits-${label}.xlsx`,
      xlsx,
    )

    res.status(200).json({ ok: true, sent: true })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'cron failed' })
  }
}