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

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const originatorName = (req.query.originator as string) || ''
    const originatorId = req.query.originatorId as string | undefined
    const month = req.query.month as string // e.g., "2024-07"

    const rules: SplitRules = {
      selfOriginatedWorkingPct: 0.50,
      selfOriginatedOthersWorkingPct: 0.15,
      nonOriginatedWorkingPct: 0.30,
    }

    const users = await listUsers(firmId)

    let originator: any | undefined
    if (originatorId) {
      originator = users.find(u => String(u.id) === String(originatorId))
      if (!originator) return res.status(404).json({ error: `Originator not found by id: ${originatorId}` })
    } else {
      if (!originatorName) return res.status(400).json({ error: 'Provide ?originator=First%20Last or ?originatorId=ID' })
      const target = normalize(originatorName)
      originator = users.find(u => normalize(`${u.first_name ?? ''} ${u.last_name ?? ''}`) === target)
      if (!originator) {
        // try partial match
        originator = users.find(u => normalize(`${u.first_name ?? ''} ${u.last_name ?? ''}`).includes(target))
      }
      if (!originator) return res.status(404).json({ error: `Originator not found: ${originatorName}` })
    }

    const other = users.find(u => String(u.id) !== String(originator.id)) || originator

    const window = parseMonth(month)

    // Placeholder matters — will be replaced with real data
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
    const matter1OtherShare = matter1OthersPortion - (rules.selfOriginatedOthersWorkingPct * matter1OthersPortion)
    matter1.shares[0].amount = Math.round(matter1OriginatorShare * 100) / 100
    matter1.shares[1].amount = Math.round(matter1OtherShare * 100) / 100

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
    matter3.shares[0].amount = matter3.totalCollected - matter3.shares[1].amount

    const payload: SplitPayload = {
      generatedAt: new Date().toISOString(),
      firmId,
      matters: [matter1, matter2, matter3],
    }

    const buf = await buildSplitWorkbook(payload)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="originator-${encodeURIComponent(originatorName || String(originator.id))}-${(month || 'current').replace(/\s+/g,'')}.xlsx"`)
    res.status(200).send(buf)
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export originator failed' })
  }
}