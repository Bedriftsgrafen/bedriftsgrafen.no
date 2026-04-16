import { SectorStat } from '../../types'

interface SectorDistributionProps {
  sectors: SectorStat[]
  title?: string
}

/**
 * Grid showing top sectors/industries in a region with progress bars.
 */
export function SectorDistribution({ 
  sectors, 
  title = "Største Bransjer" 
}: SectorDistributionProps) {
  return (
    <section 
      className="lg:col-span-2 bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden group"
      aria-labelledby="sector-distribution-title"
    >
      <h2 
        id="sector-distribution-title"
        className="text-xl md:text-3xl font-black text-slate-900 mb-6 md:mb-12 flex items-center gap-3 md:gap-4 tracking-tight"
      >
        <div className="h-10 w-2 bg-blue-600 rounded-full" aria-hidden="true" />
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-12 gap-y-6 md:gap-y-8">
        {sectors.map(sector => {
          const percentValue = sector.percentage_of_total ?? 0
          return (
            <div key={sector.nace_division} className="relative">
              <div className="flex justify-between items-center mb-3">
                <span 
                  id={`sector-${sector.nace_division}-label`}
                  className="text-slate-600 font-black text-xs uppercase tracking-widest truncate max-w-[80%]"
                >
                  {sector.nace_name}
                </span>
                <span className="text-slate-900 font-black tabular-nums text-sm" aria-hidden="true">
                  {percentValue.toFixed(1)}%
                </span>
              </div>
              <div 
                className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(percentValue)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-labelledby={`sector-${sector.nace_division}-label`}
              >
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${percentValue}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
