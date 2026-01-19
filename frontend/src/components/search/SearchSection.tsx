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
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-900 via-blue-800 to-teal-900" />

      {/* Content */}
      <div className="relative z-10 p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          Søk i norske virksomheter
        </h2>
        <div className="relative max-w-2xl mx-auto">
          <input
            type="text"
            placeholder="Søk etter bedrift, org.nr, bransje eller formål..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-14 pr-32 py-4 rounded-xl border-0 focus:ring-4 focus:ring-blue-500/30 outline-none shadow-lg text-lg text-gray-900 placeholder-gray-500 bg-white"
          />
          <Search className="absolute left-5 top-4.5 h-6 w-6 text-gray-400" />
          <button
            onClick={handleSearchClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Søk
          </button>
        </div>
      </div>
    </div>
  )
}