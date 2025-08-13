import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import Busboy from 'busboy'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import { buildSplitWorkbook, type SplitPayload, type MatterSplitRow } from '../../lib/excel.js'
import { kv } from '@vercel/kv'

function verifyMailgunSignature(apiKey: string, timestamp: string, token: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', apiKey).update(timestamp + token).digest('hex')
  return hmac === signature
}

function parseCsv<T>(csv: string): T[] {
  const { data } = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true })
  return (data as any[]).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), typeof v === 'string' ? v.trim() : v]))) as T[]
}

async function parseXlsx(buffer: Buffer): Promise<Record<string, any>[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  // Build headers from first row
  const headerRow = ws.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, col) => {
    headers[col - 1] = String(cell.value ?? '').trim()
  })
  const rows: Record<string, any>[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    if (row.hasValues) {
      const obj: Record<string, any> = {}
      row.eachCell((cell, col) => {
        const key = (headers[col - 1] || `col${col}`).trim()
        obj[key] = typeof cell.value === 'object' && cell.value && 'text' in (cell.value as any)
          ? (cell.value as any).text
          : cell.value
      })
      rows.push(obj)
    }
  }
  return rows
}

function normalizeHeaders<T extends Record<string, any>>(rows: T[]): T[] {
  return rows.map(r => {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(r)) {
      const norm = String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      out[norm] = typeof v === 'string' ? v.trim() : v
    }
    return out as T
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  const signingKey = process.env.MAILGUN_SIGNING_KEY || ''
  if (!signingKey) return res.status(500).json({ ok: false, error: 'Missing MAILGUN_SIGNING_KEY' })

  try {
    const paymentsBuffers: { name: string; buf: Buffer }[] = []
    const feesBuffers: { name: string; buf: Buffer }[] = []
    let mailgunTimestamp = ''
    let mailgunToken = ''
    let mailgunSignature = ''

    const busboy = Busboy({ headers: req.headers as any })

    await new Promise<void>((resolve, reject) => {
      busboy.on('field', (name, value) => {
        if (name === 'timestamp') mailgunTimestamp = value
        if (name === 'token') mailgunToken = value
        if (name === 'signature') mailgunSignature = value
      })
      busboy.on('file', (name, file, info) => {
        const filename = info.filename || ''
        const lower = filename.toLowerCase()
        const chunks: Buffer[] = []
        file.on('data', d => chunks.push(d))
        file.on('end', () => {
          const buf = Buffer.concat(chunks)
          if (lower.includes('payment')) paymentsBuffers.push({ name: filename, buf })
          else if (lower.includes('fee') || lower.includes('time')) feesBuffers.push({ name: filename, buf })
        })
      })
      busboy.on('error', reject)
      busboy.on('finish', resolve)
      req.pipe(busboy)
    })

    if (!verifyMailgunSignature(signingKey, mailgunTimestamp, mailgunToken, mailgunSignature)) {
      return res.status(403).json({ ok: false, error: 'invalid signature' })
    }

    if (paymentsBuffers.length === 0 || feesBuffers.length === 0) {
      return res.status(400).json({ ok: false, error: 'missing CSV/XLSX attachments (payments/fees)' })
    }

    // Parse attachments: support CSV and XLSX
    let paymentsRows: any[] = []
    let feesRows: any[] = []

    const parseAttachment = async (att: { name: string; buf: Buffer }): Promise<any[]> => {
      if (att.name.toLowerCase().endsWith('.xlsx')) {
        return normalizeHeaders(await parseXlsx(att.buf))
      }
      // default: CSV
      return normalizeHeaders(parseCsv(att.buf.toString('utf-8')))
    }

    paymentsRows = await parseAttachment(paymentsBuffers[0])
    feesRows = await parseAttachment(feesBuffers[0])

    // Map headers to our expected fields flexibly
    const get = (obj: any, keys: string[]): any => {
      for (const k of keys) if (k in obj) return obj[k]
      return undefined
    }

    // Aggregate collected per bill/matter
    const byBill = new Map<string, { matter: string; collected: number }>()
    for (const p of paymentsRows) {
      const billNum = String(get(p, ['bill_number', 'invoice_number', 'invoice_no', 'bill']))
      const matter = String(get(p, ['matter_name', 'matter', 'matter_number', 'matter_display_number']))
      const amount = Number(get(p, ['amount', 'payment_amount', 'paid_amount'])) || 0
      if (!billNum) continue
      const cur = byBill.get(billNum) || { matter, collected: 0 }
      cur.collected += amount
      if (!cur.matter && matter) cur.matter = matter
      byBill.set(billNum, cur)
    }

    // Aggregate billed per bill by originator vs others
    const byBillFees = new Map<string, { matter: string; selfBilled: number; othersBilled: number }>()
    for (const f of feesRows) {
      const billNum = String(get(f, ['bill_number', 'invoice_number', 'invoice_no', 'bill']))
      const matter = String(get(f, ['matter_name', 'matter', 'matter_number', 'matter_display_number']))
      const timekeeper = String(get(f, ['timekeeper', 'user', 'attorney']))
      const originator = String(get(f, ['originator', 'originating_attorney']))
      const billed = Number(get(f, ['billed_amount', 'amount', 'fee_amount'])) || 0
      if (!billNum) continue
      const isOriginator = timekeeper && originator && timekeeper.toLowerCase().includes(originator.toLowerCase())
      const cur = byBillFees.get(billNum) || { matter, selfBilled: 0, othersBilled: 0 }
      if (isOriginator) cur.selfBilled += billed
      else cur.othersBilled += billed
      if (!cur.matter && matter) cur.matter = matter
      byBillFees.set(billNum, cur)
    }

    const matters: MatterSplitRow[] = []
    for (const [bill, pay] of byBill.entries()) {
      const fee = byBillFees.get(bill) || { matter: pay.matter, selfBilled: 0, othersBilled: 0 }
      const self50 = 0.50 * fee.selfBilled
      const others15 = 0.15 * fee.othersBilled
      const nonOrig30 = 0
      const originatorAmount = self50 + others15 + nonOrig30
      matters.push({
        matterId: bill,
        matterName: fee.matter || pay.matter || bill,
        totalCollected: pay.collected,
        shares: [
          { id: 'originator', name: 'Originator', role: 'originator', amount: originatorAmount },
          { id: 'working', name: 'Working Attorneys', role: 'working', amount: Math.max(0, pay.collected - originatorAmount) },
        ],
        selfOrigSelfBilled: self50,
        selfOrigOthersBilled: others15,
        nonOrigSelfBilled: nonOrig30,
        originatorComputedAmount: originatorAmount,
      })
    }

    const payload: SplitPayload = {
      generatedAt: new Date().toISOString(),
      firmId: 'default',
      matters,
    }

    const xlsx = await buildSplitWorkbook(payload)
    await kv.set('reports:latest:xlsx', xlsx)
    await kv.set('reports:latest:ts', Date.now())

    res.status(200).json({ ok: true, ingested: true, matters: matters.length })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'inbound failed' })
  }
}