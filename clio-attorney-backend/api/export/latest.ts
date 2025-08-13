import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kv } from '@vercel/kv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const buf = await kv.get<Buffer>('reports:latest:xlsx')
    if (!buf) return res.status(404).json({ ok: false, error: 'no latest workbook' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="attorney-splits-latest.xlsx"')
    res.status(200).send(buf)
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'download failed' })
  }
}