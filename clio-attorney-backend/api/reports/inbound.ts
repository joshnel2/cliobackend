import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import Busboy from 'busboy'
import Papa from 'papaparse'
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

  const signingKey = process.env.MAILGUN_SIGNING_KEY || ''
  if (!signingKey) return res.status(500).json({ ok: false, error: 'Missing MAILGUN_SIGNING_KEY' })

  try {
    const paymentsChunks: Buffer[] = []
    const feesChunks: Buffer[] = []
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
          if (lower.includes('payment')) paymentsChunks.push(Buffer.concat(chunks))
          else if (lower.includes('fee') || lower.includes('time')) feesChunks.push(Buffer.concat(chunks))
        })
      })
      busboy.on('error', reject)
      busboy.on('finish', resolve)
      req.pipe(busboy)
    })

    if (!verifyMailgunSignature(signingKey, mailgunTimestamp, mailgunToken, mailgunSignature)) {
      return res.status(403).json({ ok: false, error: 'invalid signature' })
    }

    if (paymentsChunks.length === 0 || feesChunks.length === 0) {
      return res.status(400).json({ ok: false, error: 'missing CSV attachments (payments/fees)' })
    }

    // Parse CSVs
    const paymentsCsv = paymentsChunks[0].toString('utf-8')
    const feesCsv = feesChunks[0].toString('utf-8')

    type PaymentsRow = { bill_number: string; matter_name: string; amount: string; date: string }
    type FeeRow = { bill_number: string; matter_name: string; timekeeper: string; originator?: string; billed_amount: string }

    const payments = parseCsv<PaymentsRow>(paymentsCsv)
    const fees = parseCsv<FeeRow>(feesCsv)

    // Aggregate collected per bill/matter
    const byBill = new Map<string, { matter: string; collected: number }>()
    for (const p of payments) {
      const key = p.bill_number
      const cur = byBill.get(key) || { matter: p.matter_name, collected: 0 }
      cur.collected += Number(p.amount) || 0
      byBill.set(key, cur)
    }

    // Aggregate billed per bill by originator vs others
    const byBillFees = new Map<string, { matter: string; selfBilled: number; othersBilled: number }>()
    for (const f of fees) {
      const key = f.bill_number
      const isOriginator = f.timekeeper && f.originator && f.timekeeper.toLowerCase().includes((f.originator || '').toLowerCase())
      const cur = byBillFees.get(key) || { matter: f.matter_name, selfBilled: 0, othersBilled: 0 }
      if (isOriginator) cur.selfBilled += Number(f.billed_amount) || 0
      else cur.othersBilled += Number(f.billed_amount) || 0
      byBillFees.set(key, cur)
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
        matterName: fee.matter,
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

    // Store latest workbook in KV for easy download
    await kv.set('reports:latest:xlsx', xlsx)
    await kv.set('reports:latest:ts', Date.now())

    res.status(200).json({ ok: true, ingested: true, matters: matters.length })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'inbound failed' })
  }
}