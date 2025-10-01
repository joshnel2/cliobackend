import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, DollarSign, TrendingUp, Clock, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/api'

export default function AttorneyDetail() {
  const { id } = useParams<{ id: string }>()
  const { firmId } = useAuth()

  const { data: attorney, isLoading, error } = useQuery({
    queryKey: ['attorney', firmId, id],
    queryFn: () => firmId && id ? apiClient.getAttorneyDetail(firmId, id) : null,
    enabled: !!firmId && !!id,
  })

  const handleExport = async () => {
    if (!firmId || !id) return
    
    try {
      const blob = await apiClient.exportAttorneyData(firmId, id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `attorney-${attorney?.name || id}-${new Date().toISOString().split('T')[0]}.xlsx`
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

  if (error || !attorney) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">Failed to load attorney details. Please try again.</p>
      </div>
    )
  }

  const totalPayout = attorney.totalPayout || (attorney.working + attorney.originating + attorney.referral)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>
        
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Details
        </button>
      </div>

      {/* Attorney Info */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">{attorney.name}</h1>
          <p className="text-sm text-gray-500">Attorney ID: {attorney.id}</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-800">Originating</p>
                  <p className="text-2xl font-bold text-green-900">${attorney.originating.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-800">Working</p>
                  <p className="text-2xl font-bold text-blue-900">${attorney.working.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-purple-800">Referral</p>
                  <p className="text-2xl font-bold text-purple-900">${attorney.referral.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-gray-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-800">Total Payout</p>
                  <p className="text-2xl font-bold text-gray-900">${totalPayout.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Breakdown */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Payout Breakdown</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <span className="font-medium text-gray-900">Originating Attorney Fees</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-900">${attorney.originating.toLocaleString()}</div>
              <div className="text-sm text-gray-500">
                {totalPayout > 0 ? ((attorney.originating / totalPayout) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
              <span className="font-medium text-gray-900">Working Attorney Fees</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-900">${attorney.working.toLocaleString()}</div>
              <div className="text-sm text-gray-500">
                {totalPayout > 0 ? ((attorney.working / totalPayout) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-purple-500 rounded mr-3"></div>
              <span className="font-medium text-gray-900">Referral Fees</span>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-900">${attorney.referral.toLocaleString()}</div>
              <div className="text-sm text-gray-500">
                {totalPayout > 0 ? ((attorney.referral / totalPayout) * 100).toFixed(1) : 0}% of total
              </div>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Payout Distribution</span>
            <span>${totalPayout.toLocaleString()} total</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div className="flex h-4 rounded-full overflow-hidden">
              {attorney.originating > 0 && (
                <div 
                  className="bg-green-500"
                  style={{ width: `${(attorney.originating / totalPayout) * 100}%` }}
                />
              )}
              {attorney.working > 0 && (
                <div 
                  className="bg-blue-500"
                  style={{ width: `${(attorney.working / totalPayout) * 100}%` }}
                />
              )}
              {attorney.referral > 0 && (
                <div 
                  className="bg-purple-500"
                  style={{ width: `${(attorney.referral / totalPayout) * 100}%` }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h2>
        <div className="text-sm text-gray-600">
          <p>Detailed matter-by-matter breakdown and algorithm calculations are available in the exported Excel file.</p>
          <p className="mt-2">Click "Export Details" above to download a comprehensive report for this attorney.</p>
        </div>
      </div>
    </div>
  )
}