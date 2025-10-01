import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useState } from 'react'
import { AttorneyMetrics } from '../lib/api'

interface PayoutChartProps {
  data: AttorneyMetrics[]
}

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444']

export default function PayoutChart({ data }: PayoutChartProps) {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

  // Prepare data for charts
  const chartData = data.map(attorney => ({
    name: attorney.name.length > 15 ? attorney.name.substring(0, 15) + '...' : attorney.name,
    fullName: attorney.name,
    originating: attorney.originating,
    working: attorney.working,
    referral: attorney.referral,
    total: attorney.totalPayout || (attorney.originating + attorney.working + attorney.referral)
  }))

  // Prepare pie chart data (top 10 attorneys by total payout)
  const pieData = chartData
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((attorney, index) => ({
      name: attorney.name,
      value: attorney.total,
      color: COLORS[index % COLORS.length]
    }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.fullName}</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm text-green-600">
              Originating: ${data.originating.toLocaleString()}
            </p>
            <p className="text-sm text-blue-600">
              Working: ${data.working.toLocaleString()}
            </p>
            <p className="text-sm text-purple-600">
              Referral: ${data.referral.toLocaleString()}
            </p>
            <p className="text-sm font-medium text-gray-900 border-t pt-1">
              Total: ${data.total.toLocaleString()}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.payload.name}</p>
          <p className="text-sm text-gray-600">
            ${data.value.toLocaleString()} ({((data.value / pieData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div>
      {/* Chart Type Toggle */}
      <div className="flex justify-end mb-4">
        <div className="inline-flex rounded-md shadow-sm">
          <button
            onClick={() => setChartType('bar')}
            className={`px-4 py-2 text-sm font-medium border ${
              chartType === 'bar'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } rounded-l-md`}
          >
            Bar Chart
          </button>
          <button
            onClick={() => setChartType('pie')}
            className={`px-4 py-2 text-sm font-medium border-t border-b border-r ${
              chartType === 'pie'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } rounded-r-md`}
          >
            Pie Chart
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div style={{ width: '100%', height: '400px' }}>
        {chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="originating" stackId="a" fill="#10b981" name="Originating" />
              <Bar dataKey="working" stackId="a" fill="#3b82f6" name="Working" />
              <Bar dataKey="referral" stackId="a" fill="#8b5cf6" name="Referral" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Highest Payout</p>
          <p className="text-lg font-bold text-gray-900">
            ${Math.max(...chartData.map(d => d.total)).toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Average Payout</p>
          <p className="text-lg font-bold text-gray-900">
            ${Math.round(chartData.reduce((sum, d) => sum + d.total, 0) / chartData.length).toLocaleString()}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Payouts</p>
          <p className="text-lg font-bold text-gray-900">
            ${chartData.reduce((sum, d) => sum + d.total, 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}