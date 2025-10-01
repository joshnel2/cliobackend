import { createClient } from '@vercel/postgres'

// Database connection
const client = createClient({
  connectionString: process.env.POSTGRES_URL,
})

export interface DatabaseTables {
  attorneys: Attorney
  matters: Matter
  bills: Bill
  time_entries: TimeEntry
  payments: Payment
  algorithm_runs: AlgorithmRun
  payout_calculations: PayoutCalculation
}

export interface Attorney {
  id: string
  clio_id: string
  firm_id: string
  name: string
  first_name: string
  last_name: string
  email: string
  hourly_rate?: number
  is_active: boolean
  created_at: Date
  updated_at: Date
  synced_at: Date
}

export interface Matter {
  id: string
  clio_id: string
  firm_id: string
  display_number: string
  description: string
  status: string
  client_name?: string
  originating_attorney_id?: string
  responsible_attorney_id?: string
  total_collected: number
  total_billed: number
  is_active: boolean
  created_at: Date
  updated_at: Date
  synced_at: Date
}

export interface Bill {
  id: string
  clio_id: string
  firm_id: string
  matter_id: string
  number: string
  total: number
  status: string
  issued_at?: Date
  due_at?: Date
  paid_at?: Date
  created_at: Date
  updated_at: Date
  synced_at: Date
}

export interface TimeEntry {
  id: string
  clio_id: string
  firm_id: string
  matter_id: string
  attorney_id: string
  date: Date
  quantity: number
  rate: number
  total: number
  billable: boolean
  description?: string
  activity_description?: string
  created_at: Date
  updated_at: Date
  synced_at: Date
}

export interface Payment {
  id: string
  clio_id: string
  firm_id: string
  matter_id: string
  bill_id?: string
  amount: number
  date: Date
  method: string
  status: string
  reference?: string
  created_at: Date
  updated_at: Date
  synced_at: Date
}

export interface AlgorithmRun {
  id: string
  firm_id: string
  algorithm_id: string
  run_date: Date
  status: 'running' | 'completed' | 'failed'
  records_processed: number
  errors?: string
  execution_time_ms: number
  created_at: Date
}

export interface PayoutCalculation {
  id: string
  firm_id: string
  attorney_id: string
  matter_id?: string
  algorithm_run_id: string
  calculation_type: 'originating' | 'working' | 'referral' | 'bonus'
  base_amount: number
  percentage: number
  calculated_amount: number
  formula_used?: string
  variables_used?: Record<string, any>
  created_at: Date
}

export class Database {
  private client = client

  async connect() {
    await this.client.connect()
  }

  async disconnect() {
    await this.client.end()
  }

  // Attorney operations
  async getAttorneys(firmId: string): Promise<Attorney[]> {
    const result = await this.client.sql`
      SELECT * FROM attorneys 
      WHERE firm_id = ${firmId} AND is_active = true
      ORDER BY name
    `
    return result.rows as Attorney[]
  }

  async upsertAttorney(attorney: Omit<Attorney, 'id' | 'created_at' | 'updated_at'>): Promise<Attorney> {
    const result = await this.client.sql`
      INSERT INTO attorneys (
        clio_id, firm_id, name, first_name, last_name, email, 
        hourly_rate, is_active, synced_at
      ) VALUES (
        ${attorney.clio_id}, ${attorney.firm_id}, ${attorney.name}, 
        ${attorney.first_name}, ${attorney.last_name}, ${attorney.email},
        ${attorney.hourly_rate || null}, ${attorney.is_active}, ${attorney.synced_at}
      )
      ON CONFLICT (clio_id, firm_id) 
      DO UPDATE SET
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        hourly_rate = EXCLUDED.hourly_rate,
        is_active = EXCLUDED.is_active,
        synced_at = EXCLUDED.synced_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    return result.rows[0] as Attorney
  }

  // Matter operations
  async getMatters(firmId: string, limit = 1000): Promise<Matter[]> {
    const result = await this.client.sql`
      SELECT * FROM matters 
      WHERE firm_id = ${firmId} AND is_active = true
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `
    return result.rows as Matter[]
  }

  async upsertMatter(matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>): Promise<Matter> {
    const result = await this.client.sql`
      INSERT INTO matters (
        clio_id, firm_id, display_number, description, status, client_name,
        originating_attorney_id, responsible_attorney_id, total_collected, 
        total_billed, is_active, synced_at
      ) VALUES (
        ${matter.clio_id}, ${matter.firm_id}, ${matter.display_number}, 
        ${matter.description}, ${matter.status}, ${matter.client_name || null},
        ${matter.originating_attorney_id || null}, ${matter.responsible_attorney_id || null},
        ${matter.total_collected}, ${matter.total_billed}, ${matter.is_active}, ${matter.synced_at}
      )
      ON CONFLICT (clio_id, firm_id)
      DO UPDATE SET
        display_number = EXCLUDED.display_number,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        client_name = EXCLUDED.client_name,
        originating_attorney_id = EXCLUDED.originating_attorney_id,
        responsible_attorney_id = EXCLUDED.responsible_attorney_id,
        total_collected = EXCLUDED.total_collected,
        total_billed = EXCLUDED.total_billed,
        is_active = EXCLUDED.is_active,
        synced_at = EXCLUDED.synced_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    return result.rows[0] as Matter
  }

