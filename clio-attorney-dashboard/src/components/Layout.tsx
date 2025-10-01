import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  BarChart3, 
  Users, 
  Settings, 
  LogOut, 
  DollarSign,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { firmId, logout } = useAuth()
  const location = useLocation()

  const { data: dashboardData, refetch, isLoading } = useQuery({
    queryKey: ['dashboard', firmId],
    queryFn: () => firmId ? apiClient.getDashboardData(firmId) : null,
    enabled: !!firmId,
  })

  const navigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3 },
    { name: 'Attorneys', href: '/attorneys', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const handleRefresh = () => {
    refetch()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <DollarSign className="h-8 w-8 text-primary-600" />
          <span className="ml-2 text-xl font-bold text-gray-900">
            Attorney Payouts
          </span>
        </div>

        <nav className="mt-8 px-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Firm Info & Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="mb-4">
            <p className="text-xs text-gray-500">Firm ID</p>
            <p className="text-sm font-medium text-gray-900">{firmId}</p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Sync
            </button>
            
            <button
              onClick={logout}
              className="flex items-center justify-center px-3 py-2 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                Attorney Payout Dashboard
              </h1>
              
              {dashboardData && (
                <div className="flex items-center space-x-6 text-sm text-gray-500">
                  <span>Last updated: {new Date(dashboardData.generatedAt).toLocaleString()}</span>
                  <span className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {dashboardData.totals.attorneys} attorneys
                  </span>
                  <span className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    ${dashboardData.totals.totalPayout?.toLocaleString() || '0'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}