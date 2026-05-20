import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { formatNumber } from '../../utils/formatters'

interface PaginationProps {
  currentPage: number
  totalCount?: number
  itemsPerPage: number
  currentItemsCount: number
  onPreviousPage: () => void
  onNextPage: () => void
  onPageChange?: (page: number) => void
  itemLabel?: string
}

/**
 * Generate smart page numbers with ellipsis
 * Example: [1, '...', 5, 6, 7, 8, 9, '...', 100]
 */
function generatePageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = []

  // Always show first page
  pages.push(1)

  if (totalPages <= 7) {
    // Show all pages if total is small
    for (let i = 2; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // Show smart range with ellipsis
    const showLeftEllipsis = currentPage > 4
    const showRightEllipsis = currentPage < totalPages - 3

    if (showLeftEllipsis) {
      pages.push('ellipsis-start')
    }

    // Determine range around current page
    let startPage = Math.max(2, currentPage - 2)
    let endPage = Math.min(totalPages - 1, currentPage + 2)

    // Adjust if we're near the start or end
    if (currentPage <= 4) {
      startPage = 2
      endPage = 6
    } else if (currentPage >= totalPages - 3) {
      startPage = totalPages - 5
      endPage = totalPages - 1
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    if (showRightEllipsis) {
      pages.push('ellipsis-end')
    }

    // Always show last page (if more than 1 page)
    if (totalPages > 1) {
      pages.push(totalPages)
    }
  }

  return pages
}

export function Pagination({
  currentPage,
  totalCount,
  itemsPerPage,
  currentItemsCount,
  onPreviousPage,
  onNextPage,
  onPageChange,
  itemLabel = 'virksomheter'
}: PaginationProps) {
  // Memoize pagination calculations
  const { start, end, isFirstPage, isLastPage, totalPages, pageNumbers } = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage + 1
    const count = totalCount ?? 0
    const endIdx = Math.min(startIdx + currentItemsCount - 1, count)
    const total = count > 0 ? Math.ceil(count / itemsPerPage) : 1

    return {
      start: startIdx,
      end: endIdx,
      isFirstPage: currentPage === 1,
      isLastPage: currentPage >= total,
      totalPages: total,
      pageNumbers: generatePageNumbers(currentPage, total)
    }
  }, [currentPage, itemsPerPage, currentItemsCount, totalCount])

  const handlePageClick = (page: number) => {
    if (onPageChange && page !== currentPage) {
      onPageChange(page)
    }
  }

  const handleFirstPage = () => {
    if (onPageChange && currentPage !== 1) {
      onPageChange(1)
    }
  }

  const handleLastPage = () => {
    if (onPageChange && currentPage !== totalPages) {
      onPageChange(totalPages)
    }
  }

  return (
    <nav className="mt-6 space-y-3" aria-label={`Paginering for ${itemLabel}`}>
      {/* Info text */}
      <p className="text-sm text-gray-600 text-center" aria-live="polite">
        {totalCount !== undefined ? (
          <>Viser {start}-{end} av {formatNumber(totalCount)} {itemLabel}</>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
            Teller {itemLabel}...
          </span>
        )}
      </p>

      {/* Pagination controls */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {/* First page button */}
        <button
          onClick={handleFirstPage}
          disabled={isFirstPage}
          className="p-2.5 sm:p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Første side"
          title="Første side"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Previous button */}
        <button
          onClick={onPreviousPage}
          disabled={isFirstPage}
          className="p-2.5 sm:p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Forrige side"
          title="Forrige side"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page) => {
            if (page === 'ellipsis-start' || page === 'ellipsis-end') {
              return (
                <span
                  key={`ellipsis-${page}`}
                  className="px-3 py-2 text-gray-500"
                  aria-hidden="true"
                >
                  ...
                </span>
              )
            }

            const isActive = page === currentPage

            return (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                className={`
                  min-w-11 sm:min-w-10 min-h-11 sm:min-h-0 px-3 py-2.5 sm:py-2 rounded-lg border transition-colors
                  ${isActive
                    ? 'bg-blue-900 text-white border-blue-900 font-medium hover:bg-blue-800'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }
                `}
                aria-label={`Side ${page}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {page}
              </button>
            )
          })}
        </div>

        {/* Next button */}
        <button
          onClick={onNextPage}
          disabled={isLastPage}
          className="p-2.5 sm:p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Neste side"
          title="Neste side"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Last page button */}
        <button
          onClick={handleLastPage}
          disabled={isLastPage}
          className="p-2.5 sm:p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Siste side"
          title="Siste side"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