  // Time entry operations
  async getTimeEntries(firmId: string, matterId?: string, attorneyId?: string): Promise<TimeEntry[]> {
    let query = `
      SELECT * FROM time_entries 
      WHERE firm_id = $1
    `
    const params = [firmId]

    if (matterId) {
      query += ` AND matter_id = $${params.length + 1}`
      params.push(matterId)
    }

    if (attorneyId) {
      query += ` AND attorney_id = $${params.length + 1}`
      params.push(attorneyId)
    }

    query += ` ORDER BY date DESC`

    const result = await this.client.query(query, params)
    return result.rows as TimeEntry[]
  }

  async upsertTimeEntry(entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>): Promise<TimeEntry> {
    const result = await this.client.sql`
      INSERT INTO time_entries (
        clio_id, firm_id, matter_id, attorney_id, date, quantity, rate, total,
        billable, description, activity_description, synced_at
      ) VALUES (
        ${entry.clio_id}, ${entry.firm_id}, ${entry.matter_id}, ${entry.attorney_id},
        ${entry.date}, ${entry.quantity}, ${entry.rate}, ${entry.total}, ${entry.billable},
        ${entry.description || null}, ${entry.activity_description || null}, ${entry.synced_at}
      )
      ON CONFLICT (clio_id, firm_id)
      DO UPDATE SET
        matter_id = EXCLUDED.matter_id,
        attorney_id = EXCLUDED.attorney_id,
        date = EXCLUDED.date,
        quantity = EXCLUDED.quantity,
        rate = EXCLUDED.rate,
        total = EXCLUDED.total,
        billable = EXCLUDED.billable,
        description = EXCLUDED.description,
        activity_description = EXCLUDED.activity_description,
        synced_at = EXCLUDED.synced_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    return result.rows[0] as TimeEntry
  }

  // Payment operations
  async getPayments(firmId: string, matterId?: string): Promise<Payment[]> {
    let query = `
      SELECT * FROM payments 
      WHERE firm_id = $1
    `
    const params = [firmId]

    if (matterId) {
      query += ` AND matter_id = $${params.length + 1}`
      params.push(matterId)
    }

    query += ` ORDER BY date DESC`

    const result = await this.client.query(query, params)
    return result.rows as Payment[]
  }

  async upsertPayment(payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<Payment> {
    const result = await this.client.sql`
      INSERT INTO payments (
        clio_id, firm_id, matter_id, bill_id, amount, date, method, status, reference, synced_at
      ) VALUES (
        ${payment.clio_id}, ${payment.firm_id}, ${payment.matter_id}, ${payment.bill_id || null},
        ${payment.amount}, ${payment.date}, ${payment.method}, ${payment.status}, 
        ${payment.reference || null}, ${payment.synced_at}
      )
      ON CONFLICT (clio_id, firm_id)
      DO UPDATE SET
        matter_id = EXCLUDED.matter_id,
        bill_id = EXCLUDED.bill_id,
        amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        method = EXCLUDED.method,
        status = EXCLUDED.status,
        reference = EXCLUDED.reference,
        synced_at = EXCLUDED.synced_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    return result.rows[0] as Payment
  }

  // Analytics queries
  async getAttorneyPayoutSummary(firmId: string, startDate?: Date, endDate?: Date) {
    let dateFilter = ''
    const params = [firmId]

    if (startDate && endDate) {
      dateFilter = ` AND pc.created_at BETWEEN $${params.length + 1} AND $${params.length + 2}`
      params.push(startDate, endDate)
    }

    const result = await this.client.query(`
      SELECT 
        a.id,
        a.name,
        a.email,
        SUM(CASE WHEN pc.calculation_type = 'originating' THEN pc.calculated_amount ELSE 0 END) as originating_total,
        SUM(CASE WHEN pc.calculation_type = 'working' THEN pc.calculated_amount ELSE 0 END) as working_total,
        SUM(CASE WHEN pc.calculation_type = 'referral' THEN pc.calculated_amount ELSE 0 END) as referral_total,
        SUM(pc.calculated_amount) as total_payout,
        COUNT(DISTINCT pc.matter_id) as matters_count
      FROM attorneys a
      LEFT JOIN payout_calculations pc ON a.id = pc.attorney_id
      WHERE a.firm_id = $1 AND a.is_active = true ${dateFilter}
      GROUP BY a.id, a.name, a.email
      ORDER BY total_payout DESC
    `, params)

    return result.rows
  }

