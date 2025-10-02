import { db, type Attorney, type Matter, type TimeEntry, type Payment, type Bill } from './database.js'
import { 
  listUsers, 
  listMatters, 
  listTimeEntries, 
  listPayments, 
  listBills 
} from './clio.js'
import { setJson, getJson } from './kv.js'

export interface ETLStatus {
  firmId: string
  lastSync: Date
  status: 'idle' | 'running' | 'completed' | 'failed'
  recordsProcessed: {
    attorneys: number
    matters: number
    timeEntries: number
    payments: number
    bills: number
  }
  errors: string[]
  startTime: Date
  endTime?: Date
  duration?: number
}

export class ETLPipeline {
  private firmId: string
  private status: ETLStatus

  constructor(firmId: string) {
    this.firmId = firmId
    this.status = {
      firmId,
      lastSync: new Date(),
      status: 'idle',
      recordsProcessed: {
        attorneys: 0,
        matters: 0,
        timeEntries: 0,
        payments: 0,
        bills: 0
      },
      errors: [],
      startTime: new Date()
    }
  }

  async runFullSync(): Promise<ETLStatus> {
    console.log(`Starting full ETL sync for firm: ${this.firmId}`)
    
    this.status.status = 'running'
    this.status.startTime = new Date()
    this.status.errors = []
    
    try {
      await db.connect()

      // Step 1: Sync Attorneys (must be first due to foreign key relationships)
      console.log('Syncing attorneys...')
      await this.syncAttorneys()

      // Step 2: Sync Matters
      console.log('Syncing matters...')
      await this.syncMatters()

      // Step 3: Sync Bills
      console.log('Syncing bills...')
      await this.syncBills()

      // Step 4: Sync Time Entries
      console.log('Syncing time entries...')
      await this.syncTimeEntries()

      // Step 5: Sync Payments
      console.log('Syncing payments...')
      await this.syncPayments()

      // Step 6: Update matter totals
      console.log('Updating matter totals...')
      await this.updateMatterTotals()

      this.status.status = 'completed'
      this.status.endTime = new Date()
      this.status.duration = this.status.endTime.getTime() - this.status.startTime.getTime()

      // Cache the status
      await this.saveStatus()

      console.log(`ETL sync completed for firm: ${this.firmId}`)
      console.log(`Duration: ${this.status.duration}ms`)
      console.log(`Records processed:`, this.status.recordsProcessed)

    } catch (error: any) {
      this.status.status = 'failed'
      this.status.errors.push(error.message)
      this.status.endTime = new Date()
      this.status.duration = this.status.endTime.getTime() - this.status.startTime.getTime()
      
      await this.saveStatus()
      
      console.error(`ETL sync failed for firm: ${this.firmId}`, error)
      throw error
    } finally {
      await db.disconnect()
    }

    return this.status
  }

  async runIncrementalSync(since?: Date): Promise<ETLStatus> {
    console.log(`Starting incremental ETL sync for firm: ${this.firmId}`)
    
    const lastSync = since || await this.getLastSyncTime()
    
    this.status.status = 'running'
    this.status.startTime = new Date()
    this.status.errors = []
    
    try {
      await db.connect()

      // Sync only updated records since last sync
      const updatedSince = lastSync.toISOString()

      console.log('Syncing updated attorneys...')
      await this.syncAttorneys(updatedSince)

      console.log('Syncing updated matters...')
      await this.syncMatters(updatedSince)

      console.log('Syncing updated bills...')
      await this.syncBills(updatedSince)

      console.log('Syncing updated time entries...')
      await this.syncTimeEntries(updatedSince)

      console.log('Syncing updated payments...')
      await this.syncPayments(updatedSince)

      await this.updateMatterTotals()

      this.status.status = 'completed'
      this.status.endTime = new Date()
      this.status.duration = this.status.endTime.getTime() - this.status.startTime.getTime()

      await this.saveStatus()

      console.log(`Incremental ETL sync completed for firm: ${this.firmId}`)

    } catch (error: any) {
      this.status.status = 'failed'
      this.status.errors.push(error.message)
      this.status.endTime = new Date()
      this.status.duration = this.status.endTime.getTime() - this.status.startTime.getTime()
      
      await this.saveStatus()
      throw error
    } finally {
      await db.disconnect()
    }

    return this.status
  }

  private async syncAttorneys(updatedSince?: string): Promise<void> {
    try {
      const clioUsers = await listUsers(this.firmId)
      const attorneys: Omit<Attorney, 'id' | 'created_at' | 'updated_at'>[] = []

      for (const user of clioUsers) {
        attorneys.push({
          clio_id: String(user.id),
          firm_id: this.firmId,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          hourly_rate: user.hourly_rate ? parseFloat(user.hourly_rate) : undefined,
          is_active: true,
          synced_at: new Date()
        })
      }

      if (attorneys.length > 0) {
        await db.bulkUpsertAttorneys(attorneys)
        this.status.recordsProcessed.attorneys = attorneys.length
      }

    } catch (error: any) {
      this.status.errors.push(`Attorney sync error: ${error.message}`)
      throw error
    }
  }

