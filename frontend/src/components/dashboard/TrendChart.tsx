import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendPoint } from '../../types'

interface TrendChartProps {
  data: TrendPoint[]
  title: string
  subtitle?: string
  color?: string
  gradientId?: string
  className?: string
}

/**
 * Generic trend chart for dashboard metrics (Establishments, Bankruptcies, etc.)
 * Shows monthly data with gradient fill.
 */
export function TrendChart({ 
  data, 
  title,
  subtitle = "SISTE 12 MÅNEDER",
  color = "#2563eb", // Default blue
  gradientId = "colorValue",
  className = "lg:col-span-2"
}: TrendChartProps) {
  // Calculate summary for screen readers
  const total = data.reduce((sum, point) => sum + point.value, 0)
  const avg = data.length > 0 ? Math.round(total / data.length) : 0
  
  return (
    <section 
      className={`${className} bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden`}
      aria-label={`${title} trend chart`}
    >
      <div className="flex items-center justify-between mb-12">
        <h2 
          className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tight"
        >
          <div className="h-10 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
          {title}
        </h2>
        <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{subtitle}</div>
      </div>
      {/* Screen reader summary of chart data */}
      <p className="sr-only">
        Graf viser {data.length} måneder med data for {title}. 
        Totalt {total.toLocaleString('no-NO')}, 
        gjennomsnitt {avg.toLocaleString('no-NO')} per måned.
      </p>
      <div className="h-[350px] w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
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
              stroke={color}
              strokeWidth={4}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 8, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

/**
 * Legacy wrapper for backward compatibility
 */
export function EstablishmentTrendChart(props: Omit<TrendChartProps, 'title' | 'color' | 'gradientId'>) {
  return <TrendChart {...props} title="Nyetableringer" color="#22c55e" gradientId="colorEstablishments" />
}