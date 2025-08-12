import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listUsers } from '../../lib/clio.js'
import { buildSplitWorkbook, type SplitPayload, type MatterSplitRow } from '../../lib/excel.js'

interface SplitRules {
  selfOriginatedWorkingPct: number // 0.50
  selfOriginatedOthersWorkingPct: number // 0.15
  nonOriginatedWorkingPct: number // 0.30
}

function parseMonth(monthParam?: string): { start: string; end: string } {
  // monthParam in format YYYY-MM
  if (!monthParam) {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth() // 0-11
    const start = new Date(Date.UTC(y, m, 1))
    const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999))
    return { start: start.toISOString(), end: end.toISOString() }
  }
  const [yStr, mStr] = monthParam.split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10) - 1
  const start = new Date(Date.UTC(y, m, 1))
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const originatorName = (req.query.originator as string) || ''
    const month = req.query.month as string // e.g., "2024-07"

    // Split rules per user's request
    const rules: SplitRules = {
      selfOriginatedWorkingPct: 0.50,
      selfOriginatedOthersWorkingPct: 0.15,
      nonOriginatedWorkingPct: 0.30,
    }

    if (!originatorName) return res.status(400).json({ error: 'Missing originator name (?originator=First%20Last)' })

    // Resolve originator and another sample working attorney from users
    const users = await listUsers(firmId)
    const normalized = (s: string) => s.trim().toLowerCase()
    const originator = users.find(u => normalized(`${u.first_name ?? ''} ${u.last_name ?? ''}`) === normalized(originatorName))
    if (!originator) return res.status(404).json({ error: `Originator not found: ${originatorName}` })
    const other = users.find(u => String(u.id) !== String(originator.id)) || originator

    // Month window (currently not used in placeholder; will be used once real data wiring is added)
    const window = parseMonth(month)

    // Placeholder matters for demonstration; replace with real Clio fetch + allocation
    // Matter 1: Originated by originator; assume collected = 12000
    //   - Originator billed 7000 (self portion), others billed 5000
    //   Originator gets: 50% of 7000 + 15% of 5000 = 3500 + 750 = 4250
    //   Others get remainder of their own portions (example distribution)
    const matter1: MatterSplitRow = {
      matterId: 'M-1001',
      matterName: 'Example Matter 1',
      totalCollected: 12000,
      shares: [
        { id: originator.id, name: `${originator.first_name} ${originator.last_name}`.trim(), role: 'originator', amount: 0 },
        { id: other.id, name: `${other.first_name} ${other.last_name}`.trim(), role: 'working', amount: 0 },
      ],
    }
    const matter1SelfPortion = 7000
    const matter1OthersPortion = 5000
    const matter1OriginatorShare = rules.selfOriginatedWorkingPct * matter1SelfPortion + rules.selfOriginatedOthersWorkingPct * matter1OthersPortion
    const matter1OtherShare = matter1OthersPortion - (rules.selfOriginatedOthersWorkingPct * matter1OthersPortion) // illustrative remainder
    matter1.shares[0].amount = Math.round(matter1OriginatorShare * 100) / 100
    matter1.shares[1].amount = Math.round(matter1OtherShare * 100) / 100

    // Matter 2: Originated by originator; collected = 8000; self billed 2000, others billed 6000
    const matter2: MatterSplitRow = {
      matterId: 'M-1002',
      matterName: 'Example Matter 2',
      totalCollected: 8000,
      shares: [
        { id: originator.id, name: `${originator.first_name} ${originator.last_name}`.trim(), role: 'originator', amount: 0 },
        { id: other.id, name: `${other.first_name} ${other.last_name}`.trim(), role: 'working', amount: 0 },
      ],
    }
    const matter2SelfPortion = 2000
    const matter2OthersPortion = 6000
    const matter2OriginatorShare = rules.selfOriginatedWorkingPct * matter2SelfPortion + rules.selfOriginatedOthersWorkingPct * matter2OthersPortion
    const matter2OtherShare = matter2OthersPortion - (rules.selfOriginatedOthersWorkingPct * matter2OthersPortion)
    matter2.shares[0].amount = Math.round(matter2OriginatorShare * 100) / 100
    matter2.shares[1].amount = Math.round(matter2OtherShare * 100) / 100

    // Matter 3: Not originated by originator; collected = 9000; originator worked portion = 3000
    const matter3: MatterSplitRow = {
      matterId: 'M-1003',
      matterName: 'Non-Originated Worked Matter',
      totalCollected: 9000,
      shares: [
        { id: other.id, name: `${other.first_name} ${other.last_name}`.trim(), role: 'originator', amount: 0 },
        { id: originator.id, name: `${originator.first_name} ${originator.last_name}`.trim(), role: 'working', amount: 0 },
      ],
    }
    const matter3SelfWorkedPortion = 3000
    const matter3OriginatorNonOrigShare = rules.nonOriginatedWorkingPct * matter3SelfWorkedPortion
    matter3.shares[1].amount = Math.round(matter3OriginatorNonOrigShare * 100) / 100
    // The remainder would be attributed to others; for demo, attribute to the "originator" of this matter
    matter3.shares[0].amount = matter3.totalCollected - matter3.shares[1].amount

    const payload: SplitPayload = {
      generatedAt: new Date().toISOString(),
      firmId,
      matters: [matter1, matter2, matter3],
    }

    const buf = await buildSplitWorkbook(payload)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="originator-${encodeURIComponent(originatorName)}-${(month || 'current').replace(/\s+/g,'')}.xlsx"`)
    res.status(200).send(buf)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export originator failed' })
  }
}