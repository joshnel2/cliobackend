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

  // Summary by attorney (totals)
  const attorneysWs = workbook.addWorksheet('Attorneys')
  attorneysWs.columns = [
    { header: 'Attorney', key: 'name', width: 30 },
    { header: 'Originator Amount', key: 'originator', width: 20 },
    { header: 'Working Amount', key: 'working', width: 20 },
    { header: 'Total Amount', key: 'total', width: 20 },
    { header: 'Matters Count', key: 'matters', width: 16 },
  ]

  const perAttorney = new Map<string | number, { name: string; originator: number; working: number; matters: Set<string | number> }>()
  for (const m of payload.matters) {
    for (const s of m.shares) {
      const current = perAttorney.get(s.id) || { name: s.name, originator: 0, working: 0, matters: new Set() }
      if (s.role === 'originator') current.originator += s.amount || 0
      else current.working += s.amount || 0
      current.matters.add(m.matterId)
      perAttorney.set(s.id, current)
    }
  }

  let grandTotal = 0
  for (const [, v] of perAttorney) {
    const total = (v.originator || 0) + (v.working || 0)
    grandTotal += total
    attorneysWs.addRow({
      name: v.name,
      originator: v.originator || 0,
      working: v.working || 0,
      total,
      matters: v.matters.size,
    })
  }
  attorneysWs.addRow({})
  attorneysWs.addRow({ name: 'Grand Total', total: grandTotal })

  // Per-attorney sheets: list matters and their amounts
  // Gather unique attorneys across all matters
  const attorneyIdToName = new Map<string | number, string>()
  for (const m of payload.matters) {
    for (const s of m.shares) {
      attorneyIdToName.set(s.id, s.name)
    }
  }

  for (const [attorneyId, attorneyName] of attorneyIdToName) {
    const ws = workbook.addWorksheet(sanitizeSheetName(attorneyName || String(attorneyId)))
    ws.columns = [
      { header: 'Matter', key: 'matter', width: 40 },
      { header: 'Role', key: 'role', width: 14 },
      { header: 'Amount', key: 'amount', width: 16 },
      { header: 'Matter Total', key: 'total', width: 16 },
      { header: 'Originator', key: 'originator', width: 28 },
    ]

    let subtotal = 0
    for (const m of payload.matters) {
      const share = m.shares.find(s => String(s.id) === String(attorneyId))
      if (!share) continue
      const origin = m.shares.find(s => s.role === 'originator')
      subtotal += share.amount || 0
      ws.addRow({
        matter: m.matterName,
        role: share.role,
        amount: share.amount || 0,
        total: m.totalCollected,
        originator: origin ? origin.name : '',
      })
    }

    ws.addRow({})
    ws.addRow({ matter: 'Subtotal', amount: subtotal })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}