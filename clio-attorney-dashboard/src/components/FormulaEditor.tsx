import { useState, useRef, useEffect } from 'react'
import { 
  Play, 
  Save, 
  Code, 
  BookOpen, 
  Calculator, 
  CheckCircle, 
  AlertCircle,
  Copy,
  Download,
  Upload,
  Trash2,
  Edit3
} from 'lucide-react'

interface FormulaEditorProps {
  firmId: string | null
}

interface Formula {
  id: string
  name: string
  description: string
  formula: string
  variables: Record<string, any>
  category: string
  lastModified: string
  isValid: boolean
}

const sampleFormulas: Formula[] = [
  {
    id: '1',
    name: 'Standard Originating Percentage',
    description: 'Calculate originating attorney payout as percentage of collected fees',
    formula: 'matter.total_collected * originating_percentage / 100',
    variables: { originating_percentage: 15 },
    category: 'Originating',
    lastModified: '2024-01-15',
    isValid: true
  },
  {
    id: '2',
    name: 'Tiered Working Attorney',
    description: 'Tiered percentage based on hours worked',
    formula: `IF(hours_worked <= 50, 
  billable_amount * 0.25, 
  IF(hours_worked <= 100, 
    billable_amount * 0.30, 
    billable_amount * 0.35
  )
)`,
    variables: { base_rate: 0.25, tier2_rate: 0.30, tier3_rate: 0.35 },
    category: 'Working',
    lastModified: '2024-01-14',
    isValid: true
  },
  {
    id: '3',
    name: 'Complex Hybrid Model',
    description: 'Combination of originating and working with bonuses',
    formula: `(matter.total_collected * originating_percentage / 100) + 
(billable_amount * working_percentage / 100) + 
IF(matter.total_collected > bonus_threshold, bonus_amount, 0)`,
    variables: { 
      originating_percentage: 12, 
      working_percentage: 28, 
      bonus_threshold: 50000, 
      bonus_amount: 2500 
    },
    category: 'Hybrid',
    lastModified: '2024-01-13',
    isValid: true
  }
]

const formulaFunctions = [
  { name: 'SUM', description: 'Sum of values', syntax: 'SUM(field)' },
  { name: 'AVG', description: 'Average of values', syntax: 'AVG(field)' },
  { name: 'COUNT', description: 'Count of records', syntax: 'COUNT(field)' },
  { name: 'MAX', description: 'Maximum value', syntax: 'MAX(field)' },
  { name: 'MIN', description: 'Minimum value', syntax: 'MIN(field)' },
  { name: 'IF', description: 'Conditional logic', syntax: 'IF(condition, true_value, false_value)' },
  { name: 'ROUND', description: 'Round to decimal places', syntax: 'ROUND(value, decimals)' },
  { name: 'ABS', description: 'Absolute value', syntax: 'ABS(value)' },
  { name: 'CEILING', description: 'Round up', syntax: 'CEILING(value)' },
  { name: 'FLOOR', description: 'Round down', syntax: 'FLOOR(value)' }
]

const availableFields = [
  { category: 'Attorney', fields: ['id', 'name', 'email', 'hourly_rate'] },
  { category: 'Matter', fields: ['id', 'name', 'total_collected', 'total_billed', 'status'] },
  { category: 'Time Entries', fields: ['hours_worked', 'billable_amount', 'rate'] },
  { category: 'Bills', fields: ['amount', 'status', 'date'] },
  { category: 'Payments', fields: ['amount', 'date', 'method'] }
]

