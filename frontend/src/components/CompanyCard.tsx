import { memo, useMemo } from 'react'
import { Users, TrendingUp, PiggyBank, MapPin, Gem, Calendar, History } from 'lucide-react'
import { Company } from '../types'
import { normalizeText } from '../utils/formatters'
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
    const industry = useMemo(() => {
        if (company.naeringskoder?.[0]?.beskrivelse) {
            return company.naeringskoder[0].beskrivelse
        }
        if (typeof company.naeringskode === 'object' && company.naeringskode !== null) {
            return company.naeringskode.beskrivelse
        }
        return company.naeringskode
    }, [company.naeringskoder, company.naeringskode])

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
                    className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/20',
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
                    className: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-400/20',
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
                    className: 'bg-slate-50 text-slate-700 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                    title: `Veletablert virksomhet (Stiftet: ${stiftelse.getFullYear()})`
                })
            }
        }

        return list
    }, [company.latest_equity_ratio, company.stiftelsesdato])

    const openCompanyLabel = `Åpne ${company.navn || 'Ukjent navn'} (${company.orgnr})`

    return (
        <div className="group min-w-0 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:border-blue-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/30 dark:hover:shadow-black/30">
            <div className="flex items-start justify-between gap-2">
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={openCompanyLabel}
                    className="min-w-0 flex-1 rounded-lg text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                >
                    {/* Header */}
                    <div className="mb-2 min-w-0">
                        <h3 className="truncate font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">
                            {company.navn || 'Ukjent navn'}
                        </h3>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                            Org.nr: {company.orgnr}
                        </p>
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
                                    <badge.icon className="h-3 w-3" aria-hidden="true" />
                                    {badge.label}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Industry */}
                    {industry && (
                        <p className="mb-3 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400" title={industry}>
                            {industry}
                        </p>
                    )}

                    {/* Purpose snippet if available - Important for search discovery */}
                    {company.vedtektsfestet_formaal && (
                        <p className="mb-3 line-clamp-2 border-l-2 border-slate-100 pl-2 text-[11px] italic leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            {normalizeText(company.vedtektsfestet_formaal)}
                        </p>
                    )}

                    {/* Location */}
                    {kommune && (
                        <div className="mb-3 flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {kommune}
                        </div>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 dark:border-slate-800">
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                                <TrendingUp className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                            </div>
                            <p className="text-xs font-medium tabular-nums text-gray-900 dark:text-slate-100">
                                {formatMillions(company.latest_revenue)}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-slate-500">Omsetning</p>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                                <PiggyBank className="h-3.5 w-3.5 text-purple-500" aria-hidden="true" />
                            </div>
                            <p className="text-xs font-medium tabular-nums text-gray-900 dark:text-slate-100">
                                {formatMillions(company.latest_profit)}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-slate-500">Resultat</p>
                        </div>
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                                <Users className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
                            </div>
                            <p className="text-xs font-medium tabular-nums text-gray-900 dark:text-slate-100">
                                {company.antall_ansatte ?? '-'}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-slate-500">Ansatte</p>
                        </div>
                    </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                    <FavoriteButton
                        orgnr={company.orgnr}
                        navn={company.navn ?? 'Ukjent'}
                        organisasjonsform={company.organisasjonsform}
                        compact
                    />
                    <ComparisonButton orgnr={company.orgnr} navn={company.navn ?? 'Ukjent'} compact />
                    <span
                        className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-500/15 dark:group-hover:text-blue-200"
                        title={orgFormLabel}
                    >
                        {company.organisasjonsform}
                    </span>
                </div>
            </div>
        </div>
    )
})
