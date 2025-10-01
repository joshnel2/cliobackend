import type { VercelRequest, VercelResponse } from '@vercel/node'
import { calculatePayouts, type PayoutConfig } from '../lib/payouts.js'
import { setJson, getJson } from '../lib/kv.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const forceRefresh = req.query.force === 'true'

    // Check cache first (cache for 10 minutes unless forced refresh)
    const cacheKey = `clio:payouts:${firmId}`
    if (!forceRefresh) {
      const cached = await getJson<any>(cacheKey)
      if (cached) {
        return res.status(200).json({ ok: true, metrics: cached, fromCache: true })
      }
    }

    // Get custom payout configuration (if any)
    const configKey = `clio:config:${firmId}`
    const customConfig = await getJson<PayoutConfig>(configKey)
    
    // Calculate payouts using real Clio data
    const payoutData = await calculatePayouts(firmId, customConfig || undefined)

    const metrics = {
      generatedAt: new Date().toISOString(),
      firmId,
      totals: {
        attorneys: payoutData.totals.attorneys,
        working: payoutData.totals.working,
        originating: payoutData.totals.originating,
        referral: payoutData.totals.referral,
        totalPayout: payoutData.totals.totalPayout,
      },
      byAttorney: payoutData.attorneys.map(attorney => ({
        id: attorney.id,
        name: attorney.name,
        working: Math.round(attorney.working * 100) / 100,
        originating: Math.round(attorney.originating * 100) / 100,
        referral: Math.round(attorney.referral * 100) / 100,
        totalPayout: Math.round(attorney.totalPayout * 100) / 100,
      })),
      matters: payoutData.matters.map(matter => ({
        matterId: matter.matterId,
        matterName: matter.matterName,
        totalCollected: Math.round(matter.totalCollected * 100) / 100,
        shares: [
          ...(matter.originatorId ? [{
            id: matter.originatorId,
            name: matter.originatorName,
            role: 'originator' as const,
            amount: Math.round(matter.originatorAmount * 100) / 100,
          }] : []),
          ...matter.workingAttorneys.map(wa => ({
            id: wa.id,
            name: wa.name,
            role: 'working' as const,
            amount: Math.round(wa.amount * 100) / 100,
          }))
        ],
        selfOrigSelfBilled: matter.selfOrigSelfBilled ? Math.round(matter.selfOrigSelfBilled * 100) / 100 : undefined,
        selfOrigOthersBilled: matter.selfOrigOthersBilled ? Math.round(matter.selfOrigOthersBilled * 100) / 100 : undefined,
        nonOrigSelfBilled: matter.nonOrigSelfBilled ? Math.round(matter.nonOrigSelfBilled * 100) / 100 : undefined,
        originatorComputedAmount: Math.round(matter.originatorAmount * 100) / 100,
      }))
    }

    // Cache the results for 10 minutes
    await setJson(cacheKey, metrics, 600)

    res.status(200).json({ ok: true, metrics, fromCache: false })
  } catch (err: any) {
    console.error('Sync error:', err)
    res.status(500).json({ error: err.message || 'Sync failed' })
  }
}