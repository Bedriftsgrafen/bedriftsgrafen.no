import type { KeyboardEvent } from 'react'
import { Search } from 'lucide-react'

interface SearchSectionProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
}

/**
 * Hero search section with background image
 * Accepts search queries or 9-digit Norwegian organization numbers.
 * Organization numbers are handled directly by onSearch callback (which opens modal).
 */
export function SearchSection({ value, onChange, onSearch }: SearchSectionProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchClick()
    }
  }

  const handleSearchClick = () => {
    if (value) {
      // Pass to parent; parent decides if it's orgnr or search query
      onSearch(value)
    }
  }

  return (
    <div className="my-8 rounded-2xl shadow-xl text-center relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0 bg-linear-to-br from-blue-900 via-blue-800 to-teal-900" />

      {/* Content */}
      <div className="relative z-10 p-10">
        <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-wider text-shadow-sm">
          Søk i norske virksomheter
        </h2>
        <div className="relative max-w-2xl mx-auto group">
          <input
            type="text"
            placeholder="Søk etter bedrift, org.nr, bransje eller formål..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-14 pr-32 py-4.5 rounded-xl border-0 focus:ring-4 focus:ring-blue-500/20 outline-none shadow-2xl text-lg text-slate-900 placeholder-slate-400 bg-white transition-all"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
          <button
            onClick={handleSearchClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-8 py-2.5 bg-linear-to-br from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold shadow-lg shadow-blue-500/20 active:scale-95"
          >
            Søk
          </button>
        </div>
      </div>
    </div>
  )
}