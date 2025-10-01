import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers, listBills, listMatters, listTimeEntries, listPayments } from '../lib/clio.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const view = req.query.view as string

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const views = {
      attorneys: {
        name: 'Attorneys',
        description: 'All attorneys in your firm',
        fields: ['id', 'name', 'email', 'first_name', 'last_name']
      },
      matters: {
        name: 'Matters',
        description: 'All matters and cases',
        fields: ['id', 'display_number', 'description', 'status', 'client', 'originating_attorney']
      },
      bills: {
        name: 'Bills',
        description: 'All billing records',
        fields: ['id', 'number', 'total', 'status', 'issued_at', 'due_at', 'matter']
      },
      time_entries: {
        name: 'Time Entries',
        description: 'All time tracking records',
        fields: ['id', 'date', 'quantity', 'rate', 'total', 'billable', 'user', 'matter']
      },
      payments: {
        name: 'Payments',
        description: 'All payment records',
        fields: ['id', 'date', 'amount', 'method', 'status', 'matter']
      }
    }

    if (view && views[view as keyof typeof views]) {
      // Return specific view data
      let data: any[] = []
      
      switch (view) {
        case 'attorneys':
          data = await listUsers(firmId)
          break
        case 'matters':
          data = await listMatters(firmId)
          break
        case 'bills':
          data = await listBills(firmId)
          break
        case 'time_entries':
          data = await listTimeEntries(firmId)
          break
        case 'payments':
          data = await listPayments(firmId)
          break
      }

      res.status(200).json({ 
        ok: true, 
        view: views[view as keyof typeof views],
        data: data.slice(0, 1000) // Limit to 1000 records for performance
      })
    } else {
      // Return all available views
      res.status(200).json({ ok: true, views })
    }
  } catch (err: any) {
    console.error('Data views API error:', err)
    res.status(500).json({ error: err.message || 'Data views operation failed' })
  }
}