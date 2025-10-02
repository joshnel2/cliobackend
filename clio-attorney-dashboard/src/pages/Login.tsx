import { useState } from 'react'
import { DollarSign, Key, Building2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/api'

export default function Login() {
  const [firmId, setFirmId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firmId.trim()) {
      setError('Please enter a Firm ID')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Check if the environment is properly configured
      const envCheck = await apiClient.checkEnvironment(firmId.trim())
      
      if (!envCheck.ok) {
        throw new Error('Environment check failed')
      }

      // If environment is good, proceed with login
      login(firmId.trim())
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check your Firm ID and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSetup = async () => {
    if (!firmId.trim()) {
      setError('Please enter a Firm ID first')
      return
    }

    try {
      const result = await apiClient.startOAuth(firmId.trim())
      if (result.authUrl) {
        window.location.href = result.authUrl
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start OAuth setup')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
            <DollarSign className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Attorney Payouts</h1>
          <p className="text-gray-600 mt-2">Connect your Clio account to get started</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="firmId" className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="inline h-4 w-4 mr-1" />
                Firm ID
              </label>
              <input
                id="firmId"
                type="text"
                value={firmId}
                onChange={(e) => setFirmId(e.target.value)}
                placeholder="Enter your Clio Firm ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                This is typically your organization name or ID from Clio
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Connect to Dashboard'
                )}
              </button>

              <button
                type="button"
                onClick={handleOAuthSetup}
                className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Key className="h-4 w-4 mr-2" />
                Setup Clio OAuth
              </button>
            </div>
          </form>

          {/* Setup Instructions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">First time setup?</h3>
            <div className="text-xs text-gray-600 space-y-2">
              <p>1. Click "Setup Clio OAuth" to authorize this application</p>
              <p>2. You'll be redirected to Clio to grant permissions</p>
              <p>3. Return here and enter your Firm ID to access the dashboard</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-gray-500">
          <p>Secure connection to Clio API • Data stays in your control</p>
        </div>
      </div>
    </div>
  )
}