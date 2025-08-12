import type { VercelRequest, VercelResponse } from '@vercel/node'
import Papa from 'papaparse'
import { buildSplitWorkbook, type SplitPayload, type MatterSplitRow } from '../../lib/excel.js'

interface PaymentsRow {
  bill_number: string
  matter_name: string
  amount: number
  date: string
}

interface FeeRow {
  bill_number: string
  matter_name: string
  timekeeper: string
  originator: string
  billed_amount: number
}

function parseCsv<T>(csv: string): T[] {
  const { data } = Papa.parse(csv.trim(), { header: true, skipEmptyLines: true })
  return (data as any[]).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), typeof v === 'string' ? v.trim() : v]))) as T[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })

    const firmId = (req.query.firmId as string) || 'default'
    const month = (req.query.month as string) || ''
    const { paymentsCsv, feesCsv, originatorName } = req.body as { paymentsCsv: string; feesCsv: string; originatorName?: string }
    if (!paymentsCsv || !feesCsv) return res.status(400).json({ ok: false, error: 'Missing paymentsCsv or feesCsv' })

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
      const isOriginator = f.timekeeper && f.originator && f.timekeeper.toLowerCase().includes(f.originator.toLowerCase())
      const cur = byBillFees.get(key) || { matter: f.matter_name, selfBilled: 0, othersBilled: 0 }
      if (isOriginator) cur.selfBilled += Number(f.billed_amount) || 0
      else cur.othersBilled += Number(f.billed_amount) || 0
      byBillFees.set(key, cur)
    }

    // Build matters payload per originator filter (if provided)
    const matters: MatterSplitRow[] = []
    for (const [bill, pay] of byBill.entries()) {
      const fee = byBillFees.get(bill) || { matter: pay.matter, selfBilled: 0, othersBilled: 0 }

      const self50 = 0.50 * fee.selfBilled
      const others15 = 0.15 * fee.othersBilled
      const nonOrig30 = 0 // Not computable from CSV unless we include non-originated self-billed rows; set 0 here
      const originatorAmount = self50 + others15 + nonOrig30

      matters.push({
        matterId: bill,
        matterName: fee.matter,
        totalCollected: pay.collected,
        shares: [
          { id: 'originator', name: originatorName || 'Originator', role: 'originator', amount: originatorAmount },
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
      firmId,
      matters,
    }

    const xlsx = await buildSplitWorkbook(payload)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="reports-splits-${month || 'period'}.xlsx"`)
    res.status(200).send(xlsx)
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'reports export failed' })
  }
}