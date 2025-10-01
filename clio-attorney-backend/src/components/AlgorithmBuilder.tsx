import { useState, useEffect } from 'react'
import { 
  Plus, 
  Trash2, 
  Save, 
  Play, 
  Settings,
  ArrowRight,
  Calculator,
  Percent,
  DollarSign,
  Clock,
  Users,
  FileText,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye
} from 'lucide-react'

interface AlgorithmStep {
  id: string
  type: 'condition' | 'calculation' | 'assignment'
  name: string
  description: string
  config: any
  children?: AlgorithmStep[]
}

interface AlgorithmBuilderProps {
  algorithmId: string | null
  isCreating: boolean
  onSave: () => void
  onCancel: () => void
}

export default function AlgorithmBuilder({ algorithmId, isCreating, onSave, onCancel }: AlgorithmBuilderProps) {
  const [algorithm, setAlgorithm] = useState<any>(null)
  const [steps, setSteps] = useState<AlgorithmStep[]>([])
  const [selectedStep, setSelectedStep] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  // Sample algorithm templates
  const templates = {
    originating: {
      name: 'Originating Attorney Algorithm',
      description: 'Calculate payouts for originating attorneys',
      steps: [
        {
          id: '1',
          type: 'condition',
          name: 'Check if Attorney is Originator',
          description: 'Verify attorney originated the matter',
          config: {
            field: 'matter.originating_attorney_id',
            operator: 'equals',
            value: 'attorney.id'
          }
        },
        {
          id: '2',
          type: 'calculation',
          name: 'Calculate Base Percentage',
          description: 'Apply originating percentage to collected amount',
          config: {
            formula: 'matter.total_collected * originating_percentage / 100',
            variables: {
              originating_percentage: 15
            }
          }
        },
        {
          id: '3',
          type: 'condition',
          name: 'Check if Self-Billed',
          description: 'Check if originator also worked on matter',
          config: {
            field: 'time_entries.attorney_id',
            operator: 'contains',
            value: 'attorney.id'
          },
          children: [
            {
              id: '3a',
              type: 'calculation',
              name: 'Self-Orig + Self-Billed',
              description: 'Higher percentage for self-originated and self-billed',
              config: {
                formula: 'attorney_billed_amount * self_orig_self_billed_percentage / 100',
                variables: {
                  self_orig_self_billed_percentage: 50
                }
              }
            },
            {
              id: '3b',
              type: 'calculation',
              name: 'Self-Orig + Others-Billed',
              description: 'Lower percentage for others\' billed time',
              config: {
                formula: 'others_billed_amount * self_orig_others_billed_percentage / 100',
                variables: {
                  self_orig_others_billed_percentage: 15
                }
              }
            }
          ]
        },
        {
          id: '4',
          type: 'assignment',
          name: 'Assign Final Payout',
          description: 'Set the calculated amount as attorney payout',
          config: {
            target: 'attorney.originating_payout',
            source: 'calculated_amount'
          }
        }
      ]
    },
    working: {
      name: 'Working Attorney Algorithm',
      description: 'Calculate payouts for working attorneys',
      steps: [
        {
          id: '1',
          type: 'condition',
          name: 'Check Time Entries',
          description: 'Verify attorney has billable time on matter',
          config: {
            field: 'time_entries.attorney_id',
            operator: 'equals',
            value: 'attorney.id'
          }
        },
        {
          id: '2',
          type: 'calculation',
          name: 'Calculate Billable Amount',
          description: 'Sum all billable time for attorney',
          config: {
            formula: 'SUM(time_entries.hours * time_entries.rate)',
            filters: {
              'time_entries.attorney_id': 'attorney.id',
              'time_entries.billable': true
            }
          }
        },
        {
          id: '3',
          type: 'calculation',
          name: 'Apply Working Percentage',
          description: 'Apply working attorney percentage',
          config: {
            formula: 'billable_amount * working_percentage / 100',
            variables: {
              working_percentage: 30
            }
          }
        },
        {
          id: '4',
          type: 'assignment',
          name: 'Assign Working Payout',
          description: 'Set the calculated amount as working payout',
          config: {
            target: 'attorney.working_payout',
            source: 'calculated_amount'
          }
        }
      ]
    }
  }

  const stepTypes = [
    {
      type: 'condition',
      name: 'Condition',
      icon: Settings,
      description: 'Add conditional logic',
      color: 'blue'
    },
    {
      type: 'calculation',
      name: 'Calculation',
      icon: Calculator,
      description: 'Perform mathematical operations',
      color: 'green'
    },
    {
      type: 'assignment',
      name: 'Assignment',
      icon: ArrowRight,
      description: 'Assign values to variables',
      color: 'purple'
    }
  ]

  const availableFields = [
    { category: 'Attorney', fields: ['id', 'name', 'email', 'rate'] },
    { category: 'Matter', fields: ['id', 'name', 'total_collected', 'originating_attorney_id', 'status'] },
    { category: 'Time Entries', fields: ['hours', 'rate', 'attorney_id', 'billable', 'date'] },
    { category: 'Bills', fields: ['amount', 'status', 'date', 'matter_id'] },
    { category: 'Payments', fields: ['amount', 'date', 'matter_id'] }
  ]

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' }
  ]

  const addStep = (type: string, parentId?: string) => {
    const newStep: AlgorithmStep = {
      id: Date.now().toString(),
      type: type as any,
      name: `New ${type}`,
      description: `Configure this ${type}`,
      config: {}
    }

    if (parentId) {
      // Add as child step
      setSteps(prev => prev.map(step => 
        step.id === parentId 
          ? { ...step, children: [...(step.children || []), newStep] }
          : step
      ))
    } else {
      // Add as root step
      setSteps(prev => [...prev, newStep])
    }
    
    setSelectedStep(newStep.id)
  }

  const updateStep = (stepId: string, updates: Partial<AlgorithmStep>) => {
    const updateStepRecursive = (steps: AlgorithmStep[]): AlgorithmStep[] => {
      return steps.map(step => {
        if (step.id === stepId) {
          return { ...step, ...updates }
        }
        if (step.children) {
          return { ...step, children: updateStepRecursive(step.children) }
        }
        return step
      })
    }
    
    setSteps(prev => updateStepRecursive(prev))
  }

  const deleteStep = (stepId: string) => {
    const deleteStepRecursive = (steps: AlgorithmStep[]): AlgorithmStep[] => {
      return steps.filter(step => {
        if (step.id === stepId) return false
        if (step.children) {
          step.children = deleteStepRecursive(step.children)
        }
        return true
      })
    }
    
    setSteps(prev => deleteStepRecursive(prev))
    setSelectedStep(null)
  }

  const loadTemplate = (templateKey: string) => {
    const template = templates[templateKey as keyof typeof templates]
    if (template) {
      setSteps(template.steps as AlgorithmStep[])
      setAlgorithm({
        name: template.name,
        description: template.description
      })
    }
  }

  const renderStep = (step: AlgorithmStep, level = 0) => {
    const isSelected = selectedStep === step.id
    const stepType = stepTypes.find(t => t.type === step.type)
    const Icon = stepType?.icon || Settings

    return (
      <div key={step.id} className={`ml-${level * 4}`}>
        <div
          onClick={() => setSelectedStep(step.id)}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            isSelected
              ? 'border-primary-500 bg-primary-50 shadow-sm'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg bg-${stepType?.color}-100`}>
                <Icon className={`h-4 w-4 text-${stepType?.color}-600`} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{step.name}</h4>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addStep('condition', step.id)
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteStep(step.id)
                }}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {step.children && step.children.map(child => renderStep(child, level + 1))}
      </div>
    )
  }

  const renderStepConfig = () => {
    if (!selectedStep) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Select a step to configure</p>
          </div>
        </div>
      )
    }

    const step = findStepById(selectedStep)
    if (!step) return null

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Step</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Step Name
              </label>
              <input
                type="text"
                value={step.name}
                onChange={(e) => updateStep(step.id, { name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={step.description}
                onChange={(e) => updateStep(step.id, { description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {step.type === 'condition' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Condition Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field
                  </label>
                  <select
                    value={step.config.field || ''}
                    onChange={(e) => updateStep(step.id, { 
                      config: { ...step.config, field: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select field...</option>
                    {availableFields.map(category => (
                      <optgroup key={category.category} label={category.category}>
                        {category.fields.map(field => (
                          <option key={field} value={`${category.category.toLowerCase()}.${field}`}>
                            {field}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Operator
                  </label>
                  <select
                    value={step.config.operator || ''}
                    onChange={(e) => updateStep(step.id, { 
                      config: { ...step.config, operator: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select operator...</option>
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Value
                  </label>
                  <input
                    type="text"
                    value={step.config.value || ''}
                    onChange={(e) => updateStep(step.id, { 
                      config: { ...step.config, value: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter value or field reference"
                  />
                </div>
              </div>
            )}

            {step.type === 'calculation' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Calculation Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formula
                  </label>
                  <textarea
                    value={step.config.formula || ''}
                    onChange={(e) => updateStep(step.id, { 
                      config: { ...step.config, formula: e.target.value }
                    })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                    placeholder="e.g., matter.total_collected * percentage / 100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use field references and mathematical operators (+, -, *, /, %)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Variables
                  </label>
                  <div className="space-y-2">
                    {Object.entries(step.config.variables || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={key}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Variable name"
                        />
                        <input
                          type="number"
                          value={value as number}
                          onChange={(e) => updateStep(step.id, {
                            config: {
                              ...step.config,
                              variables: {
                                ...step.config.variables,
                                [key]: parseFloat(e.target.value)
                              }
                            }
                          })}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
                          placeholder="Value"
                        />
                        <button className="p-2 text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updateStep(step.id, {
                        config: {
                          ...step.config,
                          variables: {
                            ...step.config.variables,
                            [`variable_${Date.now()}`]: 0
                          }
                        }
                      })}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      + Add Variable
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step.type === 'assignment' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Assignment Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Field
                  </label>
                  <input
                    type="text"
                    value={step.config.target || ''}
                    onChange={(e) => updateStep(step.id, { 
                      config: { ...step.config, target: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., attorney.originating_payout"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Value
                  </label>
                  <input
                    type="text"
                    value={step.config.source || ''}
                    onChange={(e) => updateStep(step.id, { 
                      config: { ...step.config, source: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., calculated_amount"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const findStepById = (id: string): AlgorithmStep | null => {
    const findInSteps = (steps: AlgorithmStep[]): AlgorithmStep | null => {
      for (const step of steps) {
        if (step.id === id) return step
        if (step.children) {
          const found = findInSteps(step.children)
          if (found) return found
        }
      }
      return null
    }
    return findInSteps(steps)
  }

  if (!isCreating && !algorithmId) {
    return (
      <div className="bg-white rounded-lg shadow border p-8">
        <div className="text-center">
          <Calculator className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Algorithm Selected</h3>
          <p className="text-gray-600 mb-6">
            Select an algorithm from the library or create a new one to get started.
          </p>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Quick Start Templates</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(templates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => loadTemplate(key)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 text-left"
                >
                  <h5 className="font-medium text-gray-900">{template.name}</h5>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Algorithm Steps */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Algorithm Steps</h3>
            <div className="flex space-x-2">
              {stepTypes.map(stepType => {
                const Icon = stepType.icon
                return (
                  <button
                    key={stepType.type}
                    onClick={() => addStep(stepType.type)}
                    className={`p-2 rounded-lg border hover:bg-${stepType.color}-50 hover:border-${stepType.color}-300`}
                    title={`Add ${stepType.name}`}
                  >
                    <Icon className={`h-4 w-4 text-${stepType.color}-600`} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {steps.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No steps added yet</p>
              <p className="text-sm">Click the buttons above to add algorithm steps</p>
            </div>
          ) : (
            steps.map(step => renderStep(step))
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex justify-between">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </button>
              <button
                onClick={onSave}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Algorithm
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step Configuration */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Step Configuration</h3>
        </div>
        
        <div className="p-4">
          {renderStepConfig()}
        </div>
      </div>
    </div>
  )
}