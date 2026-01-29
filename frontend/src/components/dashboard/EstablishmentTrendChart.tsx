import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendPoint } from '../../types'

interface EstablishmentTrendChartProps {
  data: TrendPoint[]
  title?: string
  subtitle?: string
}

/**
 * Shared establishment trend chart for county and municipality dashboards.
 * Shows monthly new company registrations with gradient fill.
 */
export function EstablishmentTrendChart({ 
  data, 
  title = "Nyetableringer",
  subtitle = "SISTE 12 MÅNEDER"
}: EstablishmentTrendChartProps) {
  // Calculate summary for screen readers
  const total = data.reduce((sum, point) => sum + point.value, 0)
  const avg = data.length > 0 ? Math.round(total / data.length) : 0
  
  return (
    <section 
      className="lg:col-span-2 bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden"
      aria-labelledby="establishment-trend-title"
    >
      <div className="flex items-center justify-between mb-12">
        <h2 
          id="establishment-trend-title"
          className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tight"
        >
          <div className="h-10 w-2 bg-blue-600 rounded-full" aria-hidden="true" />
          {title}
        </h2>
        <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{subtitle}</div>
      </div>
      {/* Screen reader summary of chart data */}
      <p className="sr-only">
        Graf viser {data.length} måneder med nyetableringer. 
        Totalt {total.toLocaleString('no-NO')} nye virksomheter, 
        gjennomsnitt {avg.toLocaleString('no-NO')} per måned.
      </p>
      <div className="h-[350px] w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
              dy={15}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
            />
            <Tooltip
              contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={{ r: 8, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
