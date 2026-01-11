import { useMemo } from 'react'
import { CompanyWithAccounting } from '../types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatNOK, formatLargeNumber } from '../utils/formatters'
import { prepareFinancialChartData, CHART_COLORS } from '../utils/chartTransformers'

interface Props {
  company: CompanyWithAccounting
}

export function CompanyCharts({ company }: Props) {
  // Use transformer for data preparation - component only handles rendering
  const chartData = useMemo(
    () => prepareFinancialChartData(company.regnskap),
    [company.regnskap]
  )

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        Ingen regnskapsdata tilgjengelig
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Revenue and Profit Chart */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Inntekt og Resultat</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(value) => formatLargeNumber(value)} />
            <Tooltip
              formatter={(value) => formatNOK(value as number)}
              labelStyle={{ color: '#333' }}
            />
            <Legend />
            <Bar dataKey="inntekt" fill={CHART_COLORS.revenue} name="Salgsinntekter" />
            <Bar dataKey="resultat" fill={CHART_COLORS.profit} name="Årsresultat" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Equity Trend */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Egenkapital Utvikling</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis tickFormatter={(value) => formatLargeNumber(value)} />
            <Tooltip
              formatter={(value) => formatNOK(value as number)}
              labelStyle={{ color: '#333' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="egenkapital"
              stroke={CHART_COLORS.equity}
              strokeWidth={2}
              name="Egenkapital"
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
