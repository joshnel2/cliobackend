import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setJson, getJson } from '../lib/kv.js'

interface Formula {
  id: string
  name: string
  description: string
  formula: string
  variables: Record<string, any>
  category: string
  isValid: boolean
  createdAt: string
  updatedAt: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firmId = (req.query.firmId as string) || 'default'
    const formulaId = req.query.formulaId as string
    const formulasKey = `clio:formulas:${firmId}`

    if (req.method === 'GET') {
      if (formulaId) {
        // Get specific formula
        const formulas = await getJson<Formula[]>(formulasKey) || []
        const formula = formulas.find(f => f.id === formulaId)
        
        if (!formula) {
          return res.status(404).json({ error: 'Formula not found' })
        }
        
        res.status(200).json({ ok: true, formula })
      } else {
        // Get all formulas
        const formulas = await getJson<Formula[]>(formulasKey) || []
        res.status(200).json({ ok: true, formulas })
      }
    } else if (req.method === 'POST') {
      // Create or update formula
      const formulaData = req.body
      const formulas = await getJson<Formula[]>(formulasKey) || []
      
      // Basic formula validation
      const isValid = validateFormula(formulaData.formula)
      
      const formula: Formula = {
        id: formulaData.id || Date.now().toString(),
        name: formulaData.name,
        description: formulaData.description,
        formula: formulaData.formula,
        variables: formulaData.variables || {},
        category: formulaData.category || 'Custom',
        isValid,
        createdAt: formulaData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existingIndex = formulas.findIndex(f => f.id === formula.id)
      if (existingIndex >= 0) {
        formulas[existingIndex] = formula
      } else {
        formulas.push(formula)
      }

      await setJson(formulasKey, formulas)

      res.status(200).json({ ok: true, formula })
    } else if (req.method === 'DELETE') {
      if (!formulaId) {
        return res.status(400).json({ error: 'Formula ID required' })
      }

      const formulas = await getJson<Formula[]>(formulasKey) || []
      const filteredFormulas = formulas.filter(f => f.id !== formulaId)
      
      await setJson(formulasKey, filteredFormulas)
      
      res.status(200).json({ ok: true, message: 'Formula deleted' })
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err: any) {
    console.error('Formulas API error:', err)
    res.status(500).json({ error: err.message || 'Formula operation failed' })
  }
}

function validateFormula(formula: string): boolean {
  if (!formula || typeof formula !== 'string') return false
  
  // Basic validation - check for balanced parentheses
  let openParens = 0
  for (const char of formula) {
    if (char === '(') openParens++
    if (char === ')') openParens--
    if (openParens < 0) return false
  }
  
  // Check for basic formula structure
  const hasValidStructure = /[a-zA-Z_][a-zA-Z0-9_.]*/.test(formula) || /\d+/.test(formula)
  
  return openParens === 0 && hasValidStructure
}