  async getMatterPayoutBreakdown(firmId: string, matterId: string) {
    const result = await this.client.sql`
      SELECT 
        m.display_number,
        m.description,
        m.total_collected,
        m.total_billed,
        a.name as attorney_name,
        pc.calculation_type,
        pc.calculated_amount,
        pc.percentage,
        pc.formula_used
      FROM matters m
      JOIN payout_calculations pc ON m.id = pc.matter_id
      JOIN attorneys a ON pc.attorney_id = a.id
      WHERE m.firm_id = ${firmId} AND m.id = ${matterId}
      ORDER BY pc.calculated_amount DESC
    `
    return result.rows
  }

  // Algorithm run tracking
  async createAlgorithmRun(run: Omit<AlgorithmRun, 'id' | 'created_at'>): Promise<AlgorithmRun> {
    const result = await this.client.sql`
      INSERT INTO algorithm_runs (
        firm_id, algorithm_id, run_date, status, records_processed, errors, execution_time_ms
      ) VALUES (
        ${run.firm_id}, ${run.algorithm_id}, ${run.run_date}, ${run.status},
        ${run.records_processed}, ${run.errors || null}, ${run.execution_time_ms}
      )
      RETURNING *
    `
    return result.rows[0] as AlgorithmRun
  }

  async updateAlgorithmRun(id: string, updates: Partial<AlgorithmRun>): Promise<AlgorithmRun> {
    const result = await this.client.sql`
      UPDATE algorithm_runs 
      SET 
        status = COALESCE(${updates.status}, status),
        records_processed = COALESCE(${updates.records_processed}, records_processed),
        errors = COALESCE(${updates.errors}, errors),
        execution_time_ms = COALESCE(${updates.execution_time_ms}, execution_time_ms)
      WHERE id = ${id}
      RETURNING *
    `
    return result.rows[0] as AlgorithmRun
  }

  // Payout calculation storage
  async savePayoutCalculation(calculation: Omit<PayoutCalculation, 'id' | 'created_at'>): Promise<PayoutCalculation> {
    const result = await this.client.sql`
      INSERT INTO payout_calculations (
        firm_id, attorney_id, matter_id, algorithm_run_id, calculation_type,
        base_amount, percentage, calculated_amount, formula_used, variables_used
      ) VALUES (
        ${calculation.firm_id}, ${calculation.attorney_id}, ${calculation.matter_id || null},
        ${calculation.algorithm_run_id}, ${calculation.calculation_type}, ${calculation.base_amount},
        ${calculation.percentage}, ${calculation.calculated_amount}, ${calculation.formula_used || null},
        ${JSON.stringify(calculation.variables_used || {})}
      )
      RETURNING *
    `
    return result.rows[0] as PayoutCalculation
  }

  // Bulk operations for ETL
  async bulkUpsertAttorneys(attorneys: Omit<Attorney, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    if (attorneys.length === 0) return

    const values = attorneys.map(a => 
      `('${a.clio_id}', '${a.firm_id}', '${a.name}', '${a.first_name}', '${a.last_name}', '${a.email}', ${a.hourly_rate || 'NULL'}, ${a.is_active}, '${a.synced_at.toISOString()}')`
    ).join(',')

    await this.client.query(`
      INSERT INTO attorneys (clio_id, firm_id, name, first_name, last_name, email, hourly_rate, is_active, synced_at)
      VALUES ${values}
      ON CONFLICT (clio_id, firm_id) 
      DO UPDATE SET
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        hourly_rate = EXCLUDED.hourly_rate,
        is_active = EXCLUDED.is_active,
        synced_at = EXCLUDED.synced_at,
        updated_at = CURRENT_TIMESTAMP
    `)
  }

  // Data cleanup
  async cleanupOldData(firmId: string, daysToKeep = 365): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    await this.client.sql`
      DELETE FROM payout_calculations 
      WHERE firm_id = ${firmId} AND created_at < ${cutoffDate}
    `

    await this.client.sql`
      DELETE FROM algorithm_runs 
      WHERE firm_id = ${firmId} AND created_at < ${cutoffDate}
    `
  }
}

export const db = new Database()