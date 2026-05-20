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
    ? 'absolute inset-0 bg-cover bg-center opacity-60 contrast-125 brightness-95 transition-opacity pointer-events-none group-hover:opacity-75 dark:opacity-40 dark:brightness-75 dark:contrast-110 dark:saturate-75 dark:group-hover:opacity-50'
    : 'absolute inset-0 bg-cover bg-center opacity-75 contrast-150 brightness-90 transition-opacity pointer-events-none group-hover:opacity-85 dark:opacity-50 dark:brightness-75 dark:contrast-110 dark:saturate-75 dark:group-hover:opacity-60'

  const mapOverlayClass = isFylke
    ? 'absolute inset-0 bg-linear-to-b from-white/30 via-white/10 to-white/40 pointer-events-none dark:from-slate-950/85 dark:via-slate-900/55 dark:to-slate-950/88'
    : 'absolute inset-0 bg-linear-to-b from-white/15 via-white/5 to-white/25 pointer-events-none dark:from-slate-950/80 dark:via-slate-900/45 dark:to-slate-950/82'

  return (
    <Link
      to={isFylke ? '/fylke/$code' : '/kommune/$code'}
      params={{ code: slug }}
      className={
        isFylke
          ? 'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/35 dark:hover:shadow-black/40 md:rounded-3xl md:p-10'
          : 'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/35 dark:hover:shadow-black/40 md:rounded-3xl md:p-8'
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
                ? 'flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200/50 bg-slate-50/90 text-slate-500 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:border-blue-800 group-hover:bg-blue-900 group-hover:text-white dark:border-slate-700/70 dark:bg-slate-900/85 dark:text-slate-300 dark:group-hover:border-blue-400 dark:group-hover:bg-blue-500 dark:group-hover:text-slate-950 md:h-16 md:w-16 md:rounded-2xl'
                : 'flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500 transition-all duration-300 group-hover:border-blue-800 group-hover:bg-blue-900 group-hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:border-blue-400 dark:group-hover:bg-blue-500 dark:group-hover:text-slate-950'
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
            <span className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 backdrop-blur-sm transition-colors group-hover:bg-blue-50/90 group-hover:text-blue-600 dark:bg-slate-950/82 dark:text-slate-200 dark:ring-1 dark:ring-white/10 dark:group-hover:bg-blue-500/18 dark:group-hover:text-blue-100">
              KODE {code}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-200">
              {code}
            </span>
          )}
        </div>

        {/* Name */}
        <h2
          className={
            isFylke
              ? 'mb-3 text-2xl font-black leading-tight tracking-tight text-slate-900 drop-shadow-sm transition-colors group-hover:text-blue-700 dark:text-white dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] dark:group-hover:text-blue-200 md:text-3xl'
              : 'mb-2 text-2xl font-black leading-tight tracking-tight text-slate-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-200'
          }
        >
          {name}
        </h2>

        {/* Subtitle (fylke only) */}
        {isFylke && municipalityCount !== undefined && (
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {municipalityCount === 1 ? '1 kommune' : `${municipalityCount} kommuner`}
          </p>
        )}

        {/* Accent bar */}
        <div
          className={
            isFylke
              ? 'mt-4 h-1 w-8 rounded-full bg-slate-300 transition-all duration-300 group-hover:w-12 group-hover:bg-blue-900 dark:bg-slate-600 dark:group-hover:bg-blue-300'
              : 'mb-4 h-1 w-8 rounded-full bg-slate-200 transition-all duration-300 group-hover:w-12 group-hover:bg-blue-900 dark:bg-slate-700 dark:group-hover:bg-blue-300'
          }
        />
      </div>

      {/* Footer stats */}
      {isFylke ? (
        <div className="relative z-10 -mx-6 -mb-6 mt-6 grid grid-cols-2 gap-4 rounded-b-2xl border-t border-slate-200/50 bg-white/88 px-6 pb-6 pt-6 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/86 md:-mx-10 md:-mb-10 md:mt-10 md:gap-6 md:rounded-b-3xl md:px-10 md:pb-10 md:pt-8">
          <div className="flex flex-col">
            <span className="tabular-nums text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
              {formatNumber(companyCount)}
            </span>
            <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Virksomheter
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="tabular-nums text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
              {population ? formatNumber(population) : '—'}
            </span>
            <span className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Innbyggere
            </span>
          </div>
          <div className="col-span-2 mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 group-hover:underline dark:text-blue-300">
            Utforsk fylket
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      ) : (
        <div className="relative z-10 mt-8 flex items-center justify-between border-t border-slate-100 pt-8 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="tabular-nums text-xl font-black tracking-tighter text-slate-900 dark:text-white">
              {formatNumber(companyCount)}
            </span>
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Virksomheter
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="tabular-nums text-xl font-black tracking-tighter text-slate-900 dark:text-white">
              {population != null ? formatNumber(population) : '—'}
            </span>
            <span className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              Innbyggere
            </span>
          </div>
        </div>
      )}
    </Link>
  )
})
