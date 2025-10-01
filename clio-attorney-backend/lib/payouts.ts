import { listUsers, listBills, listMatters, listTimeEntries, listPayments } from './clio.js'

export interface PayoutConfig {
  originatingPercentage: number // Default: 15%
  workingPercentage: number     // Default: 30%
  referralPercentage: number    // Default: 10%
  selfOrigSelfBilledPercentage: number // Default: 50%
  selfOrigOthersBilledPercentage: number // Default: 15%
  nonOrigSelfBilledPercentage: number // Default: 30%
}

export interface AttorneyPayout {
  id: string | number
  name: string
  working: number
  originating: number
  referral: number
  totalPayout: number
  matters: MatterPayout[]
}

export interface MatterPayout {
  matterId: string | number
  matterName: string
  totalCollected: number
  originatorId?: string | number
  originatorName?: string
  originatorAmount: number
  workingAttorneys: WorkingAttorneyPayout[]
  selfOrigSelfBilled?: number
  selfOrigOthersBilled?: number
  nonOrigSelfBilled?: number
}

export interface WorkingAttorneyPayout {
  id: string | number
  name: string
  amount: number
  hoursWorked: number
  billableRate: number
}

const DEFAULT_CONFIG: PayoutConfig = {
  originatingPercentage: 15,
  workingPercentage: 30,
  referralPercentage: 10,
  selfOrigSelfBilledPercentage: 50,
  selfOrigOthersBilledPercentage: 15,
  nonOrigSelfBilledPercentage: 30,
}

export async function calculatePayouts(firmId: string, config: PayoutConfig = DEFAULT_CONFIG): Promise<{
  attorneys: AttorneyPayout[]
  matters: MatterPayout[]
  totals: {
    attorneys: number
    working: number
    originating: number
    referral: number
    totalPayout: number
  }
}> {
  // Fetch all necessary data from Clio
  const [users, bills, matters, timeEntries, payments] = await Promise.all([
    listUsers(firmId),
    fetchAllBills(firmId),
    fetchAllMatters(firmId),
    fetchAllTimeEntries(firmId),
    fetchAllPayments(firmId)
  ])

  // Create lookup maps
  const userMap = new Map(users.map(u => [u.id, u]))
  const matterMap = new Map(matters.map(m => [m.id, m]))
  
  // Calculate matter-level payouts
  const matterPayouts = await calculateMatterPayouts(
    bills, matters, timeEntries, payments, userMap, matterMap, config
  )

  // Aggregate attorney-level payouts
  const attorneyPayouts = aggregateAttorneyPayouts(matterPayouts, users)

  // Calculate totals
  const totals = {
    attorneys: attorneyPayouts.length,
    working: attorneyPayouts.reduce((sum, a) => sum + a.working, 0),
    originating: attorneyPayouts.reduce((sum, a) => sum + a.originating, 0),
    referral: attorneyPayouts.reduce((sum, a) => sum + a.referral, 0),
    totalPayout: attorneyPayouts.reduce((sum, a) => sum + a.totalPayout, 0),
  }

  return {
    attorneys: attorneyPayouts,
    matters: matterPayouts,
    totals
  }
}

async function fetchAllBills(firmId: string): Promise<any[]> {
  const allBills: any[] = []
  let page = 1
  const maxPages = 10 // Limit to prevent infinite loops

  while (page <= maxPages) {
    const bills = await listBills(firmId, { page, per_page: 200 })
    if (bills.length === 0) break
    
    allBills.push(...bills)
    if (bills.length < 200) break
    page++
  }

  return allBills
}

async function fetchAllMatters(firmId: string): Promise<any[]> {
  const allMatters: any[] = []
  let page = 1
  const maxPages = 10

  while (page <= maxPages) {
    const matters = await listMatters(firmId, { page, per_page: 200 })
    if (matters.length === 0) break
    
    allMatters.push(...matters)
    if (matters.length < 200) break
    page++
  }

  return allMatters
}

async function fetchAllTimeEntries(firmId: string): Promise<any[]> {
  const allTimeEntries: any[] = []
  let page = 1
  const maxPages = 10

  while (page <= maxPages) {
    const timeEntries = await listTimeEntries(firmId, { page, per_page: 200 })
    if (timeEntries.length === 0) break
    
    allTimeEntries.push(...timeEntries)
    if (timeEntries.length < 200) break
    page++
  }

  return allTimeEntries
}

async function fetchAllPayments(firmId: string): Promise<any[]> {
  const allPayments: any[] = []
  let page = 1
  const maxPages = 10

  while (page <= maxPages) {
    const payments = await listPayments(firmId, { page, per_page: 200 })
    if (payments.length === 0) break
    
    allPayments.push(...payments)
    if (payments.length < 200) break
    page++
  }

  return allPayments
}

