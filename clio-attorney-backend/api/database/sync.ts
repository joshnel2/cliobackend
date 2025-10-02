import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ETLPipeline } from '../../lib/etl.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const fullSync = req.query.full === 'true'
    const force = req.query.force === 'true'

    if (req.method === 'GET') {
      // Get ETL status
      const status = await ETLPipeline.getETLStatus(firmId)
      
      if (!status) {
        return res.status(404).json({ 
          ok: false, 
          error: 'No sync status found. Run a sync first.' 
        })
      }

      res.status(200).json({ ok: true, status })
    } else if (req.method === 'POST') {
      // Start ETL sync
      
      // Check if sync is already running (unless forced)
      if (!force) {
        const currentStatus = await ETLPipeline.getETLStatus(firmId)
        if (currentStatus?.status === 'running') {
          return res.status(409).json({ 
            ok: false, 
            error: 'Sync already in progress. Use force=true to override.' 
          })
        }
      }

      // Start sync in background (don't await)
      const syncPromise = ETLPipeline.runETLForFirm(firmId, !fullSync)
      
      // For full sync or if requested, wait for completion
      if (fullSync || req.query.wait === 'true') {
        try {
          const status = await syncPromise
          res.status(200).json({ ok: true, status, message: 'Sync completed' })
        } catch (error: any) {
          res.status(500).json({ 
            ok: false, 
            error: error.message || 'Sync failed',
            status: await ETLPipeline.getETLStatus(firmId)
          })
        }
      } else {
        // Return immediately for incremental sync
        res.status(202).json({ 
          ok: true, 
          message: 'Sync started in background',
          firmId 
        })
        
        // Handle sync completion/failure in background
        syncPromise.catch(error => {
          console.error(`Background sync failed for firm ${firmId}:`, error)
        })
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err: any) {
    console.error('Database sync API error:', err)
    res.status(500).json({ error: err.message || 'Database sync operation failed' })
  }
}