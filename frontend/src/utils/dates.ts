/**
 * Date utility functions
 */

/**
 * Get date string for one year ago (YYYY-MM-DD format)
 */
export function getOneYearAgo(): string {
    return getDaysAgo(365)
}

/**
 * Get date string for N days ago (YYYY-MM-DD format)
 */
export function getDaysAgo(days: number): string {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
}

/**
 * Get starting date for a given period shortcut
 */
export function getStartingDate(period: '30d' | '90d' | '1y'): string {
    switch (period) {
        case '30d':
            return getDaysAgo(30)
        case '90d':
            return getDaysAgo(90)
        case '1y':
        default:
            return getOneYearAgo()
    }
}

/**
 * Get date string for N months ago (YYYY-MM-DD format)
 */
export function getMonthsAgo(months: number): string {
    const date = new Date()
    date.setMonth(date.getMonth() - months)
    return date.toISOString().split('T')[0]
}

/**
 * Format date to Norwegian display format (DD.MM.YYYY)
 */
export function formatDateNorwegian(date: Date | string | null): string {
    if (!date) return '—'
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('nb-NO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(d)
}

/**
 * Format month for display: "2024-01" -> "Jan 24"
 */
export function formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']
    const monthIndex = parseInt(month, 10) - 1
    return `${monthNames[monthIndex]} ${year.slice(2)}`
}
