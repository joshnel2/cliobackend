import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Database, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  Play, 
  BarChart3,
  Table,
  Settings,
  Code,
  Calculator,
  Filter,
  Download,
  Upload,
  Eye,
  Copy
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/api'
import AlgorithmBuilder from '../components/AlgorithmBuilder'
import DataTable from '../components/DataTable'
import FormulaEditor from '../components/FormulaEditor'
import ReportBuilder from '../components/ReportBuilder'

type TabType = 'algorithms' | 'data' | 'reports' | 'formulas'

export default function Analytics() {
  const { firmId } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('algorithms')
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const queryClient = useQueryClient()

  const { data: algorithms, isLoading: algorithmsLoading } = useQuery({
    queryKey: ['algorithms', firmId],
    queryFn: () => firmId ? apiClient.getAlgorithms(firmId) : null,
    enabled: !!firmId,
  })

  const { data: dataViews, isLoading: dataLoading } = useQuery({
    queryKey: ['dataViews', firmId],
    queryFn: () => firmId ? apiClient.getDataViews(firmId) : null,
    enabled: !!firmId,
  })

  const tabs = [
    {
      id: 'algorithms' as const,
      name: 'Algorithm Builder',
      icon: Calculator,
      description: 'Create and manage payout algorithms'
    },
    {
      id: 'data' as const,
      name: 'Data Explorer',
      icon: Database,
      description: 'View and analyze raw data'
    },
    {
      id: 'reports' as const,
      name: 'Report Builder',
      icon: BarChart3,
      description: 'Create custom reports and dashboards'
    },
    {
      id: 'formulas' as const,
      name: 'Formula Editor',
      icon: Code,
      description: 'Write custom calculation formulas'
    }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'algorithms':
        return (
          <div className="space-y-6">
            {/* Algorithm Management Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Algorithm Management</h2>
                <p className="text-gray-600">Create, edit, and manage payout calculation algorithms</p>
              </div>
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Algorithm
              </button>
            </div>

            {/* Algorithm List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Algorithm Library */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow border">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">Algorithm Library</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {algorithmsLoading ? (
                      <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {algorithms?.map((algo: any) => (
                          <div
                            key={algo.id}
                            onClick={() => setSelectedAlgorithm(algo.id)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedAlgorithm === algo.id
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{algo.name}</h4>
                                <p className="text-xs text-gray-500">{algo.type}</p>
                              </div>
                              <div className="flex space-x-1">
                                <button className="p-1 text-gray-400 hover:text-gray-600">
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button className="p-1 text-gray-400 hover:text-red-600">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Default Templates */}
                        <div className="border-t pt-4 mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Templates</h4>
                          {[
                            { name: 'Standard Originating', type: 'Percentage-based' },
                            { name: 'Tiered Working', type: 'Hours-based' },
                            { name: 'Referral Split', type: 'Fixed-rate' },
                            { name: 'Hybrid Model', type: 'Complex' }
                          ].map((template, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded border border-dashed border-gray-300 hover:border-primary-300 cursor-pointer mb-2"
                            >
                              <div className="text-sm font-medium text-gray-700">{template.name}</div>
                              <div className="text-xs text-gray-500">{template.type}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Algorithm Builder */}
              <div className="lg:col-span-2">
                <AlgorithmBuilder 
                  algorithmId={selectedAlgorithm}
                  isCreating={isCreating}
                  onSave={() => {
                    setIsCreating(false)
                    queryClient.invalidateQueries({ queryKey: ['algorithms'] })
                  }}
                  onCancel={() => {
                    setIsCreating(false)
                    setSelectedAlgorithm(null)
                  }}
                />
              </div>
            </div>
          </div>
        )

      case 'data':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Data Explorer</h2>
                <p className="text-gray-600">Explore and analyze your Clio data</p>
              </div>
              <div className="flex space-x-2">
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </button>
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>

            <DataTable firmId={firmId} />
          </div>
        )

      case 'reports':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Report Builder</h2>
                <p className="text-gray-600">Create custom reports and visualizations</p>
              </div>
              <button className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Plus className="h-4 w-4 mr-2" />
                New Report
              </button>
            </div>

            <ReportBuilder firmId={firmId} />
          </div>
        )

      case 'formulas':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Formula Editor</h2>
                <p className="text-gray-600">Write custom calculation formulas</p>
              </div>
              <div className="flex space-x-2">
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </button>
                <button className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Formula
                </button>
              </div>
            </div>

            <FormulaEditor firmId={firmId} />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Database className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Studio</h1>
              <p className="text-sm text-gray-600">Advanced algorithm and data management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        {renderTabContent()}
      </div>
    </div>
  )
}