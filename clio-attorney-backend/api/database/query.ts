import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../../lib/database.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const table = req.query.table as string
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    const sortBy = req.query.sortBy as string
    const sortOrder = (req.query.sortOrder as string) || 'asc'
    const search = req.query.search as string

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!table) {
      return res.status(400).json({ error: 'Table parameter required' })
    }

    await db.connect()

    let data: any[] = []
    let totalCount = 0

    try {
      switch (table) {
        case 'attorneys':
          data = await queryAttorneys(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getAttorneysCount(firmId, search)
          break

        case 'matters':
          data = await queryMatters(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getMattersCount(firmId, search)
          break

        case 'time_entries':
          data = await queryTimeEntries(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getTimeEntriesCount(firmId, search)
          break

        case 'payments':
          data = await queryPayments(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getPaymentsCount(firmId, search)
          break

        case 'bills':
          data = await queryBills(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getBillsCount(firmId, search)
          break

        case 'payout_summary':
          data = await getPayoutSummary(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getPayoutSummaryCount(firmId, search)
          break

        case 'matter_breakdown':
          data = await getMatterBreakdown(firmId, { limit, offset, sortBy, sortOrder, search })
          totalCount = await getMatterBreakdownCount(firmId, search)
          break

        default:
          return res.status(400).json({ error: `Unsupported table: ${table}` })
      }

      res.status(200).json({
        ok: true,
        data,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      })

    } finally {
      await db.disconnect()
    }

  } catch (err: any) {
    console.error('Database query API error:', err)
    res.status(500).json({ error: err.message || 'Database query failed' })
  }
}

// Query functions for each table
async function queryAttorneys(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE firm_id = $1 AND is_active = true'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY ${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY name'
  
  const query = `
    SELECT 
      id, clio_id, name, first_name, last_name, email, hourly_rate,
      created_at, updated_at, synced_at
    FROM attorneys 
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getAttorneysCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE firm_id = $1 AND is_active = true'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const result = await db.client.query(`SELECT COUNT(*) FROM attorneys ${whereClause}`, params)
  return parseInt(result.rows[0].count)
}

async function queryMatters(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE m.firm_id = $1 AND m.is_active = true'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (m.display_number ILIKE $${params.length + 1} OR m.description ILIKE $${params.length + 1} OR m.client_name ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY m.${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY m.updated_at DESC'
  
  const query = `
    SELECT 
      m.id, m.clio_id, m.display_number, m.description, m.status, m.client_name,
      m.total_collected, m.total_billed, m.created_at, m.updated_at, m.synced_at,
      oa.name as originating_attorney_name,
      ra.name as responsible_attorney_name
    FROM matters m
    LEFT JOIN attorneys oa ON m.originating_attorney_id = oa.id
    LEFT JOIN attorneys ra ON m.responsible_attorney_id = ra.id
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getMattersCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE firm_id = $1 AND is_active = true'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (display_number ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1} OR client_name ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const result = await db.client.query(`SELECT COUNT(*) FROM matters ${whereClause}`, params)
  return parseInt(result.rows[0].count)
}

async function queryTimeEntries(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE te.firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (a.name ILIKE $${params.length + 1} OR m.display_number ILIKE $${params.length + 1} OR te.description ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY te.${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY te.date DESC'
  
  const query = `
    SELECT 
      te.id, te.clio_id, te.date, te.quantity, te.rate, te.total, te.billable,
      te.description, te.activity_description, te.created_at, te.updated_at,
      a.name as attorney_name,
      m.display_number as matter_number,
      m.description as matter_description
    FROM time_entries te
    LEFT JOIN attorneys a ON te.attorney_id = a.id
    LEFT JOIN matters m ON te.matter_id = m.id
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getTimeEntriesCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE te.firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (a.name ILIKE $${params.length + 1} OR m.display_number ILIKE $${params.length + 1} OR te.description ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const query = `
    SELECT COUNT(*) 
    FROM time_entries te
    LEFT JOIN attorneys a ON te.attorney_id = a.id
    LEFT JOIN matters m ON te.matter_id = m.id
    ${whereClause}
  `
  
  const result = await db.client.query(query, params)
  return parseInt(result.rows[0].count)
}

async function queryPayments(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE p.firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (m.display_number ILIKE $${params.length + 1} OR m.client_name ILIKE $${params.length + 1} OR p.reference ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY p.${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY p.date DESC'
  
  const query = `
    SELECT 
      p.id, p.clio_id, p.amount, p.date, p.method, p.status, p.reference,
      p.created_at, p.updated_at,
      m.display_number as matter_number,
      m.description as matter_description,
      m.client_name
    FROM payments p
    LEFT JOIN matters m ON p.matter_id = m.id
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getPaymentsCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE p.firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (m.display_number ILIKE $${params.length + 1} OR m.client_name ILIKE $${params.length + 1} OR p.reference ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const query = `
    SELECT COUNT(*) 
    FROM payments p
    LEFT JOIN matters m ON p.matter_id = m.id
    ${whereClause}
  `
  
  const result = await db.client.query(query, params)
  return parseInt(result.rows[0].count)
}

async function queryBills(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE b.firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (b.number ILIKE $${params.length + 1} OR m.display_number ILIKE $${params.length + 1} OR m.client_name ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY b.${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY b.issued_at DESC'
  
  const query = `
    SELECT 
      b.id, b.clio_id, b.number, b.total, b.status, b.issued_at, b.due_at, b.paid_at,
      b.created_at, b.updated_at,
      m.display_number as matter_number,
      m.description as matter_description,
      m.client_name
    FROM bills b
    LEFT JOIN matters m ON b.matter_id = m.id
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getBillsCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE b.firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (b.number ILIKE $${params.length + 1} OR m.display_number ILIKE $${params.length + 1} OR m.client_name ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const query = `
    SELECT COUNT(*) 
    FROM bills b
    LEFT JOIN matters m ON b.matter_id = m.id
    ${whereClause}
  `
  
  const result = await db.client.query(query, params)
  return parseInt(result.rows[0].count)
}

async function getPayoutSummary(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY ${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY total_payout DESC'
  
  const query = `
    SELECT * FROM attorney_payout_summary
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getPayoutSummaryCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const result = await db.client.query(`SELECT COUNT(*) FROM attorney_payout_summary ${whereClause}`, params)
  return parseInt(result.rows[0].count)
}

async function getMatterBreakdown(firmId: string, options: QueryOptions): Promise<any[]> {
  const { limit, offset, sortBy, sortOrder, search } = options
  
  let whereClause = 'WHERE firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (display_number ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const orderClause = sortBy ? `ORDER BY ${sanitizeColumn(sortBy)} ${sortOrder.toUpperCase()}` : 'ORDER BY total_payouts DESC'
  
  const query = `
    SELECT * FROM matter_payout_breakdown
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  
  params.push(limit, offset)
  const result = await db.client.query(query, params)
  return result.rows
}

async function getMatterBreakdownCount(firmId: string, search?: string): Promise<number> {
  let whereClause = 'WHERE firm_id = $1'
  const params = [firmId]
  
  if (search) {
    whereClause += ` AND (display_number ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`
    params.push(`%${search}%`)
  }
  
  const result = await db.client.query(`SELECT COUNT(*) FROM matter_payout_breakdown ${whereClause}`, params)
  return parseInt(result.rows[0].count)
}

// Utility functions
interface QueryOptions {
  limit: number
  offset: number
  sortBy?: string
  sortOrder: string
  search?: string
}

function sanitizeColumn(column: string): string {
  // Allow only alphanumeric characters and underscores
  return column.replace(/[^a-zA-Z0-9_]/g, '')
}