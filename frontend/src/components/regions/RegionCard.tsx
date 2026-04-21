import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { MapPin, ChevronRight } from 'lucide-react'
import { formatNumber } from '../../utils/formatters'
import { getStaticMapUrl } from '../../utils/mapTiles'

export type RegionCardProps = {
  kind: 'fylke' | 'kommune'
  code: string              // "46" for fylke, "3240" for kommune
  name: string
  slug: string              // route param: "46-vestland" or "3240-eidsvoll"
  companyCount: number
  population?: number | null
  municipalityCount?: number // fylke only
  lat?: number | null
  lng?: number | null
}

export const RegionCard = memo(function RegionCard({
  kind,
  code,
  name,
  slug,
  companyCount,
  population,
  municipalityCount,
  lat,
  lng,
}: RegionCardProps) {
  const isFylke = kind === 'fylke'

  const mapZoom = isFylke ? 9 : 11

  const mapClass = isFylke
    ? 'absolute inset-0 opacity-60 group-hover:opacity-75 transition-opacity pointer-events-none bg-cover bg-center filter contrast-125 brightness-95'
    : 'absolute inset-0 opacity-75 group-hover:opacity-85 transition-opacity pointer-events-none bg-cover bg-center filter contrast-150 brightness-90'

  const mapOverlayClass = isFylke
    ? 'absolute inset-0 bg-linear-to-b from-white/30 via-white/10 to-white/40 pointer-events-none'
    : 'absolute inset-0 bg-linear-to-b from-white/15 via-white/5 to-white/25 pointer-events-none'

  return (
    <Link
      to={isFylke ? '/fylke/$code' : '/kommune/$code'}
      params={{ code: slug }}
      className={
        isFylke
          ? 'group bg-white rounded-2xl md:rounded-3xl p-6 md:p-10 border border-slate-200 hover:border-blue-200 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between relative overflow-hidden'
          : 'group bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 border border-slate-200 hover:border-blue-200 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between relative overflow-hidden'
      }
    >
      {/* Static Map Background */}
      {lat && lng && (
        <div
          data-testid={!isFylke ? `municipality-map-${code}` : undefined}
          className={mapClass}
          style={{ backgroundImage: `url(${getStaticMapUrl(lat, lng, mapZoom)})` }}
        />
      )}
      <div className={mapOverlayClass} />

      <div className="relative z-10">
        <div className={`flex items-center justify-between ${isFylke ? 'mb-4 md:mb-8' : 'mb-8'}`}>
          {/* Icon */}
          <div
            className={
              isFylke
                ? 'h-12 w-12 md:h-16 md:w-16 bg-slate-50/90 backdrop-blur-sm border border-slate-200/50 text-slate-400 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-300 shadow-sm'
                : 'h-14 w-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-300'
            }
          >
            {isFylke ? (
              <MapPin className="h-5 w-5 md:h-7 md:w-7" />
            ) : (
              <MapPin className="h-6 w-6" />
            )}
          </div>

          {/* Code badge */}
          {isFylke ? (
            <span className="text-[10px] font-black text-slate-500 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full group-hover:text-blue-600 group-hover:bg-blue-50/90 transition-colors tracking-[0.2em] uppercase">
              KODE {code}
            </span>
          ) : (
            <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600 transition-colors tracking-[0.2em] uppercase">
              {code}
            </span>
          )}
        </div>

        {/* Name */}
        <h2
          className={
            isFylke
              ? 'text-2xl md:text-3xl font-black text-slate-900 mb-3 group-hover:text-blue-700 transition-colors leading-tight tracking-tight drop-shadow-sm'
              : 'text-2xl font-black text-slate-900 mb-2 group-hover:text-blue-700 transition-colors leading-tight tracking-tight'
          }
        >
          {name}
        </h2>

        {/* Subtitle (fylke only) */}
        {isFylke && municipalityCount !== undefined && (
          <p className="text-slate-600 text-sm font-semibold">
            {municipalityCount === 1 ? '1 kommune' : `${municipalityCount} kommuner`}
          </p>
        )}

        {/* Accent bar */}
        <div
          className={
            isFylke
              ? 'h-1 w-8 bg-slate-200/80 rounded-full group-hover:w-12 group-hover:bg-blue-500 transition-all duration-300 mt-4'
              : 'h-1 w-8 bg-slate-100 rounded-full group-hover:w-12 group-hover:bg-blue-500 transition-all duration-300 mb-4'
          }
        />
      </div>

      {/* Footer stats */}
      {isFylke ? (
        <div className="mt-6 md:mt-10 pt-6 md:pt-8 border-t border-slate-200/50 grid grid-cols-2 gap-4 md:gap-6 relative z-10 bg-white/80 backdrop-blur-sm -mx-6 md:-mx-10 -mb-6 md:-mb-10 px-6 md:px-10 pb-6 md:pb-10 rounded-b-2xl md:rounded-b-3xl">
          <div className="flex flex-col">
            <span className="text-slate-900 font-black tabular-nums text-2xl tracking-tighter">
              {formatNumber(companyCount)}
            </span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
              Virksomheter
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-900 font-black tabular-nums text-2xl tracking-tighter">
              {population ? formatNumber(population) : '—'}
            </span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
              Innbyggere
            </span>
          </div>
          <div className="col-span-2 mt-6 flex items-center justify-center gap-2 text-blue-600 font-black uppercase text-[10px] tracking-widest group-hover:underline">
            Utforsk fylket
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      ) : (
        <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
          <div className="flex flex-col">
            <span className="text-slate-900 font-black tabular-nums text-xl tracking-tighter">
              {formatNumber(companyCount)}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Virksomheter
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-900 font-black tabular-nums text-xl tracking-tighter">
              {population != null ? formatNumber(population) : '—'}
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Innbyggere
            </span>
          </div>
        </div>
      )}
    </Link>
  )
})
