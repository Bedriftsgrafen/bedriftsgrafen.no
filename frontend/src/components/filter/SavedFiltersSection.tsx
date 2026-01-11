import type { KeyboardEvent } from 'react'
import { Bookmark, Save, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '../common/Button'
import { formatDistanceToNow } from '../../utils/formatters'
import { type SavedFilter, countActiveFilters } from '../../store/savedFiltersStore'

interface SavedFiltersSectionProps {
  savedFilters: SavedFilter[]
  showSaveInput: boolean
  saveFilterName: string
  editingFilterId: string | null
  onShowSaveInput: () => void
  onHideSaveInput: () => void
  onSaveFilterNameChange: (name: string) => void
  onSaveFilter: () => void
  onLoadFilter: (filter: SavedFilter) => void
  onUpdateFilter: (filterId: string, filterName: string) => void
  onDeleteFilter: (filterId: string) => void
}

export function SavedFiltersSection({
  savedFilters,
  showSaveInput,
  saveFilterName,
  editingFilterId,
  onShowSaveInput,
  onHideSaveInput,
  onSaveFilterNameChange,
  onSaveFilter,
  onLoadFilter,
  onUpdateFilter,
  onDeleteFilter
}: SavedFiltersSectionProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSaveFilter()
    if (e.key === 'Escape') {
      onHideSaveInput()
      onSaveFilterNameChange('')
    }
  }

  // Show section if there are filters or input is shown
  if (savedFilters.length === 0 && !showSaveInput) {
    return (
      <div className="mb-6 pb-6 border-b border-gray-200">
        <Button
          onClick={onShowSaveInput}
          variant="secondary"
          className="text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
        >
          Lagre nåværende filter
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-6 pb-6 border-b border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-800">Lagrede filtre</span>
        </div>
        {!showSaveInput && (
          <Button
            onClick={onShowSaveInput}
            variant="secondary"
            className="text-green-700 bg-green-50 border-green-200 hover:bg-green-100 flex items-center gap-0.5"
            size="sm"
            leftIcon={<Save className="h-3.5 w-3.5" />}
          >
            Lagre nåværende
          </Button>
        )}
      </div>

      {/* Save new filter input */}
      {showSaveInput && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Gi filteret et navn..."
            value={saveFilterName}
            onChange={(e) => onSaveFilterNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            autoFocus
          />
          <Button
            onClick={onSaveFilter}
            disabled={!saveFilterName.trim()}
            variant="primary"
            className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
            size="sm"
          >
            Lagre
          </Button>
          <Button
            onClick={() => {
              onHideSaveInput()
              onSaveFilterNameChange('')
            }}
            variant="ghost"
            size="sm"
          >
            Avbryt
          </Button>
        </div>
      )}

      {/* Saved filter chips */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedFilters.map((filter) => {
            const isEditing = editingFilterId === filter.id
            return (
              <div
                key={filter.id}
                className={`group flex items-center gap-1 pl-3 pr-1 py-1.5 border rounded-lg transition-colors ${isEditing
                  ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-300'
                  : 'bg-purple-50 hover:bg-purple-100 border-purple-200'
                  }`}
              >
                <button
                  onClick={() => onLoadFilter(filter)}
                  className="text-sm text-purple-700 font-medium"
                  title={`${countActiveFilters(filter.filters)} filtre • Lagret ${formatDistanceToNow(filter.createdAt)}`}
                >
                  {filter.name}
                </button>
                <span className="text-xs text-purple-500 px-1">
                  ({countActiveFilters(filter.filters)})
                </span>
                {isEditing && (
                  <button
                    onClick={() => onUpdateFilter(filter.id, filter.name)}
                    className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                    title="Oppdater filter med nåværende verdier"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDeleteFilter(filter.id)}
                  className="p-1 text-purple-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Slett filter"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
