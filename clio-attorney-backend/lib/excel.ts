import ExcelJS from 'exceljs'

export interface AttorneyMetricRow {
  id: string | number
  name: string
  working: number
  originating: number
  referral: number
}

export interface MetricsPayload {
  generatedAt: string
  firmId: string
  totals: {
    attorneys: number
    working: number
    originating: number
    referral: number
  }
  byAttorney: AttorneyMetricRow[]
}

// New types for matter-level split export
export type AttorneyRole = 'originator' | 'working'

export interface AttorneyShareRow {
  id: string | number
  name: string
  role: AttorneyRole
  amount: number
}

export interface MatterSplitRow {
  matterId: string | number
  matterName: string
  totalCollected: number
  shares: AttorneyShareRow[]
}

export interface SplitPayload {
  generatedAt: string
  firmId: string
  matters: MatterSplitRow[]
}

function sanitizeSheetName(name: string): string {
  const illegal = /[\\\/\?\*\[\]\:]/g
  let out = name.replace(illegal, ' ')
  if (out.length === 0) out = 'Sheet'
  if (out.length > 31) out = out.slice(0, 31)
  return out
}

export async function buildWorkbook(metrics: MetricsPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'clio-attorney-backend'
  workbook.created = new Date(metrics.generatedAt)

  // Summary sheet
  const summary = workbook.addWorksheet('Summary')
  summary.columns = [
    { header: 'Attorney', key: 'name', width: 30 },
    { header: 'Working', key: 'working', width: 12 },
    { header: 'Originating', key: 'originating', width: 14 },
    { header: 'Referral', key: 'referral', width: 12 },
  ]

  for (const row of metrics.byAttorney) {
    summary.addRow({
      name: row.name,
      working: row.working,
      originating: row.originating,
      referral: row.referral,
    })
  }

  summary.addRow({})
  summary.addRow({ name: 'Totals', working: metrics.totals.working, originating: metrics.totals.originating, referral: metrics.totals.referral })

  // One sheet per attorney (legacy simple summary)
  for (const row of metrics.byAttorney) {
    const ws = workbook.addWorksheet(sanitizeSheetName(row.name || String(row.id)))
    ws.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ]
    ws.addRow({ metric: 'Working', value: row.working })
    ws.addRow({ metric: 'Originating', value: row.originating })
    ws.addRow({ metric: 'Referral', value: row.referral })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildSingleAttorneyWorkbook(attorney: AttorneyMetricRow): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(sanitizeSheetName(attorney.name || String(attorney.id)))
  ws.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ]
  ws.addRow({ metric: 'Working', value: attorney.working })
  ws.addRow({ metric: 'Originating', value: attorney.originating })
  ws.addRow({ metric: 'Referral', value: attorney.referral })
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// New: build workbook with matter-level splits
export async function buildSplitWorkbook(payload: SplitPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'clio-attorney-backend'
  workbook.created = new Date(payload.generatedAt)

  // Summary by matter
  const mattersWs = workbook.addWorksheet('Matters')
  mattersWs.columns = [
    { header: 'Matter', key: 'matter', width: 40 },
    { header: 'Total Collected', key: 'total', width: 18 },
    { header: 'Originator', key: 'originator', width: 28 },
    { header: 'Originator Amount', key: 'originatorAmount', width: 20 },
    { header: 'Other Attorneys Total', key: 'othersTotal', width: 20 },
    { header: 'Other Attorneys (breakdown)', key: 'othersBreakdown', width: 50 },
  ]

  for (const matter of payload.matters) {
    const origin = matter.shares.find(s => s.role === 'originator')
    const others = matter.shares.filter(s => s.role !== 'originator')
    const othersTotal = others.reduce((acc, s) => acc + (s.amount || 0), 0)
    const othersBreakdown = others
      .filter(s => (s.amount || 0) !== 0)
      .map(s => `${s.name}: ${s.amount}`)
      .join('; ')

    mattersWs.addRow({
      matter: matter.matterName,
      total: matter.totalCollected,
      originator: origin ? origin.name : '',
      originatorAmount: origin ? origin.amount : 0,
      othersTotal,
      othersBreakdown,
    })
  }

  // Per-originator sheets: list that originator's matters and include working-attorney totals
  // Group matters by originator id
  const originatorIdToName = new Map<string | number, string>()
  const originatorToMatters = new Map<string | number, MatterSplitRow[]>()
  for (const m of payload.matters) {
    const origin = m.shares.find(s => s.role === 'originator')
    if (!origin) continue
    originatorIdToName.set(origin.id, origin.name)
    const list = originatorToMatters.get(origin.id) || []
    list.push(m)
    originatorToMatters.set(origin.id, list)
  }

  for (const [originatorId, originatorName] of originatorIdToName) {
    const ws = workbook.addWorksheet(sanitizeSheetName(originatorName || String(originatorId)))

    // Matter-level rows
    ws.columns = [
      { header: 'Matter', key: 'matter', width: 40 },
      { header: 'Originator Amount', key: 'originatorAmount', width: 20 },
      { header: 'Other Attorneys Total', key: 'othersTotal', width: 20 },
      { header: 'Other Attorneys (breakdown)', key: 'othersBreakdown', width: 50 },
      { header: 'Matter Total', key: 'total', width: 18 },
    ]

    let originatorSubtotal = 0
    let othersSubtotal = 0

    const matters = originatorToMatters.get(originatorId) || []
    for (const m of matters) {
      const origin = m.shares.find(s => s.role === 'originator')
      const others = m.shares.filter(s => s.role !== 'originator')
      const originAmount = origin ? origin.amount || 0 : 0
      const othersTotal = others.reduce((acc, s) => acc + (s.amount || 0), 0)
      const othersBreakdown = others
        .filter(s => (s.amount || 0) !== 0)
        .map(s => `${s.name}: ${s.amount}`)
        .join('; ')

      originatorSubtotal += originAmount
      othersSubtotal += othersTotal

      ws.addRow({
        matter: m.matterName,
        originatorAmount: originAmount,
        othersTotal,
        othersBreakdown,
        total: m.totalCollected,
      })
    }

    ws.addRow({})
    ws.addRow({ matter: 'Originator Total', originatorAmount: originatorSubtotal })
    ws.addRow({ matter: 'Other Attorneys Total', othersTotal: othersSubtotal })

    // Working-attorney totals across this originator's matters
    ws.addRow({})
    ws.addRow({ matter: 'Working Attorneys Totals' })

    const workingTotals = new Map<string, number>()
    for (const m of matters) {
      for (const s of m.shares) {
        if (s.role !== 'originator' && (s.amount || 0) !== 0) {
          const key = s.name || String(s.id)
          workingTotals.set(key, (workingTotals.get(key) || 0) + (s.amount || 0))
        }
      }
    }

    // Add header row for working totals
    ws.addRow({ matter: 'Attorney', originatorAmount: 'Amount' })
    for (const [attorneyName, amt] of workingTotals) {
      ws.addRow({ matter: attorneyName, originatorAmount: amt })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}