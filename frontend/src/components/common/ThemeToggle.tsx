import { memo } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore, type Theme } from '../../store/themeStore'

const ICONS = {
    light: <Sun className="h-4 w-4" aria-hidden="true" />,
    dark: <Moon className="h-4 w-4" aria-hidden="true" />,
    system: <Monitor className="h-4 w-4" aria-hidden="true" />,
} as const

const LABELS: Record<Theme, string> = {
    light: 'Lyst',
    dark: 'Mørkt',
    system: 'Auto',
}

/**
 * Theme toggle button cycling through light → dark → system.
 */
export const ThemeToggle = memo(function ThemeToggle() {
    const theme = useThemeStore((s) => s.theme)
    const setTheme = useThemeStore((s) => s.setTheme)

    const handleClick = () => {
        const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
        setTheme(next)
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950"
            title={`Tema: ${LABELS[theme]}`}
            aria-label={`Bytt tema (nåværende: ${LABELS[theme]})`}
        >
            {ICONS[theme]}
            <span className="hidden sm:inline">{LABELS[theme]}</span>
        </button>
    )
})
