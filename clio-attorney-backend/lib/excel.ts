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

  // One sheet per originating attorney (placeholder = each attorney)
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