import { Link } from '@tanstack/react-router'
import { ChevronRight, MapPin } from 'lucide-react'
import { Company } from '../../types'
import { formatLargeCurrency } from '../../utils/formatters'

interface TopCompanyListProps {
  companies: Company[]
  title?: string
  subtitle?: string
}

/**
 * Ranked list of top companies by revenue.
 * Used in both county and municipality dashboards.
 */
export function TopCompanyList({ 
  companies, 
  title = "Største Virksomheter",
  subtitle = "ETTER OMSETNING"
}: TopCompanyListProps) {
  return (
    <section aria-labelledby="top-companies-title">
      <h3 
        id="top-companies-title"
        className="text-2xl font-black text-slate-900 mb-10 flex items-center justify-between px-2"
      >
        <span className="flex items-center gap-4">{title}</span>
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{subtitle}</span>
      </h3>
      <ul className="space-y-4" role="list">
        {companies.map((company, idx) => (
          <li key={company.orgnr}>
            <Link
              to="/bedrift/$orgnr"
              params={{ orgnr: company.orgnr }}
              className="flex items-center justify-between p-6 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 rounded-3xl transition-all group shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 outline-none hover:scale-[1.01]"
              aria-label={`${idx + 1}. plass: ${company.navn}${company.latest_revenue ? ` - omsetning ${formatLargeCurrency(company.latest_revenue)}` : ''}`}
            >
              <div className="flex items-center gap-8 min-w-0">
                <span className="text-slate-200 font-black text-3xl tabular-nums w-12 group-hover:text-blue-100" aria-hidden="true">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <div className="truncate">
                  <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate text-base tracking-tight">
                    {company.navn}
                  </p>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                    {company.organisasjonsform} • {company.orgnr}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {company.latest_revenue && (
                  <div className="flex flex-col items-end">
                    <p className="text-slate-900 font-black tabular-nums text-base">
                      {formatLargeCurrency(company.latest_revenue)}
                    </p>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-tighter mt-1">OMSETNING</p>
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface NewestCompaniesListProps {
  companies: Company[]
  regionName: string
  regionCode: string
  regionType: 'county' | 'municipality'
  title?: string
  subtitle?: string
}

/**
 * List of newest company registrations with founding dates.
 * Links to full list filtered by region.
 */
export function NewestCompaniesList({ 
  companies, 
  regionName,
  regionCode,
  regionType,
  title = "Siste Nyetableringer",
  subtitle = "ETTER DATO"
}: NewestCompaniesListProps) {
  const searchParam = regionType === 'county' 
    ? { county: regionCode } 
    : { municipality_code: regionCode }
    
  return (
    <section aria-labelledby="newest-companies-title">
      <h3 
        id="newest-companies-title"
        className="text-2xl font-black text-slate-900 mb-10 flex items-center justify-between px-2"
      >
        <span className="flex items-center gap-4">{title}</span>
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{subtitle}</span>
      </h3>
      <ul className="space-y-4" role="list">
        {companies.map(company => (
          <li key={company.orgnr}>
            <Link
              to="/bedrift/$orgnr"
              params={{ orgnr: company.orgnr }}
              className="flex items-center justify-between p-6 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 rounded-3xl transition-all group shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 outline-none hover:scale-[1.01]"
              aria-label={`${company.navn}, stiftet ${new Date(company.stiftelsesdato || '').toLocaleDateString('no-NO', { day: '2-digit', month: 'long', year: 'numeric' })}`}
            >
              <div className="flex items-center gap-8 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center font-black text-xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="truncate">
                  <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate text-base tracking-tight">
                    {company.navn}
                  </p>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                    Stiftet {new Date(company.stiftelsesdato || '').toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/nyetableringer"
        search={searchParam}
        className="flex items-center justify-center gap-3 p-6 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-blue-600 transition-all mt-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 hover:bg-blue-50/50 hover:border-blue-200 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
      >
        Se alle nyetableringer i {regionName}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
