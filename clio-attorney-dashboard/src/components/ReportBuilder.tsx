import { useState } from 'react'
import { 
  BarChart3, 
  PieChart, 
  LineChart, 
  Table, 
  Plus, 
  Settings, 
  Eye, 
  Download,
  Save,
  Trash2,
  Copy,
  Filter,
  Calendar,
  Users,
  DollarSign
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line
} from 'recharts'

interface ReportBuilderProps {
  firmId: string | null
}

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
  lastModified: string
}

const sampleReports: Report[] = [
  {
    id: '1',
    name: 'Attorney Performance Dashboard',
    description: 'Overview of attorney payouts and performance metrics',
    widgets: [
      {
        id: 'w1',
        type: 'chart',
        chartType: 'bar',
        title: 'Attorney Payouts by Type',
        dataSource: 'attorneys',
        config: {
          xAxis: 'name',
          yAxis: ['working', 'originating', 'referral'],
          colors: ['#3b82f6', '#10b981', '#8b5cf6']
        },
        position: { x: 0, y: 0, w: 8, h: 4 }
      },
      {
        id: 'w2',
        type: 'chart',
        chartType: 'pie',
        title: 'Payout Distribution',
        dataSource: 'attorneys',
        config: {
          field: 'total_payout',
          labelField: 'name'
        },
        position: { x: 8, y: 0, w: 4, h: 4 }
      },
      {
        id: 'w3',
        type: 'table',
        title: 'Top Performing Attorneys',
        dataSource: 'attorneys',
        config: {
          columns: ['name', 'total_payout', 'working', 'originating'],
          sortBy: 'total_payout',
          limit: 10
        },
        position: { x: 0, y: 4, w: 12, h: 4 }
      }
    ],
    filters: [],
    lastModified: '2024-01-15'
  },
  {
    id: '2',
    name: 'Matter Analysis Report',
    description: 'Detailed analysis of matters and collections',
    widgets: [
      {
        id: 'w4',
        type: 'metric',
        title: 'Total Collections',
        dataSource: 'matters',
        config: {
          field: 'total_collected',
          aggregation: 'sum',
          format: 'currency'
        },
        position: { x: 0, y: 0, w: 3, h: 2 }
      },
      {
        id: 'w5',
        type: 'metric',
        title: 'Active Matters',
        dataSource: 'matters',
        config: {
          field: 'id',
          aggregation: 'count',
          filter: { status: 'active' }
        },
        position: { x: 3, y: 0, w: 3, h: 2 }
      },
      {
        id: 'w6',
        type: 'chart',
        chartType: 'line',
        title: 'Collections Over Time',
        dataSource: 'payments',
        config: {
          xAxis: 'date',
          yAxis: 'amount',
          groupBy: 'month'
        },
        position: { x: 0, y: 2, w: 12, h: 4 }
      }
    ],
    filters: [
      {
        field: 'date_range',
        type: 'daterange',
        label: 'Date Range'
      }
    ],
    lastModified: '2024-01-14'
  }
]

const widgetTypes = [
  { type: 'chart', icon: BarChart3, name: 'Chart', description: 'Bar, pie, line charts' },
  { type: 'table', icon: Table, name: 'Table', description: 'Data tables with sorting' },
  { type: 'metric', icon: DollarSign, name: 'Metric', description: 'Single value metrics' },
  { type: 'filter', icon: Filter, name: 'Filter', description: 'Interactive filters' }
]

const chartTypes = [
  { type: 'bar', icon: BarChart3, name: 'Bar Chart' },
  { type: 'pie', icon: PieChart, name: 'Pie Chart' },
  { type: 'line', icon: LineChart, name: 'Line Chart' }
]

const dataSources = [
  { key: 'attorneys', name: 'Attorneys', fields: ['name', 'total_payout', 'working', 'originating', 'referral'] },
  { key: 'matters', name: 'Matters', fields: ['name', 'total_collected', 'status', 'originating_attorney'] },
  { key: 'bills', name: 'Bills', fields: ['amount', 'status', 'date', 'matter_name'] },
  { key: 'time_entries', name: 'Time Entries', fields: ['hours', 'rate', 'total', 'attorney_name', 'date'] },
  { key: 'payments', name: 'Payments', fields: ['amount', 'date', 'matter_name', 'method'] }
]

// Sample data for preview
const sampleData = {
  attorneys: [
    { name: 'John Smith', total_payout: 125000, working: 75000, originating: 40000, referral: 10000 },
    { name: 'Sarah Johnson', total_payout: 98000, working: 68000, originating: 25000, referral: 5000 },
    { name: 'Mike Davis', total_payout: 87000, working: 52000, originating: 30000, referral: 5000 },
    { name: 'Lisa Wilson', total_payout: 76000, working: 46000, originating: 25000, referral: 5000 }
  ],
  matters: [
    { name: 'Corporate Merger A', total_collected: 250000, status: 'closed' },
    { name: 'Personal Injury B', total_collected: 180000, status: 'active' },
    { name: 'Real Estate C', total_collected: 95000, status: 'closed' }
  ]
}

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444']

