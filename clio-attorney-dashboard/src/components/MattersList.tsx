import { DollarSign, Users, FileText } from 'lucide-react'
import { MatterSplit } from '../lib/api'

interface MattersListProps {
  matters: MatterSplit[]
}

export default function MattersList({ matters }: MattersListProps) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Matter
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Collected
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Originator
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Working Attorneys
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Distribution
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {matters.map((matter) => {
              const originator = matter.shares.find(s => s.role === 'originator')
              const workers = matter.shares.filter(s => s.role === 'working')
              const originatorAmount = originator?.amount || 0
              const workersTotal = workers.reduce((sum, w) => sum + (w.amount || 0), 0)

              return (
                <tr key={matter.matterId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {matter.matterName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {matter.matterId}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-sm font-medium text-gray-900">
                        ${matter.totalCollected.toLocaleString()}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {originator ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {originator.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ${originatorAmount.toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No originator</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {workers.length > 0 ? (
                      <div className="space-y-1">
                        {workers.slice(0, 2).map((worker, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="text-gray-900">{worker.name}</span>
                            <span className="text-gray-500 ml-2">
                              ${(worker.amount || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {workers.length > 2 && (
                          <div className="text-xs text-gray-400">
                            +{workers.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No working attorneys</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        {originatorAmount > 0 && (
                          <div 
                            className="bg-green-500"
                            style={{ width: `${(originatorAmount / matter.totalCollected) * 100}%` }}
                            title={`Originator: ${((originatorAmount / matter.totalCollected) * 100).toFixed(1)}%`}
                          />
                        )}
                        {workersTotal > 0 && (
                          <div 
                            className="bg-blue-500"
                            style={{ width: `${(workersTotal / matter.totalCollected) * 100}%` }}
                            title={`Workers: ${((workersTotal / matter.totalCollected) * 100).toFixed(1)}%`}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{((originatorAmount / matter.totalCollected) * 100).toFixed(0)}%</span>
                      <span>{((workersTotal / matter.totalCollected) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {matters.length === 0 && (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No matters found</p>
        </div>
      )}
    </div>
  )
}