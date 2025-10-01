import { Link } from 'react-router-dom'
import { DollarSign, TrendingUp, Clock, Users } from 'lucide-react'
import { AttorneyMetrics } from '../lib/api'

interface AttorneyCardProps {
  attorney: AttorneyMetrics
}

export default function AttorneyCard({ attorney }: AttorneyCardProps) {
  const totalPayout = attorney.totalPayout || (attorney.working + attorney.originating + attorney.referral)

  return (
    <Link
      to={`/attorney/${attorney.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 truncate">{attorney.name}</h3>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
            ${totalPayout.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
            Originating
          </div>
          <span className="text-sm font-medium text-gray-900">
            ${attorney.originating.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2 text-blue-500" />
            Working
          </div>
          <span className="text-sm font-medium text-gray-900">
            ${attorney.working.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-2 text-purple-500" />
            Referral
          </div>
          <span className="text-sm font-medium text-gray-900">
            ${attorney.referral.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar showing payout distribution */}
      <div className="mt-4">
        <div className="flex text-xs text-gray-500 mb-1">
          <span>Payout Breakdown</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="flex h-2 rounded-full overflow-hidden">
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
    </Link>
  )
}