export default function ReportBuilder({ firmId }: ReportBuilderProps) {
  const [reports, setReports] = useState<Report[]>(sampleReports)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedWidget, setSelectedWidget] = useState<ReportWidget | null>(null)
  const [showWidgetConfig, setShowWidgetConfig] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const [newWidget, setNewWidget] = useState<Partial<ReportWidget>>({
    type: 'chart',
    chartType: 'bar',
    title: 'New Widget',
    dataSource: 'attorneys',
    config: {}
  })

  const addWidget = () => {
    if (!selectedReport) return

    const widget: ReportWidget = {
      id: `w${Date.now()}`,
      type: newWidget.type as any,
      chartType: newWidget.chartType,
      title: newWidget.title || 'New Widget',
      dataSource: newWidget.dataSource || 'attorneys',
      config: newWidget.config || {},
      position: { x: 0, y: 0, w: 6, h: 4 }
    }

    const updatedReport = {
      ...selectedReport,
      widgets: [...selectedReport.widgets, widget]
    }

    setReports(prev => prev.map(r => r.id === selectedReport.id ? updatedReport : r))
    setSelectedReport(updatedReport)
    setShowWidgetConfig(false)
  }

  const updateWidget = (widgetId: string, updates: Partial<ReportWidget>) => {
    if (!selectedReport) return

    const updatedReport = {
      ...selectedReport,
      widgets: selectedReport.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      )
    }

    setReports(prev => prev.map(r => r.id === selectedReport.id ? updatedReport : r))
    setSelectedReport(updatedReport)
  }

  const deleteWidget = (widgetId: string) => {
    if (!selectedReport) return

    const updatedReport = {
      ...selectedReport,
      widgets: selectedReport.widgets.filter(w => w.id !== widgetId)
    }

    setReports(prev => prev.map(r => r.id === selectedReport.id ? updatedReport : r))
    setSelectedReport(updatedReport)
    setSelectedWidget(null)
  }

  const renderWidget = (widget: ReportWidget) => {
    const data = sampleData[widget.dataSource as keyof typeof sampleData] || []

    switch (widget.type) {
      case 'chart':
        return renderChart(widget, data)
      case 'table':
        return renderTable(widget, data)
      case 'metric':
        return renderMetric(widget, data)
      default:
        return <div className="p-4 text-gray-500">Unsupported widget type</div>
    }
  }

  const renderChart = (widget: ReportWidget, data: any[]) => {
    switch (widget.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={widget.config.xAxis || 'name'} />
              <YAxis />
              <Tooltip />
              <Legend />
              {(widget.config.yAxis || ['total_payout']).map((key: string, index: number) => (
                <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
      
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey={widget.config.field || 'total_payout'}
                nameKey={widget.config.labelField || 'name'}
                label
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        )
      
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={widget.config.xAxis || 'name'} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={widget.config.yAxis || 'total_payout'} 
                stroke={COLORS[0]} 
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        )
      
      default:
        return <div className="p-4 text-gray-500">Unsupported chart type</div>
    }
  }

  const renderTable = (widget: ReportWidget, data: any[]) => {
    const columns = widget.config.columns || ['name', 'total_payout']
    const sortedData = widget.config.sortBy 
      ? [...data].sort((a, b) => b[widget.config.sortBy] - a[widget.config.sortBy])
      : data
    const limitedData = widget.config.limit 
      ? sortedData.slice(0, widget.config.limit)
      : sortedData

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col: string) => (
                <th key={col} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {col.replace('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {limitedData.map((row, index) => (
              <tr key={index}>
                {columns.map((col: string) => (
                  <td key={col} className="px-4 py-2 text-sm text-gray-900">
                    {typeof row[col] === 'number' && col.includes('payout') 
                      ? `$${row[col].toLocaleString()}`
                      : row[col]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderMetric = (widget: ReportWidget, data: any[]) => {
    let value = 0
    const field = widget.config.field
    const aggregation = widget.config.aggregation || 'sum'

    switch (aggregation) {
      case 'sum':
        value = data.reduce((sum, item) => sum + (item[field] || 0), 0)
        break
      case 'count':
        value = data.length
        break
      case 'avg':
        value = data.reduce((sum, item) => sum + (item[field] || 0), 0) / data.length
        break
      case 'max':
        value = Math.max(...data.map(item => item[field] || 0))
        break
      case 'min':
        value = Math.min(...data.map(item => item[field] || 0))
        break
    }

    const formatted = widget.config.format === 'currency' 
      ? `$${value.toLocaleString()}`
      : value.toLocaleString()

    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{formatted}</div>
          <div className="text-sm text-gray-500 mt-1">{widget.title}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Report List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow border">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Reports</h3>
              <button
                onClick={() => {
                  const newReport: Report = {
                    id: Date.now().toString(),
                    name: 'New Report',
                    description: 'Custom report',
                    widgets: [],
                    filters: [],
                    lastModified: new Date().toISOString().split('T')[0]
                  }
                  setReports(prev => [...prev, newReport])
                  setSelectedReport(newReport)
                  setIsEditing(true)
                }}
                className="text-primary-600 hover:text-primary-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {reports.map(report => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedReport?.id === report.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm">{report.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {report.widgets.length} widgets • Modified: {report.lastModified}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedReport(report)
                        setIsEditing(true)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setReports(prev => prev.filter(r => r.id !== report.id))
                        if (selectedReport?.id === report.id) {
                          setSelectedReport(null)
                        }
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

        {/* Report Canvas */}
        <div className="lg:col-span-3">
          {!selectedReport ? (
            <div className="bg-white rounded-lg shadow border p-8">
              <div className="text-center">
                <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Selected</h3>
                <p className="text-gray-600 mb-6">
                  Select a report from the list or create a new one to get started.
                </p>
                <button
                  onClick={() => {
                    const newReport: Report = {
                      id: Date.now().toString(),
                      name: 'New Report',
                      description: 'Custom report',
                      widgets: [],
                      filters: [],
                      lastModified: new Date().toISOString().split('T')[0]
                    }
                    setReports(prev => [...prev, newReport])
                    setSelectedReport(newReport)
                    setIsEditing(true)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Report
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Report Header */}
              <div className="bg-white rounded-lg shadow border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedReport.name}</h2>
                    <p className="text-gray-600">{selectedReport.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className={`inline-flex items-center px-3 py-2 border rounded-lg ${
                        previewMode 
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </button>
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`inline-flex items-center px-3 py-2 border rounded-lg ${
                        isEditing 
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                    <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setShowWidgetConfig(true)}
                        className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Widget
                      </button>
                      
                      <div className="flex space-x-2">
                        {widgetTypes.map(type => {
                          const Icon = type.icon
                          return (
                            <button
                              key={type.type}
                              onClick={() => {
                                setNewWidget({ ...newWidget, type: type.type as any })
                                setShowWidgetConfig(true)
                              }}
                              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                              title={type.description}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Widgets Grid */}
              <div className="grid grid-cols-12 gap-4">
                {selectedReport.widgets.map(widget => (
                  <div
                    key={widget.id}
                    className={`bg-white rounded-lg shadow border ${
                      widget.position.w === 12 ? 'col-span-12' :
                      widget.position.w === 8 ? 'col-span-8' :
                      widget.position.w === 6 ? 'col-span-6' :
                      widget.position.w === 4 ? 'col-span-4' :
                      'col-span-3'
                    }`}
                    style={{ minHeight: `${widget.position.h * 100}px` }}
                  >
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">{widget.title}</h3>
                        {isEditing && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => setSelectedWidget(widget)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <Settings className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteWidget(widget.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-4" style={{ height: `${widget.position.h * 100 - 60}px` }}>
                      {renderWidget(widget)}
                    </div>
                  </div>
                ))}
              </div>

              {selectedReport.widgets.length === 0 && (
                <div className="bg-white rounded-lg shadow border p-8">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Widgets</h3>
                    <p className="text-gray-600 mb-4">
                      Add widgets to start building your report.
                    </p>
                    <button
                      onClick={() => setShowWidgetConfig(true)}
                      className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Widget
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Widget Configuration Modal */}
      {showWidgetConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Add Widget</h3>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Widget Type
                  </label>
                  <select
                    value={newWidget.type}
                    onChange={(e) => setNewWidget({ ...newWidget, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  >
                    {widgetTypes.map(type => (
                      <option key={type.type} value={type.type}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newWidget.type === 'chart' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chart Type
                    </label>
                    <select
                      value={newWidget.chartType}
                      onChange={(e) => setNewWidget({ ...newWidget, chartType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    >
                      {chartTypes.map(type => (
                        <option key={type.type} value={type.type}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newWidget.title}
                  onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Source
                </label>
                <select
                  value={newWidget.dataSource}
                  onChange={(e) => setNewWidget({ ...newWidget, dataSource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  {dataSources.map(source => (
                    <option key={source.key} value={source.key}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowWidgetConfig(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addWidget}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add Widget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}