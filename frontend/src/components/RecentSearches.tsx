import { Search, Clock } from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { formatDistanceToNow } from '../utils/formatters'
import { memo } from 'react'

interface RecentSearchesProps {
  onSelectSearch: (query: string) => void
}

export const RecentSearches = memo(function RecentSearches({ onSelectSearch }: RecentSearchesProps) {
  const recentSearches = useUiStore(s => s.recentSearches)
  const clearRecentSearches = useUiStore(s => s.clearRecentSearches)

  if (recentSearches.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8">
      <div className="p-4 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Siste søk</h2>
        </div>
        <button
          onClick={clearRecentSearches}
          className="text-sm px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-lg transition-colors font-medium"
        >
          Tøm
        </button>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {recentSearches.map((search) => (
          <button
            key={search.query}
            onClick={() => onSelectSearch(search.query)}
            className="group flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full transition-colors text-sm"
            title={`Søkt ${formatDistanceToNow(search.timestamp)}${search.resultCount !== undefined ? ` • ${search.resultCount} treff` : ''}`}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="max-w-[200px] truncate">{search.query}</span>
          </button>
        ))}
      </div>
    </div>
  )
})
