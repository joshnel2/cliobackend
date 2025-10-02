import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listPayments } from '../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const payments = await listPayments(firmId, {
      per_page: 200
    })

    // Transform payments data for frontend consumption
    const transformedPayments = payments.map(payment => ({
      id: payment.id,
      date: payment.date || payment.created_at,
      amount: parseFloat(payment.amount) || 0,
      method: payment.payment_method || payment.method || 'Unknown',
      status: payment.status || 'completed',
      reference: payment.reference || '',
      matter_id: payment.matter?.id,
      matter_name: payment.matter?.display_number || payment.matter?.description || 'Unknown Matter',
      client_name: payment.matter?.client?.name || 'Unknown Client',
      bill_id: payment.bill?.id,
      bill_number: payment.bill?.number,
      created_at: payment.created_at,
      updated_at: payment.updated_at
    }))

    res.status(200).json({ 
      ok: true, 
      payments: transformedPayments,
      count: transformedPayments.length
    })
  } catch (err: any) {
    console.error('Payments API error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch payments' })
  }
}