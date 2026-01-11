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
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 border border-white/10 backdrop-blur-sm rounded-lg transition-all duration-200"
            title={`Tema: ${LABELS[theme]}`}
            aria-label={`Bytt tema (nåværende: ${LABELS[theme]})`}
        >
            {ICONS[theme]}
            <span className="hidden sm:inline">{LABELS[theme]}</span>
        </button>
    )
})
