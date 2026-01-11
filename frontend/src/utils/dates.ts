/**
 * Date utility functions
 */

/**
 * Get date string for one year ago (YYYY-MM-DD format)
 */
export function getOneYearAgo(): string {
    const date = new Date()
    date.setFullYear(date.getFullYear() - 1)
    return date.toISOString().split('T')[0]
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
