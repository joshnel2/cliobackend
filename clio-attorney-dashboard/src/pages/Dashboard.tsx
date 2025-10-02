import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Download,
  Calendar,
  Filter,
  Search
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiClient, AttorneyMetrics } from '../lib/api'
import AttorneyCard from '../components/AttorneyCard'
import PayoutChart from '../components/PayoutChart'
import MattersList from '../components/MattersList'

export default function Dashboard() {
  const { firmId } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'totalPayout' | 'originating' | 'working'>('totalPayout')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard', firmId],
    queryFn: () => firmId ? apiClient.getDashboardData(firmId) : null,
    enabled: !!firmId,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  const handleExport = async () => {
    if (!firmId) return
    
    try {
      const blob = await apiClient.exportAllData(firmId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `attorney-payouts-${firmId}-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">Failed to load dashboard data. Please try refreshing the page.</p>
      </div>
    )
  }

  // Filter and sort attorneys
  const filteredAttorneys = dashboardData.byAttorney
    .filter(attorney => 
      attorney.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy] || 0
      const bValue = b[sortBy] || 0
      
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      }
      
      return sortOrder === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })

  const totalPayout = dashboardData.byAttorney.reduce((sum, attorney) => 
    sum + (attorney.totalPayout || attorney.working + attorney.originating + attorney.referral), 0
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Attorneys</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData.totals.attorneys}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Payouts</p>
              <p className="text-2xl font-bold text-gray-900">${totalPayout.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Originating</p>
              <p className="text-2xl font-bold text-gray-900">${dashboardData.totals.originating.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Working</p>
              <p className="text-2xl font-bold text-gray-900">${dashboardData.totals.working.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Payout Distribution</h2>
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export All
          </button>
        </div>
        <PayoutChart data={filteredAttorneys} />
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search attorneys..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="totalPayout">Total Payout</option>
              <option value="name">Name</option>
              <option value="originating">Originating</option>
              <option value="working">Working</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Attorneys Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAttorneys.map((attorney) => (
            <AttorneyCard key={attorney.id} attorney={attorney} />
          ))}
        </div>

        {filteredAttorneys.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No attorneys found matching your search.</p>
          </div>
        )}
      </div>

      {/* Recent Matters */}
      {dashboardData.matters && dashboardData.matters.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Recent Matters</h2>
          <MattersList matters={dashboardData.matters.slice(0, 10)} />
        </div>
      )}
    </div>
  )
}