export default function FormulaEditor({ firmId }: FormulaEditorProps) {
  const [formulas, setFormulas] = useState<Formula[]>(sampleFormulas)
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showFunctions, setShowFunctions] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const [editingFormula, setEditingFormula] = useState({
    name: '',
    description: '',
    formula: '',
    variables: {} as Record<string, any>,
    category: 'Custom'
  })

  useEffect(() => {
    if (selectedFormula && !isEditing) {
      setEditingFormula({
        name: selectedFormula.name,
        description: selectedFormula.description,
        formula: selectedFormula.formula,
        variables: { ...selectedFormula.variables },
        category: selectedFormula.category
      })
    }
  }, [selectedFormula, isEditing])

  const insertAtCursor = (text: string) => {
    if (!editorRef.current) return
    
    const start = editorRef.current.selectionStart
    const end = editorRef.current.selectionEnd
    const currentFormula = editingFormula.formula
    
    const newFormula = currentFormula.substring(0, start) + text + currentFormula.substring(end)
    setEditingFormula(prev => ({ ...prev, formula: newFormula }))
    
    // Set cursor position after inserted text
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.selectionStart = editorRef.current.selectionEnd = start + text.length
        editorRef.current.focus()
      }
    }, 0)
  }

  const validateFormula = (formula: string): boolean => {
    // Basic validation - check for balanced parentheses
    let openParens = 0
    for (const char of formula) {
      if (char === '(') openParens++
      if (char === ')') openParens--
      if (openParens < 0) return false
    }
    return openParens === 0
  }

  const testFormula = () => {
    // Simulate formula execution with sample data
    const sampleData = {
      matter: { total_collected: 100000, total_billed: 120000 },
      attorney: { hourly_rate: 350 },
      hours_worked: 75,
      billable_amount: 26250,
      ...editingFormula.variables
    }

    try {
      // This is a simplified test - in production, you'd use a proper formula parser
      let result = editingFormula.formula
      
      // Replace variables with sample values
      Object.entries(sampleData).forEach(([key, value]) => {
        const regex = new RegExp(`\\b${key}\\b`, 'g')
        result = result.replace(regex, String(value))
      })

      // Simple evaluation for basic math (in production, use a safe evaluator)
      const mathResult = eval(result.replace(/[^0-9+\-*/().\s]/g, ''))
      
      setTestResult({
        success: true,
        result: mathResult,
        formatted: `$${Number(mathResult).toLocaleString()}`
      })
    } catch (error) {
      setTestResult({
        success: false,
        error: 'Formula contains errors'
      })
    }
  }

  const saveFormula = () => {
    const isValid = validateFormula(editingFormula.formula)
    
    const newFormula: Formula = {
      id: selectedFormula?.id || Date.now().toString(),
      name: editingFormula.name,
      description: editingFormula.description,
      formula: editingFormula.formula,
      variables: editingFormula.variables,
      category: editingFormula.category,
      lastModified: new Date().toISOString().split('T')[0],
      isValid
    }

    if (selectedFormula) {
      setFormulas(prev => prev.map(f => f.id === selectedFormula.id ? newFormula : f))
    } else {
      setFormulas(prev => [...prev, newFormula])
    }

    setSelectedFormula(newFormula)
    setIsEditing(false)
  }

  const deleteFormula = (id: string) => {
    setFormulas(prev => prev.filter(f => f.id !== id))
    if (selectedFormula?.id === id) {
      setSelectedFormula(null)
    }
  }

  const categories = [...new Set(formulas.map(f => f.category))]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formula Library */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Formula Library</h3>
            <button
              onClick={() => {
                setSelectedFormula(null)
                setIsEditing(true)
                setEditingFormula({
                  name: '',
                  description: '',
                  formula: '',
                  variables: {},
                  category: 'Custom'
                })
              }}
              className="text-primary-600 hover:text-primary-700"
            >
              <Code className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {categories.map(category => (
            <div key={category}>
              <h4 className="text-sm font-medium text-gray-700 mb-2">{category}</h4>
              <div className="space-y-2">
                {formulas.filter(f => f.category === category).map(formula => (
                  <div
                    key={formula.id}
                    onClick={() => setSelectedFormula(formula)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFormula?.id === formula.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="font-medium text-gray-900 text-sm">{formula.name}</h5>
                          {formula.isValid ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{formula.description}</p>
                        <p className="text-xs text-gray-400 mt-1">Modified: {formula.lastModified}</p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFormula(formula)
                            setIsEditing(true)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteFormula(formula.id)
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Formula Editor */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-lg shadow border">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                {isEditing ? 'Edit Formula' : 'Formula Details'}
              </h3>
              <div className="flex space-x-2">
                {!isEditing && selectedFormula && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </button>
                )}
                {isEditing && (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        if (selectedFormula) {
                          setEditingFormula({
                            name: selectedFormula.name,
                            description: selectedFormula.description,
                            formula: selectedFormula.formula,
                            variables: { ...selectedFormula.variables },
                            category: selectedFormula.category
                          })
                        }
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveFormula}
                      className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-4">
            {!selectedFormula && !isEditing ? (
              <div className="text-center py-12">
                <Code className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Formula Selected</h3>
                <p className="text-gray-600 mb-4">
                  Select a formula from the library or create a new one to get started.
                </p>
                <button
                  onClick={() => {
                    setSelectedFormula(null)
                    setIsEditing(true)
                    setEditingFormula({
                      name: '',
                      description: '',
                      formula: '',
                      variables: {},
                      category: 'Custom'
                    })
                  }}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Code className="h-4 w-4 mr-2" />
                  Create New Formula
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Formula Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Formula Name
                    </label>
                    <input
                      type="text"
                      value={editingFormula.name}
                      onChange={(e) => setEditingFormula(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={editingFormula.category}
                      onChange={(e) => setEditingFormula(prev => ({ ...prev, category: e.target.value }))}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                    >
                      <option value="Originating">Originating</option>
                      <option value="Working">Working</option>
                      <option value="Referral">Referral</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingFormula.description}
                    onChange={(e) => setEditingFormula(prev => ({ ...prev, description: e.target.value }))}
                    disabled={!isEditing}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                  />
                </div>

                {/* Formula Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Formula
                    </label>
                    {isEditing && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowFunctions(!showFunctions)}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          Functions
                        </button>
                        <button
                          onClick={() => setShowFields(!showFields)}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          Fields
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <textarea
                      ref={editorRef}
                      value={editingFormula.formula}
                      onChange={(e) => setEditingFormula(prev => ({ ...prev, formula: e.target.value }))}
                      disabled={!isEditing}
                      rows={8}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 font-mono text-sm disabled:bg-gray-50"
                      placeholder="Enter your formula here..."
                    />
                    
                    {/* Quick Insert Panels */}
                    {isEditing && showFunctions && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                        <div className="p-2">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">Functions</h4>
                          {formulaFunctions.map(func => (
                            <button
                              key={func.name}
                              onClick={() => insertAtCursor(func.syntax)}
                              className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded"
                            >
                              <span className="font-mono text-primary-600">{func.name}</span>
                              <span className="text-gray-500 ml-2">{func.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isEditing && showFields && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                        <div className="p-2">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">Available Fields</h4>
                          {availableFields.map(category => (
                            <div key={category.category} className="mb-2">
                              <h5 className="text-xs font-medium text-gray-600">{category.category}</h5>
                              {category.fields.map(field => (
                                <button
                                  key={field}
                                  onClick={() => insertAtCursor(`${category.category.toLowerCase()}.${field}`)}
                                  className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-100 rounded font-mono text-primary-600"
                                >
                                  {category.category.toLowerCase()}.{field}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Variables */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variables
                  </label>
                  <div className="space-y-2">
                    {Object.entries(editingFormula.variables).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={key}
                          disabled={!isEditing}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                          placeholder="Variable name"
                        />
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setEditingFormula(prev => ({
                            ...prev,
                            variables: {
                              ...prev.variables,
                              [key]: parseFloat(e.target.value) || 0
                            }
                          }))}
                          disabled={!isEditing}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50"
                          placeholder="Value"
                        />
                        {isEditing && (
                          <button
                            onClick={() => {
                              const newVars = { ...editingFormula.variables }
                              delete newVars[key]
                              setEditingFormula(prev => ({ ...prev, variables: newVars }))
                            }}
                            className="p-2 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {isEditing && (
                      <button
                        onClick={() => setEditingFormula(prev => ({
                          ...prev,
                          variables: {
                            ...prev.variables,
                            [`variable_${Date.now()}`]: 0
                          }
                        }))}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        + Add Variable
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Formula */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Test Formula</h4>
                    <button
                      onClick={testFormula}
                      className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </button>
                  </div>

                  {testResult && (
                    <div className={`p-4 rounded-lg ${
                      testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      {testResult.success ? (
                        <div>
                          <div className="flex items-center text-green-800 mb-2">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Formula executed successfully
                          </div>
                          <p className="text-green-700">
                            Result: <span className="font-mono font-bold">{testResult.formatted}</span>
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-800">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          {testResult.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}