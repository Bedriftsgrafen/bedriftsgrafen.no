import type { ToplistCategory } from '../../types/person'
import { formatCurrency, formatNumber } from '../../utils/formatters'

/**
 * Categories whose values represent NOK amounts (formatted as currency).
 * All other categories are plain integer counts.
 */
export const CURRENCY_CATEGORIES = new Set<ToplistCategory>([
    'salgsinntekter',
    'total_profit',
])

/**
 * Format a toplist entry value according to its category.
 * - Currency categories: kr amounts (mrd/mill/K suffix)
 * - All others: plain integer with thousand separators
 */
export const formatCategoryValue = (category: ToplistCategory, value: number): string =>
    CURRENCY_CATEGORIES.has(category) ? formatCurrency(value) : formatNumber(value)
