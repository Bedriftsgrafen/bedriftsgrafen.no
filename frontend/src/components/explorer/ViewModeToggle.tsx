import { memo } from 'react'
import { List, LayoutGrid } from 'lucide-react'
import { useExplorerStore } from '../../store/explorerStore'

/**
 * Toggle button group for switching between list and card view.
 */
export const ViewModeToggle = memo(function ViewModeToggle() {
    const viewMode = useExplorerStore((s) => s.viewMode)
    const setViewMode = useExplorerStore((s) => s.setViewMode)

    return (
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                aria-pressed={viewMode === 'list'}
                aria-label="Listevisning"
                title="Listevisning"
            >
                <List className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Liste</span>
            </button>
            <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'cards'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                aria-pressed={viewMode === 'cards'}
                aria-label="Kortvisning"
                title="Kortvisning"
            >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Kort</span>
            </button>
        </div>
    )
})
