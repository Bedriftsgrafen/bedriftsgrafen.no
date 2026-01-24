import { memo, useMemo } from 'react'
import { Users, TrendingUp, PiggyBank, MapPin, Gem, Calendar, History } from 'lucide-react'
import { Company } from '../types'
import { getOrganizationFormLabel } from '../utils/organizationForms'
import { ComparisonButton } from './comparison'
import { FavoriteButton } from './FavoriteButton'

/** Props for CompanyCard component */
interface CompanyCardProps {
    company: Company
    onClick: () => void
}

/** Format large numbers as millions with M suffix */
function formatMillions(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-'
    return `${(value / 1_000_000).toFixed(1)} M`
}

/**
 * Card component displaying company summary data.
 * Used in card view mode of the explorer.
 */
export const CompanyCard = memo(function CompanyCard({ company, onClick }: CompanyCardProps) {
    const orgFormLabel = getOrganizationFormLabel(company.organisasjonsform)
    const kommune = company.forretningsadresse?.kommune || company.postadresse?.kommune
    const industry = company.naeringskoder?.[0]?.beskrivelse || company.naeringskode

    // Smart Badges Logic
    const badges = useMemo(() => {
        const list = []

        // 💎 Solid Badge: Equity ratio > 20%
        if (company.latest_equity_ratio !== null && company.latest_equity_ratio !== undefined) {
            if (company.latest_equity_ratio >= 0.2) {
                list.push({
                    id: 'solid',
                    label: 'Solid',
                    icon: Gem,
                    className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    title: `Solid økonomi (Egenkapitalandel: ${(company.latest_equity_ratio * 100).toFixed(1)}%)`
                })
            }
        }

        // 🆕 New Badge: Established in the last 12 months
        if (company.stiftelsesdato) {
            const stiftelse = new Date(company.stiftelsesdato)
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

            if (stiftelse > oneYearAgo) {
                list.push({
                    id: 'new',
                    label: 'Ny',
                    icon: Calendar,
                    className: 'bg-blue-50 text-blue-700 border-blue-100',
                    title: `Nyetablert (Stiftet: ${new Intl.DateTimeFormat('nb-NO').format(stiftelse)})`
                })
            }

            // 🏛️ Established Badge: > 20 years old
            const twentyYearsAgo = new Date()
            twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20)
            if (stiftelse < twentyYearsAgo) {
                list.push({
                    id: 'veteran',
                    label: 'Etablert',
                    icon: History,
                    className: 'bg-slate-50 text-slate-700 border-slate-100',
                    title: `Veletablert selskap (Stiftet: ${stiftelse.getFullYear()})`
                })
            }
        }

        return list
    }, [company.latest_equity_ratio, company.stiftelsesdato])

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-xl hover:border-blue-200 transition-all duration-300 cursor-pointer group active:scale-[0.98]"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {company.navn || 'Ukjent navn'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Org.nr: {company.orgnr}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <FavoriteButton
                        orgnr={company.orgnr}
                        navn={company.navn ?? 'Ukjent'}
                        organisasjonsform={company.organisasjonsform}
                        compact
                    />
                    <ComparisonButton orgnr={company.orgnr} navn={company.navn ?? 'Ukjent'} compact />
                    <span
                        className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors uppercase tracking-wider"
                        title={orgFormLabel}
                    >
                        {company.organisasjonsform}
                    </span>
                </div>
            </div>

            {/* Smart Badges Row */}
            {badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {badges.map((badge) => (
                        <div
                            key={badge.id}
                            title={badge.title}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-tight ${badge.className}`}
                        >
                            <badge.icon className="h-3 w-3" />
                            {badge.label}
                        </div>
                    ))}
                </div>
            )}

            {/* Industry */}
            {industry && (
                <p className="text-[11px] font-medium text-slate-500 truncate mb-3" title={industry}>
                    {industry}
                </p>
            )}

            {/* Purpose snippet if available - Important for search discovery */}
            {company.vedtektsfestet_formaal && (
                <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed italic border-l-2 border-slate-100 pl-2">
                    {company.vedtektsfestet_formaal}
                </p>
            )}

            {/* Location */}
            {kommune && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {kommune}
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                        <TrendingUp className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-medium text-gray-900 tabular-nums">
                        {formatMillions(company.latest_revenue)}
                    </p>
                    <p className="text-[10px] text-gray-500">Omsetning</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                        <PiggyBank className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-medium text-gray-900 tabular-nums">
                        {formatMillions(company.latest_profit)}
                    </p>
                    <p className="text-[10px] text-gray-500">Resultat</p>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                        <Users className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                    </div>
                    <p className="text-xs font-medium text-gray-900 tabular-nums">
                        {company.antall_ansatte ?? '-'}
                    </p>
                    <p className="text-[10px] text-gray-500">Ansatte</p>
                </div>
            </div>
        </div>
    )
})
