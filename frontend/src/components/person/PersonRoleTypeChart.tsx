import { memo, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { RoleTypeCount } from '../../types/person'

// Official BRREG role type codes → Norwegian labels
// Ref: https://data.brreg.no/enhetsregisteret/api/roller/rolletyper
const ROLE_LABELS: Record<string, string> = {
    DAGL: 'Daglig leder',
    LEDE: 'Styrets leder',
    MEDL: 'Styremedlem',
    VARA: 'Varamedlem',
    INNH: 'Innehaver',
    REGN: 'Regnskapsfører',
    REVI: 'Revisor',
    STYR: 'Styre',
    FFØR: 'Forretningsfører',
    DELT: 'Deltakere',
    KONT: 'Kontaktperson',
    KOMP: 'Komplementar',
    DTSO: 'Deltaker (solidarisk)',
    DTPR: 'Deltaker (proratarisk)',
    NEST: 'Nestleder',
    OBS: 'Observatør',
}

interface PersonRoleTypeChartProps {
    data: RoleTypeCount[]
}

interface RoleTypeTooltipProps {
    active?: boolean
    label?: string
    payload?: Array<{ value?: number }>
}

function RoleTypeTooltip({ active, label, payload }: RoleTypeTooltipProps) {
    if (!active || !payload?.length) return null

    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/40">
            <p className="font-semibold text-slate-900 dark:text-white">{label}</p>
            <p className="mt-1 font-semibold text-blue-700 dark:text-blue-200">
                count: {Number(payload[0].value ?? 0).toLocaleString('nb-NO')}
            </p>
        </div>
    )
}

export const PersonRoleTypeChart = memo(function PersonRoleTypeChart({ data }: PersonRoleTypeChartProps) {
    const chartData = useMemo(
        () => data.slice(0, 10).map(r => ({
            name: ROLE_LABELS[r.type_kode] || r.type_beskrivelse,
            count: r.count,
        })),
        [data]
    )

    if (chartData.length === 0) return null

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Rolletyper</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                    <XAxis
                        type="number"
                        tickFormatter={(v: number) => v.toLocaleString('nb-NO')}
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        axisLine={{ stroke: 'var(--chart-grid)' }}
                        tickLine={{ stroke: 'var(--chart-grid)' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                        axisLine={{ stroke: 'var(--chart-grid)' }}
                        tickLine={{ stroke: 'var(--chart-grid)' }}
                    />
                    <Tooltip
                        cursor={{ fill: 'var(--chart-cursor)' }}
                        content={<RoleTypeTooltip />}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
})
