import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Save, RefreshCw, Key, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/api'

export default function Settings() {
  const { firmId } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const { data: envStatus, isLoading, refetch } = useQuery({
    queryKey: ['environment', firmId],
    queryFn: () => firmId ? apiClient.checkEnvironment(firmId) : null,
    enabled: !!firmId,
  })

  const handleTestConnection = async () => {
    if (!firmId) return
    
    setIsSaving(true)
    try {
      await refetch()
      setSaveMessage('Connection test completed successfully!')
    } catch (error) {
      setSaveMessage('Connection test failed. Please check your configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOAuthSetup = async () => {
    if (!firmId) return
    
    try {
      const result = await apiClient.startOAuth(firmId)
      if (result.authUrl) {
        window.open(result.authUrl, '_blank')
      }
    } catch (error) {
      setSaveMessage('Failed to start OAuth setup. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your Clio integration and payout algorithms</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Connection Status</h2>
        
        {envStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">Clio Client ID</span>
                <div className="flex items-center">
                  {envStatus.env.CLIO_CLIENT_ID ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">Clio Client Secret</span>
                <div className="flex items-center">
                  {envStatus.env.CLIO_CLIENT_SECRET ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">Redirect URI</span>
                <div className="flex items-center">
                  {envStatus.redirectHostMatch === true ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">KV Storage</span>
                <div className="flex items-center">
                  {envStatus.env.KV_REST_API_URL_set && envStatus.env.KV_REST_API_TOKEN_set ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleTestConnection}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
                Test Connection
              </button>

              <button
                onClick={handleOAuthSetup}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Key className="h-4 w-4 mr-2" />
                Setup OAuth
              </button>
            </div>

            {saveMessage && (
              <div className={`p-3 rounded-md ${
                saveMessage.includes('successfully') 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {saveMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">API Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clio Base URL
            </label>
            <input
              type="text"
              value={envStatus?.env.CLIO_BASE_URL || 'https://app.clio.com'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              This is configured on the server side
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Firm ID
            </label>
            <input
              type="text"
              value={firmId || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>
        </div>
      </div>

      {/* Payout Algorithms */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Payout Algorithms</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Algorithm Configuration</h3>
              <p className="text-sm text-blue-700 mt-1">
                Payout algorithms are currently using placeholder calculations. 
                Contact your administrator to configure custom algorithms for:
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>Originating attorney percentages</li>
                <li>Working attorney fee structures</li>
                <li>Referral fee calculations</li>
                <li>Matter-specific overrides</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>Current algorithm status:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Originating fees: Placeholder (15% of collected)</li>
            <li>Working fees: Placeholder (30% of billed time)</li>
            <li>Referral fees: Placeholder (10% of referred matters)</li>
          </ul>
        </div>
      </div>

      {/* Data Sync */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Data Synchronization</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Automatic Sync</h3>
              <p className="text-sm text-gray-600">Data is automatically synced every 5 minutes</p>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Manual Sync</h3>
              <p className="text-sm text-gray-600">Click the sync button in the sidebar to refresh data</p>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}