async function calculateMatterPayouts(
  bills: any[],
  matters: any[],
  timeEntries: any[],
  payments: any[],
  userMap: Map<any, any>,
  matterMap: Map<any, any>,
  config: PayoutConfig
): Promise<MatterPayout[]> {
  const matterPayouts: MatterPayout[] = []

  for (const matter of matters) {
    const matterId = matter.id
    const matterName = matter.display_number || matter.description || `Matter ${matterId}`
    
    // Get originating attorney
    const originatorId = matter.originating_attorney?.id || matter.client?.user?.id
    const originator = originatorId ? userMap.get(originatorId) : null

    // Calculate total collected for this matter
    const matterPayments = payments.filter(p => p.matter?.id === matterId)
    const totalCollected = matterPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)

    // Get time entries for this matter
    const matterTimeEntries = timeEntries.filter(te => te.matter?.id === matterId)
    
    // Calculate working attorney payouts
    const workingAttorneyMap = new Map<any, { hours: number, amount: number }>()
    
    for (const timeEntry of matterTimeEntries) {
      const attorneyId = timeEntry.user?.id
      if (!attorneyId) continue

      const hours = parseFloat(timeEntry.quantity) || 0
      const rate = parseFloat(timeEntry.rate) || 0
      const amount = hours * rate

      const existing = workingAttorneyMap.get(attorneyId) || { hours: 0, amount: 0 }
      workingAttorneyMap.set(attorneyId, {
        hours: existing.hours + hours,
        amount: existing.amount + amount
      })
    }

    const workingAttorneys: WorkingAttorneyPayout[] = []
    for (const [attorneyId, data] of workingAttorneyMap) {
      const attorney = userMap.get(attorneyId)
      if (!attorney) continue

      workingAttorneys.push({
        id: attorneyId,
        name: attorney.name,
        amount: data.amount * (config.workingPercentage / 100),
        hoursWorked: data.hours,
        billableRate: data.hours > 0 ? data.amount / data.hours : 0
      })
    }

    // Calculate originator payout
    let originatorAmount = 0
    let selfOrigSelfBilled = 0
    let selfOrigOthersBilled = 0
    let nonOrigSelfBilled = 0

    if (originator && totalCollected > 0) {
      // Check if originator also worked on the matter
      const originatorWorked = workingAttorneyMap.has(originatorId)
      const originatorBilledAmount = originatorWorked ? workingAttorneyMap.get(originatorId)?.amount || 0 : 0
      const othersBilledAmount = Array.from(workingAttorneyMap.values())
        .filter((_, idx) => Array.from(workingAttorneyMap.keys())[idx] !== originatorId)
        .reduce((sum, data) => sum + data.amount, 0)

      if (originatorWorked) {
        // Self-originating + self-billed
        selfOrigSelfBilled = originatorBilledAmount * (config.selfOrigSelfBilledPercentage / 100)
        // Self-originating + others-billed
        selfOrigOthersBilled = othersBilledAmount * (config.selfOrigOthersBilledPercentage / 100)
      } else {
        // Non-originating + self-billed (for others who worked but didn't originate)
        nonOrigSelfBilled = originatorBilledAmount * (config.nonOrigSelfBilledPercentage / 100)
      }

      originatorAmount = selfOrigSelfBilled + selfOrigOthersBilled + nonOrigSelfBilled
    }

    matterPayouts.push({
      matterId,
      matterName,
      totalCollected,
      originatorId,
      originatorName: originator?.name || '',
      originatorAmount,
      workingAttorneys,
      selfOrigSelfBilled,
      selfOrigOthersBilled,
      nonOrigSelfBilled
    })
  }

  return matterPayouts
}

function aggregateAttorneyPayouts(matterPayouts: MatterPayout[], users: any[]): AttorneyPayout[] {
  const attorneyMap = new Map<any, AttorneyPayout>()

  // Initialize all attorneys
  for (const user of users) {
    attorneyMap.set(user.id, {
      id: user.id,
      name: user.name,
      working: 0,
      originating: 0,
      referral: 0,
      totalPayout: 0,
      matters: []
    })
  }

  // Aggregate payouts from matters
  for (const matter of matterPayouts) {
    // Add originating fees
    if (matter.originatorId && matter.originatorAmount > 0) {
      const originator = attorneyMap.get(matter.originatorId)
      if (originator) {
        originator.originating += matter.originatorAmount
        originator.matters.push(matter)
      }
    }

    // Add working fees
    for (const workingAttorney of matter.workingAttorneys) {
      const attorney = attorneyMap.get(workingAttorney.id)
      if (attorney) {
        attorney.working += workingAttorney.amount
        
        // Add matter to attorney's list if not already there
        if (!attorney.matters.find(m => m.matterId === matter.matterId)) {
          attorney.matters.push(matter)
        }
      }
    }
  }

  // Calculate total payouts and filter out attorneys with no payouts
  const result: AttorneyPayout[] = []
  for (const attorney of attorneyMap.values()) {
    attorney.totalPayout = attorney.working + attorney.originating + attorney.referral
    
    // Include all attorneys, even those with zero payouts for completeness
    result.push(attorney)
  }

  return result.sort((a, b) => b.totalPayout - a.totalPayout)
}