  private async syncMatters(updatedSince?: string): Promise<void> {
    try {
      const options = updatedSince ? { updated_since: updatedSince } : {}
      const clioMatters = await this.fetchAllMatters(options)
      
      // Get attorney mapping for foreign keys
      const attorneys = await db.getAttorneys(this.firmId)
      const attorneyMap = new Map(attorneys.map(a => [a.clio_id, a.id]))

      for (const matter of clioMatters) {
        const matterData: Omit<Matter, 'id' | 'created_at' | 'updated_at'> = {
          clio_id: String(matter.id),
          firm_id: this.firmId,
          display_number: matter.display_number || String(matter.id),
          description: matter.description || '',
          status: matter.status || 'unknown',
          client_name: matter.client?.name || matter.client?.display_name,
          originating_attorney_id: matter.originating_attorney?.id ? 
            attorneyMap.get(String(matter.originating_attorney.id)) : undefined,
          responsible_attorney_id: matter.responsible_attorney?.id ? 
            attorneyMap.get(String(matter.responsible_attorney.id)) : undefined,
          total_collected: 0, // Will be calculated from payments
          total_billed: 0,    // Will be calculated from time entries
          is_active: matter.status !== 'closed',
          synced_at: new Date()
        }

        await db.upsertMatter(matterData)
        this.status.recordsProcessed.matters++
      }

    } catch (error: any) {
      this.status.errors.push(`Matter sync error: ${error.message}`)
      throw error
    }
  }

  private async syncBills(updatedSince?: string): Promise<void> {
    try {
      const options = updatedSince ? { updated_since: updatedSince } : {}
      const clioBills = await this.fetchAllBills(options)
      
      // Get matter mapping for foreign keys
      const matters = await db.getMatters(this.firmId)
      const matterMap = new Map(matters.map(m => [m.clio_id, m.id]))

      for (const bill of clioBills) {
        const billData: Omit<Bill, 'id' | 'created_at' | 'updated_at'> = {
          clio_id: String(bill.id),
          firm_id: this.firmId,
          matter_id: bill.matter?.id ? matterMap.get(String(bill.matter.id)) || '' : '',
          number: bill.number || String(bill.id),
          total: parseFloat(bill.total) || 0,
          status: bill.status || 'unknown',
          issued_at: bill.issued_at ? new Date(bill.issued_at) : undefined,
          due_at: bill.due_at ? new Date(bill.due_at) : undefined,
          paid_at: bill.paid_at ? new Date(bill.paid_at) : undefined,
          synced_at: new Date()
        }

        await db.upsertBill(billData)
        this.status.recordsProcessed.bills++
      }

    } catch (error: any) {
      this.status.errors.push(`Bill sync error: ${error.message}`)
      throw error
    }
  }

