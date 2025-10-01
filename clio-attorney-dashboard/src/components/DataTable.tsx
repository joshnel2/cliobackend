import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Eye,
  Edit,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Clock,
  User,
  FileText
} from 'lucide-react'
import { apiClient } from '../lib/api'

interface DataTableProps {
  firmId: string | null
}

type DataView = 'attorneys' | 'matters' | 'bills' | 'time_entries' | 'payments'

interface TableColumn {
  key: string
  label: string
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean'
  sortable?: boolean
  filterable?: boolean
  width?: string
}

const dataViews = {
  attorneys: {
    name: 'Attorneys',
    icon: User,
    description: 'All attorneys in your firm',
    columns: [
      { key: 'id', label: 'ID', type: 'text', width: '80px' },
      { key: 'name', label: 'Name', type: 'text', sortable: true, filterable: true },
      { key: 'email', label: 'Email', type: 'text', sortable: true, filterable: true },
      { key: 'working_payout', label: 'Working Payout', type: 'currency', sortable: true },
      { key: 'originating_payout', label: 'Originating Payout', type: 'currency', sortable: true },
      { key: 'total_payout', label: 'Total Payout', type: 'currency', sortable: true },
    ] as TableColumn[]
  },
  matters: {
    name: 'Matters',
    icon: FileText,
    description: 'All matters and cases',
    columns: [
      { key: 'id', label: 'Matter ID', type: 'text', width: '100px' },
      { key: 'display_number', label: 'Matter #', type: 'text', sortable: true, filterable: true },
      { key: 'description', label: 'Description', type: 'text', sortable: true, filterable: true },
      { key: 'client_name', label: 'Client', type: 'text', sortable: true, filterable: true },
      { key: 'originating_attorney', label: 'Originating Attorney', type: 'text', sortable: true },
      { key: 'status', label: 'Status', type: 'text', sortable: true, filterable: true },
      { key: 'total_collected', label: 'Total Collected', type: 'currency', sortable: true },
    ] as TableColumn[]
  },
  bills: {
    name: 'Bills',
    icon: DollarSign,
    description: 'All billing records',
    columns: [
      { key: 'id', label: 'Bill ID', type: 'text', width: '100px' },
      { key: 'number', label: 'Bill #', type: 'text', sortable: true, filterable: true },
      { key: 'matter_name', label: 'Matter', type: 'text', sortable: true, filterable: true },
      { key: 'total', label: 'Amount', type: 'currency', sortable: true },
      { key: 'status', label: 'Status', type: 'text', sortable: true, filterable: true },
      { key: 'issued_at', label: 'Issued Date', type: 'date', sortable: true },
      { key: 'due_at', label: 'Due Date', type: 'date', sortable: true },
    ] as TableColumn[]
  },
  time_entries: {
    name: 'Time Entries',
    icon: Clock,
    description: 'All time tracking records',
    columns: [
      { key: 'id', label: 'Entry ID', type: 'text', width: '100px' },
      { key: 'date', label: 'Date', type: 'date', sortable: true },
      { key: 'attorney_name', label: 'Attorney', type: 'text', sortable: true, filterable: true },
      { key: 'matter_name', label: 'Matter', type: 'text', sortable: true, filterable: true },
      { key: 'quantity', label: 'Hours', type: 'number', sortable: true },
      { key: 'rate', label: 'Rate', type: 'currency', sortable: true },
      { key: 'total', label: 'Total', type: 'currency', sortable: true },
      { key: 'billable', label: 'Billable', type: 'boolean', filterable: true },
    ] as TableColumn[]
  },
  payments: {
    name: 'Payments',
    icon: DollarSign,
    description: 'All payment records',
    columns: [
      { key: 'id', label: 'Payment ID', type: 'text', width: '100px' },
      { key: 'date', label: 'Date', type: 'date', sortable: true },
      { key: 'matter_name', label: 'Matter', type: 'text', sortable: true, filterable: true },
      { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
      { key: 'method', label: 'Method', type: 'text', sortable: true, filterable: true },
      { key: 'status', label: 'Status', type: 'text', sortable: true, filterable: true },
    ] as TableColumn[]
  }
}

export default function DataTable({ firmId }: DataTableProps) {
  const [activeView, setActiveView] = useState<DataView>('attorneys')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const { data: rawData, isLoading, error, refetch } = useQuery({
    queryKey: ['dataTable', firmId, activeView],
    queryFn: () => {
      if (!firmId) return null
      
      switch (activeView) {
        case 'attorneys':
          return apiClient.getDashboardData(firmId).then(data => data.byAttorney)
        case 'matters':
          return apiClient.getDashboardData(firmId).then(data => data.matters)
        case 'bills':
          return apiClient.getBills(firmId)
        case 'time_entries':
          return apiClient.getTimeEntries(firmId)
        case 'payments':
          return apiClient.getPayments(firmId)
        default:
          return []
      }
    },
    enabled: !!firmId,
  })

  const currentView = dataViews[activeView]

  // Process and filter data
  const processedData = useMemo(() => {
    if (!rawData) return []

    let filtered = rawData.filter((item: any) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const searchableFields = currentView.columns
          .filter(col => col.filterable)
          .map(col => col.key)
        
        const matchesSearch = searchableFields.some(field => 
          String(item[field] || '').toLowerCase().includes(searchLower)
        )
        
        if (!matchesSearch) return false
      }

      // Column filters
      for (const [filterKey, filterValue] of Object.entries(filters)) {
        if (filterValue && String(item[filterKey] || '').toLowerCase() !== filterValue.toLowerCase()) {
          return false
        }
      }

      return true
    })

    // Sort data
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]
        
        let comparison = 0
        if (aVal < bVal) comparison = -1
        if (aVal > bVal) comparison = 1
        
        return sortDirection === 'desc' ? -comparison : comparison
      })
    }

    return filtered
  }, [rawData, searchTerm, filters, sortColumn, sortDirection, currentView])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return processedData.slice(startIndex, startIndex + pageSize)
  }, [processedData, currentPage, pageSize])

  const totalPages = Math.ceil(processedData.length / pageSize)

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const formatCellValue = (value: any, type: string) => {
    if (value === null || value === undefined) return '-'
    
    switch (type) {
      case 'currency':
        return `$${Number(value).toLocaleString()}`
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'boolean':
        return value ? 'Yes' : 'No'
      case 'number':
        return Number(value).toLocaleString()
      default:
        return String(value)
    }
  }

  const exportData = () => {
    const csv = [
      currentView.columns.map(col => col.label).join(','),
      ...processedData.map(row => 
        currentView.columns.map(col => 
          `"${formatCellValue(row[col.key], col.type)}"`
        ).join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentView.name.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(dataViews).map(([key, view]) => {
          const Icon = view.icon
          return (
            <button
              key={key}
              onClick={() => {
                setActiveView(key as DataView)
                setCurrentPage(1)
                setSearchTerm('')
                setFilters({})
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                activeView === key
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{view.name}</span>
            </button>
          )
        })}
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">{currentView.name}</h3>
              <p className="text-sm text-gray-600">{currentView.description}</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button
                onClick={exportData}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${currentView.name.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-600">
              <p>Error loading data. Please try again.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {currentView.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                      style={{ width: column.width }}
                      onClick={() => column.sortable && handleSort(column.key)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.sortable && (
                          <div className="flex flex-col">
                            <ChevronUp 
                              className={`h-3 w-3 ${
                                sortColumn === column.key && sortDirection === 'asc' 
                                  ? 'text-primary-600' 
                                  : 'text-gray-300'
                              }`} 
                            />
                            <ChevronDown 
                              className={`h-3 w-3 -mt-1 ${
                                sortColumn === column.key && sortDirection === 'desc' 
                                  ? 'text-primary-600' 
                                  : 'text-gray-300'
                              }`} 
                            />
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((row, index) => (
                  <tr key={row.id || index} className="hover:bg-gray-50">
                    {currentView.columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCellValue(row[column.key], column.type)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-primary-600 hover:text-primary-900">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} results
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 border rounded ${
                        currentPage === page
                          ? 'border-primary-500 bg-primary-50 text-primary-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}