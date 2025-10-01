import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listTimeEntries } from '../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const timeEntries = await listTimeEntries(firmId, {
      per_page: 200
    })

    // Transform time entries data for frontend consumption
    const transformedTimeEntries = timeEntries.map(entry => ({
      id: entry.id,
      date: entry.date,
      quantity: parseFloat(entry.quantity) || 0,
      rate: parseFloat(entry.rate) || 0,
      total: (parseFloat(entry.quantity) || 0) * (parseFloat(entry.rate) || 0),
      billable: entry.billable !== false,
      description: entry.description || '',
      user_id: entry.user?.id,
      attorney_name: entry.user?.name || 'Unknown Attorney',
      matter_id: entry.matter?.id,
      matter_name: entry.matter?.display_number || entry.matter?.description || 'Unknown Matter',
      activity_description: entry.activity?.name || entry.activity_description || '',
      created_at: entry.created_at,
      updated_at: entry.updated_at
    }))

    res.status(200).json({ 
      ok: true, 
      time_entries: transformedTimeEntries,
      count: transformedTimeEntries.length
    })
  } catch (err: any) {
    console.error('Time entries API error:', err)
    res.status(500).json({ error: err.message || 'Failed to fetch time entries' })
  }
}