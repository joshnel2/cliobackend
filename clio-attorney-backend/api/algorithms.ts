import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setJson, getJson } from '../lib/kv.js'

interface Algorithm {
  id: string
  name: string
  description: string
  type: string
  steps: any[]
  variables: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const algorithmId = req.query.algorithmId as string
    const algorithmsKey = `clio:algorithms:${firmId}`

    if (req.method === 'GET') {
      if (algorithmId) {
        // Get specific algorithm
        const algorithms = await getJson<Algorithm[]>(algorithmsKey) || []
        const algorithm = algorithms.find(a => a.id === algorithmId)
        
        if (!algorithm) {
          return res.status(404).json({ error: 'Algorithm not found' })
        }
        
        res.status(200).json({ ok: true, algorithm })
      } else {
        // Get all algorithms
        const algorithms = await getJson<Algorithm[]>(algorithmsKey) || []
        res.status(200).json({ ok: true, algorithms })
      }
    } else if (req.method === 'POST') {
      // Create or update algorithm
      const algorithmData = req.body
      const algorithms = await getJson<Algorithm[]>(algorithmsKey) || []
      
      const algorithm: Algorithm = {
        id: algorithmData.id || Date.now().toString(),
        name: algorithmData.name,
        description: algorithmData.description,
        type: algorithmData.type || 'custom',
        steps: algorithmData.steps || [],
        variables: algorithmData.variables || {},
        isActive: algorithmData.isActive !== false,
        createdAt: algorithmData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existingIndex = algorithms.findIndex(a => a.id === algorithm.id)
      if (existingIndex >= 0) {
        algorithms[existingIndex] = algorithm
      } else {
        algorithms.push(algorithm)
      }

      await setJson(algorithmsKey, algorithms)
      
      // Clear payouts cache to force recalculation
      const payoutsCacheKey = `clio:payouts:${firmId}`
      await setJson(payoutsCacheKey, null, 1)

      res.status(200).json({ ok: true, algorithm })
    } else if (req.method === 'DELETE') {
      if (!algorithmId) {
        return res.status(400).json({ error: 'Algorithm ID required' })
      }

      const algorithms = await getJson<Algorithm[]>(algorithmsKey) || []
      const filteredAlgorithms = algorithms.filter(a => a.id !== algorithmId)
      
      await setJson(algorithmsKey, filteredAlgorithms)
      
      res.status(200).json({ ok: true, message: 'Algorithm deleted' })
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err: any) {
    console.error('Algorithms API error:', err)
    res.status(500).json({ error: err.message || 'Algorithm operation failed' })
  }
}