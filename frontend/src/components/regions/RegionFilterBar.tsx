import { memo, type RefObject } from 'react'
import { Search } from 'lucide-react'

export type Segment = 'all' | 'fylker' | 'kommuner'

export type RegionFilterBarProps = {
  searchQuery: string
  segment: Segment
  onSearchChange: (q: string) => void
  onSegmentChange: (s: Segment) => void
  searchRef: RefObject<HTMLInputElement | null>
}

export const RegionFilterBar = memo(function RegionFilterBar({
  searchQuery,
  segment,
  onSearchChange,
  onSegmentChange,
  searchRef,
}: RegionFilterBarProps) {
  const segmentBtnClass = (s: Segment) =>
    `px-5 py-2 rounded-xl text-sm font-bold transition-all ${
      segment === s
        ? 'bg-blue-600 text-white shadow-md'
        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600'
    }`

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-12">
      {/* Search bar */}
      <div className="relative flex-1 group">
        <input
          ref={searchRef}
          type="text"
          placeholder="Søk på fylke eller kommune..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Søk etter region"
          data-testid="region-search-input"
          className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none shadow-sm transition-all text-lg font-medium"
        />
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
      </div>

      {/* Segment toggle – desktop */}
      <div className="hidden md:flex gap-2 items-center" role="group" aria-label="Vis type">
        <button
          className={segmentBtnClass('all')}
          onClick={() => onSegmentChange('all')}
          data-testid="segment-all"
        >
          Alle
        </button>
        <button
          className={segmentBtnClass('fylker')}
          onClick={() => onSegmentChange('fylker')}
          data-testid="segment-fylker"
        >
          Fylker
        </button>
        <button
          className={segmentBtnClass('kommuner')}
          onClick={() => onSegmentChange('kommuner')}
          data-testid="segment-kommuner"
        >
          Kommuner
        </button>
      </div>

      {/* Segment toggle – mobile */}
      <select
        className="md:hidden w-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none shadow-sm text-lg font-medium appearance-none"
        value={segment}
        onChange={e => onSegmentChange(e.target.value as Segment)}
        aria-label="Vis type"
        data-testid="segment-select"
      >
        <option value="all">Alle regioner</option>
        <option value="fylker">Bare fylker</option>
        <option value="kommuner">Bare kommuner</option>
      </select>
    </div>
  )
})
