import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listBills } from '../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const bills = await listBills(firmId, {
      per_page: 200
    })

    // Transform bills data for frontend consumption
    const transformedBills = bills.map(bill => ({
      id: bill.id,
      number: bill.number || bill.id,
      total: parseFloat(bill.total) || 0,
      status: bill.status || 'unknown',
      issued_at: bill.issued_at,
      due_at: bill.due_at,
      matter_id: bill.matter?.id,
      matter_name: bill.matter?.display_number || bill.matter?.description || 'Unknown Matter',
      client_name: bill.matter?.client?.name || 'Unknown Client',
      created_at: bill.created_at,
      updated_at: bill.updated_at
    }))

    res.status(200).json({ 
      ok: true, 
      bills: transformedBills,
      count: transformedBills.length
    })
  } catch (err: any) {
    console.error('Bills API error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch bills' })
  }
}