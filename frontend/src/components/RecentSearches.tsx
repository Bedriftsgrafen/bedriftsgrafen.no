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
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">Siste søk</h2>
        <button
          onClick={clearRecentSearches}
          className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-all font-bold active:scale-95 uppercase tracking-wider"
        >
          Tøm
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentSearches.map((search) => (
          <button
            key={search.query}
            onClick={() => onSelectSearch(search.query)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-full border border-slate-200 hover:border-blue-200 transition-all text-sm font-medium active:scale-95"
            title={`Søkt ${formatDistanceToNow(search.timestamp)}${search.resultCount !== undefined ? ` • ${search.resultCount} treff` : ''}`}
          >
            {search.query}
          </button>
        ))}
      </div>
    </div>
  )
})