  private async syncTimeEntries(updatedSince?: string): Promise<void> {
    try {
      const options = updatedSince ? { updated_since: updatedSince } : {}
      const clioTimeEntries = await this.fetchAllTimeEntries(options)
      
      // Get mappings for foreign keys
      const attorneys = await db.getAttorneys(this.firmId)
      const matters = await db.getMatters(this.firmId)
      const attorneyMap = new Map(attorneys.map(a => [a.clio_id, a.id]))
      const matterMap = new Map(matters.map(m => [m.clio_id, m.id]))

      for (const entry of clioTimeEntries) {
        const attorneyId = entry.user?.id ? attorneyMap.get(String(entry.user.id)) : undefined
        const matterId = entry.matter?.id ? matterMap.get(String(entry.matter.id)) : undefined

        if (!attorneyId || !matterId) {
          console.warn(`Skipping time entry ${entry.id}: missing attorney or matter mapping`)
          continue
        }

        const entryData: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'> = {
          clio_id: String(entry.id),
          firm_id: this.firmId,
          matter_id: matterId,
          attorney_id: attorneyId,
          date: new Date(entry.date),
          quantity: parseFloat(entry.quantity) || 0,
          rate: parseFloat(entry.rate) || 0,
          total: (parseFloat(entry.quantity) || 0) * (parseFloat(entry.rate) || 0),
          billable: entry.billable !== false,
          description: entry.description || '',
          activity_description: entry.activity?.name || entry.activity_description || '',
          synced_at: new Date()
        }

        await db.upsertTimeEntry(entryData)
        this.status.recordsProcessed.timeEntries++
      }

    } catch (error: any) {
      this.status.errors.push(`Time entry sync error: ${error.message}`)
      throw error
    }
  }

  private async syncPayments(updatedSince?: string): Promise<void> {
    try {
      const options = updatedSince ? { updated_since: updatedSince } : {}
      const clioPayments = await this.fetchAllPayments(options)
      
      // Get matter mapping for foreign keys
      const matters = await db.getMatters(this.firmId)
      const matterMap = new Map(matters.map(m => [m.clio_id, m.id]))

      for (const payment of clioPayments) {
        const matterId = payment.matter?.id ? matterMap.get(String(payment.matter.id)) : undefined

        if (!matterId) {
          console.warn(`Skipping payment ${payment.id}: missing matter mapping`)
          continue
        }

        const paymentData: Omit<Payment, 'id' | 'created_at' | 'updated_at'> = {
          clio_id: String(payment.id),
          firm_id: this.firmId,
          matter_id: matterId,
          bill_id: undefined, // TODO: Map bill if available
          amount: parseFloat(payment.amount) || 0,
          date: new Date(payment.date || payment.created_at),
          method: payment.payment_method || payment.method || 'unknown',
          status: payment.status || 'completed',
          reference: payment.reference || '',
          synced_at: new Date()
        }

        await db.upsertPayment(paymentData)
        this.status.recordsProcessed.payments++
      }

    } catch (error: any) {
      this.status.errors.push(`Payment sync error: ${error.message}`)
      throw error
    }
  }

  private async updateMatterTotals(): Promise<void> {
    try {
      // Update total_collected from payments
      await db.client.sql`
        UPDATE matters 
        SET total_collected = COALESCE(payment_totals.total, 0)
        FROM (
          SELECT matter_id, SUM(amount) as total
          FROM payments 
          WHERE firm_id = ${this.firmId}
          GROUP BY matter_id
        ) payment_totals
        WHERE matters.id = payment_totals.matter_id
          AND matters.firm_id = ${this.firmId}
      `

      // Update total_billed from time entries
      await db.client.sql`
        UPDATE matters 
        SET total_billed = COALESCE(time_totals.total, 0)
        FROM (
          SELECT matter_id, SUM(total) as total
          FROM time_entries 
          WHERE firm_id = ${this.firmId} AND billable = true
          GROUP BY matter_id
        ) time_totals
        WHERE matters.id = time_totals.matter_id
          AND matters.firm_id = ${this.firmId}
      `

    } catch (error: any) {
      this.status.errors.push(`Matter totals update error: ${error.message}`)
      throw error
    }
  }

  // Helper methods to fetch all pages of data
  private async fetchAllMatters(options: any = {}): Promise<any[]> {
    const allMatters: any[] = []
    let page = 1
    const maxPages = 50 // Safety limit

    while (page <= maxPages) {
      const matters = await listMatters(this.firmId, { ...options, page, per_page: 200 })
      if (matters.length === 0) break
      
      allMatters.push(...matters)
      if (matters.length < 200) break
      page++
    }

    return allMatters
  }

  private async fetchAllBills(options: any = {}): Promise<any[]> {
    const allBills: any[] = []
    let page = 1
    const maxPages = 50

    while (page <= maxPages) {
      const bills = await listBills(this.firmId, { ...options, page, per_page: 200 })
      if (bills.length === 0) break
      
      allBills.push(...bills)
      if (bills.length < 200) break
      page++
    }

    return allBills
  }

  private async fetchAllTimeEntries(options: any = {}): Promise<any[]> {
    const allEntries: any[] = []
    let page = 1
    const maxPages = 50

    while (page <= maxPages) {
      const entries = await listTimeEntries(this.firmId, { ...options, page, per_page: 200 })
      if (entries.length === 0) break
      
      allEntries.push(...entries)
      if (entries.length < 200) break
      page++
    }

    return allEntries
  }

  private async fetchAllPayments(options: any = {}): Promise<any[]> {
    const allPayments: any[] = []
    let page = 1
    const maxPages = 50

    while (page <= maxPages) {
      const payments = await listPayments(this.firmId, { ...options, page, per_page: 200 })
      if (payments.length === 0) break
      
      allPayments.push(...payments)
      if (payments.length < 200) break
      page++
    }

    return allPayments
  }

  private async getLastSyncTime(): Promise<Date> {
    const status = await this.getStatus()
    return status?.lastSync || new Date(Date.now() - 24 * 60 * 60 * 1000) // Default to 24 hours ago
  }

  private async saveStatus(): Promise<void> {
    const statusKey = `clio:etl:status:${this.firmId}`
    await setJson(statusKey, this.status, 3600) // Cache for 1 hour
  }

  async getStatus(): Promise<ETLStatus | null> {
    const statusKey = `clio:etl:status:${this.firmId}`
    return await getJson<ETLStatus>(statusKey)
  }

  static async getETLStatus(firmId: string): Promise<ETLStatus | null> {
    const statusKey = `clio:etl:status:${firmId}`
    return await getJson<ETLStatus>(statusKey)
  }

  static async runETLForFirm(firmId: string, incremental = true): Promise<ETLStatus> {
    const etl = new ETLPipeline(firmId)
    
    if (incremental) {
      return await etl.runIncrementalSync()
    } else {
      return await etl.runFullSync()
    }
  }
}