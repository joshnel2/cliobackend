import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setJson, getJson } from '../lib/kv.js'
import { type PayoutConfig } from '../lib/payouts.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const configKey = `clio:config:${firmId}`

    if (req.method === 'GET') {
      // Get current configuration
      const config = await getJson<PayoutConfig>(configKey)
      const defaultConfig: PayoutConfig = {
        originatingPercentage: 15,
        workingPercentage: 30,
        referralPercentage: 10,
        selfOrigSelfBilledPercentage: 50,
        selfOrigOthersBilledPercentage: 15,
        nonOrigSelfBilledPercentage: 30,
      }

      res.status(200).json({ 
        ok: true, 
        config: config || defaultConfig,
        isDefault: !config 
      })
    } else if (req.method === 'POST') {
      // Update configuration
      const newConfig: PayoutConfig = req.body

      // Validate configuration
      const requiredFields = [
        'originatingPercentage',
        'workingPercentage', 
        'referralPercentage',
        'selfOrigSelfBilledPercentage',
        'selfOrigOthersBilledPercentage',
        'nonOrigSelfBilledPercentage'
      ]

      for (const field of requiredFields) {
        if (typeof newConfig[field as keyof PayoutConfig] !== 'number') {
          return res.status(400).json({ 
            error: `Missing or invalid field: ${field}` 
          })
        }
      }

      // Validate percentages are reasonable (0-100)
      for (const field of requiredFields) {
        const value = newConfig[field as keyof PayoutConfig] as number
        if (value < 0 || value > 100) {
          return res.status(400).json({ 
            error: `${field} must be between 0 and 100` 
          })
        }
      }

      // Save configuration
      await setJson(configKey, newConfig)

      // Clear the payouts cache to force recalculation
      const payoutsCacheKey = `clio:payouts:${firmId}`
      await setJson(payoutsCacheKey, null, 1) // Expire immediately

      res.status(200).json({ 
        ok: true, 
        config: newConfig,
        message: 'Configuration updated successfully' 
      })
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err: any) {
    console.error('Config error:', err)
    res.status(500).json({ error: err.message || 'Configuration operation failed' })
  }
}