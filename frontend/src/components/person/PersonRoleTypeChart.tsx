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
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Rolletyper</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString('nb-NO')} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => Number(value).toLocaleString('nb-NO')} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
})
