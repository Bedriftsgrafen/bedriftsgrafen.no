import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Company } from '../../types'

interface BankruptciesSectionProps {
  companies: Company[]
  regionName: string
  regionCode?: string
  regionType?: 'county' | 'municipality' | 'industry'
}

/**
 * Grid section showing recent bankruptcies in a region.
 * Links to full bankruptcy list filtered by region.
 */
export function BankruptciesSection({ 
  companies, 
  regionName,
  regionCode,
  regionType
}: BankruptciesSectionProps) {
  const searchParam = regionType === 'county' 
    ? { county: regionCode } 
    : regionType === 'industry'
    ? { nace: regionCode }
    : regionType === 'municipality'
    ? { municipality_code: regionCode }
    : {}

  return (
    <div className="mt-16">
      <section 
        className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden"
        aria-labelledby="bankruptcies-title"
      >
        <h3 
          id="bankruptcies-title"
          className="text-2xl font-black text-slate-900 mb-10 flex items-center justify-between"
        >
          <span className="flex items-center gap-4">Siste Konkurser</span>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">MELDINGER</span>
        </h3>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
          {companies.length > 0 ? (
            companies.map(company => (
              <li key={company.orgnr}>
                <Link
                  to="/virksomhet/$orgnr"
                  params={{ orgnr: company.orgnr }}
                  className="flex items-center justify-between p-6 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all group focus-visible:ring-2 focus-visible:ring-rose-600 outline-none hover:scale-[1.02]"
                  aria-label={`${company.navn}, konkurs ${company.konkursdato || 'nylig'}`}
                >
                  <div className="truncate mr-4">
                    <p className="text-slate-900 font-bold group-hover:text-rose-600 transition-colors truncate text-sm">
                      {company.navn}
                    </p>
                    <p className="text-rose-600 text-xs font-black uppercase tracking-tight mt-1">
                      Konkurs {company.konkursdato || 'nylig'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-rose-600 transition-all" aria-hidden="true" />
                </Link>
              </li>
            ))
          ) : (
            <li className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                Ingen nylige konkurser registrert
              </p>
            </li>
          )}
        </ul>

        <Link
          to="/konkurser"
          search={searchParam}
          className="flex items-center justify-center gap-3 p-6 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-rose-600 transition-all mt-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200 hover:bg-rose-50/50 hover:border-rose-200 focus-visible:ring-2 focus-visible:ring-rose-600 outline-none"
        >
          Se alle konkurser i {regionName}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
