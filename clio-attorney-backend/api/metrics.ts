import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // In the future, retrieve precomputed metrics from KV or compute on demand
  res.status(200).json({ ok: true, message: 'Metrics placeholder. Provide algorithms to compute results.' })
}