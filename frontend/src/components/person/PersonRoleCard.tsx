import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { Building2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import type { PersonRole, CompanySparklineData } from '../../types/person'
import { formatLargeCurrency, formatPercentValue } from '../../utils/formatters'
import { PersonRoleSparkline } from './PersonRoleSparkline'

interface PersonRoleCardProps {
    role: PersonRole
    sparkline?: CompanySparklineData
}

function resultIndicator(value: number | null) {
    if (value === null) return null
    if (value >= 0) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />
    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
}

export const PersonRoleCard = memo(function PersonRoleCard({ role, sparkline }: PersonRoleCardProps) {
    const isInactive = role.fratraadt || role.konkurs || role.under_avvikling

    return (
        <div
            className={`group p-5 rounded-xl border bg-white hover:shadow-md transition-all flex items-start justify-between gap-4 ${
                isInactive ? 'border-gray-200 opacity-75' : 'border-gray-100 hover:border-blue-200'
            }`}
        >
            <div className="flex items-start gap-4 min-w-0 flex-1">
                <div
                    className={`p-3 rounded-lg shrink-0 transition-colors ${
                        isInactive
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                    }`}
                >
                    <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                            {role.enhet_navn}
                        </h3>
                        {role.organisasjonsform && (
                            <span className="text-xs text-gray-400 font-medium">{role.organisasjonsform}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 flex-wrap">
                        <span className="font-medium text-blue-600/80 bg-blue-50 px-2 py-0.5 rounded">
                            {role.type_beskrivelse}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span>Orgnr: {role.orgnr}</span>
                        {role.fratraadt && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span className="text-red-500 font-medium">Fratrådt</span>
                            </>
                        )}
                        {role.konkurs && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span className="text-red-600 font-semibold">Konkurs</span>
                            </>
                        )}
                        {role.under_avvikling && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span className="text-orange-500 font-medium">Under avvikling</span>
                            </>
                        )}
                    </div>

                    {/* Financial snippet — only shown when data exists */}
                    {role.latest_aar !== null && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                            <span className="text-gray-300">{role.latest_aar}:</span>
                            {role.latest_salgsinntekter !== null && (
                                <span>Omsetning {formatLargeCurrency(role.latest_salgsinntekter)}</span>
                            )}
                            {role.latest_aarsresultat !== null && (
                                <span className="flex items-center gap-1">
                                    {resultIndicator(role.latest_aarsresultat)}
                                    Resultat {formatLargeCurrency(role.latest_aarsresultat)}
                                </span>
                            )}
                            {role.latest_egenkapitalandel !== null && (
                                <span>EK-andel {formatPercentValue(role.latest_egenkapitalandel)}</span>
                            )}
                        </div>
                    )}

                    {role.antall_ansatte !== null && role.antall_ansatte > 0 && (
                        <span className="inline-block mt-1.5 text-xs text-gray-400">
                            {role.antall_ansatte} ansatte
                        </span>
                    )}

                    {sparkline && sparkline.data_points.length > 0 && (
                        <div className="mt-2">
                            <PersonRoleSparkline dataPoints={sparkline.data_points} />
                        </div>
                    )}
                </div>
            </div>

            <Link
                to="/virksomhet/$orgnr"
                params={{ orgnr: role.orgnr }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all shrink-0"
                title="Se virksomhetsprofil"
                aria-label={`Se virksomhetsprofil for ${role.enhet_navn}`}
            >
                <ExternalLink className="h-5 w-5" />
            </Link>
        </div>
    )
})
