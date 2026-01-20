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
    <div className="bg-white rounded-xl shadow-md border border-slate-200 mb-8 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-linear-to-br from-slate-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-slate-900">Siste søk</h2>
        </div>
        <button
          onClick={clearRecentSearches}
          className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all font-bold active:scale-95 uppercase tracking-wider"
        >
          Tøm
        </button>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {recentSearches.map((search) => (
          <button
            key={search.query}
            onClick={() => onSelectSearch(search.query)}
            className="group flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl border border-slate-100 hover:border-blue-100 transition-all text-sm font-medium active:scale-95 shadow-sm hover:shadow-md"
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
