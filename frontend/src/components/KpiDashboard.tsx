import { memo } from 'react'
import { AccountingWithKpis } from '../types'
import { formatNOK, formatPercent, formatLargeNumber, getKpiDescription, getKpiColor } from '../utils/formatters'

interface Props {
  data: AccountingWithKpis
}

export const KpiDashboard = memo(function KpiDashboard({ data }: Props) {
  const kpiEntries = Object.entries(data.kpis || {})

  return (
    <div className="space-y-4">
      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="text-sm text-gray-500">Salgsinntekter</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatNOK(data.salgsinntekter)}</div>
          <div className="text-xs text-gray-400 mt-1 tabular-nums">{formatLargeNumber(data.salgsinntekter)}</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="text-sm text-gray-500">Årsresultat</div>
          <div className={`text-2xl font-bold tabular-nums ${(data.aarsresultat || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatNOK(data.aarsresultat)}
          </div>
          <div className="text-xs text-gray-400 mt-1 tabular-nums">{formatLargeNumber(data.aarsresultat)}</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="text-sm text-gray-500">Egenkapital</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{formatNOK(data.egenkapital)}</div>
          <div className="text-xs text-gray-400 mt-1 tabular-nums">{formatLargeNumber(data.egenkapital)}</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiEntries.map(([key, value]) => {
          const { name, description } = getKpiDescription(key)
          const color = getKpiColor(key, value)

          return (
            <div key={key} className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-medium text-gray-700">{name}</div>
                  <div className={`text-3xl font-bold mt-1 tabular-nums ${color}`}>
                    {key.includes('margin') || key.includes('grad') || key.includes('andel') || key.includes('rentabilitet')
                      ? formatPercent(value, 1)
                      : formatLargeNumber(value)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">{description}</div>
            </div>
          )
        })}
      </div>

      {/* Detailed Financial Data */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 border-b border-blue-100 bg-blue-50">
          <h3 className="font-semibold text-gray-900">Detaljert Regnskap</h3>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 text-gray-600">Driftsresultat</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatNOK(data.driftsresultat)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Avskrivninger</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatNOK(data.avskrivninger)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Omløpsmidler</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatNOK(data.omloepsmidler)}</td>
              </tr>
              <tr>
                <td className="py-2 text-gray-600">Kortsiktig gjeld</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatNOK(data.kortsiktig_gjeld)}</td>
              </tr>
              {data.gjeldsgrad !== null && (
                <tr>
                  <td className="py-2 text-gray-600">Gjeldsgrad</td>
                  <td className="py-2 text-right font-medium tabular-nums">{data.gjeldsgrad.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})
