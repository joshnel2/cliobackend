import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setJson, getJson } from '../lib/kv.js'

interface ReportWidget {
  id: string
  type: 'chart' | 'table' | 'metric' | 'filter'
  chartType?: 'bar' | 'pie' | 'line' | 'area'
  title: string
  dataSource: string
  config: any
  position: { x: number; y: number; w: number; h: number }
}

interface Report {
  id: string
  name: string
  description: string
  widgets: ReportWidget[]
  filters: any[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const reportId = req.query.reportId as string
    const reportsKey = `clio:reports:${firmId}`

    if (req.method === 'GET') {
      if (reportId) {
        // Get specific report
        const reports = await getJson<Report[]>(reportsKey) || []
        const report = reports.find(r => r.id === reportId)
        
        if (!report) {
          return res.status(404).json({ error: 'Report not found' })
        }
        
        res.status(200).json({ ok: true, report })
      } else {
        // Get all reports
        const reports = await getJson<Report[]>(reportsKey) || []
        res.status(200).json({ ok: true, reports })
      }
    } else if (req.method === 'POST') {
      // Create or update report
      const reportData = req.body
      const reports = await getJson<Report[]>(reportsKey) || []
      
      const report: Report = {
        id: reportData.id || Date.now().toString(),
        name: reportData.name,
        description: reportData.description,
        widgets: reportData.widgets || [],
        filters: reportData.filters || [],
        isPublic: reportData.isPublic !== false,
        createdAt: reportData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existingIndex = reports.findIndex(r => r.id === report.id)
      if (existingIndex >= 0) {
        reports[existingIndex] = report
      } else {
        reports.push(report)
      }

      await setJson(reportsKey, reports)

      res.status(200).json({ ok: true, report })
    } else if (req.method === 'DELETE') {
      if (!reportId) {
        return res.status(400).json({ error: 'Report ID required' })
      }

      const reports = await getJson<Report[]>(reportsKey) || []
      const filteredReports = reports.filter(r => r.id !== reportId)
      
      await setJson(reportsKey, filteredReports)
      
      res.status(200).json({ ok: true, message: 'Report deleted' })
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err: any) {
    console.error('Reports API error:', err)
    res.status(500).json({ error: err.message || 'Report operation failed' })
  }
}