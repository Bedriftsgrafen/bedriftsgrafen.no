import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
}

/** Get the actual theme based on system preference */
export function getResolvedTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'system') {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return 'light'
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
}

/** Apply theme class to document root */
export function applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') {
        return
    }

    const resolved = getResolvedTheme(theme)
    const root = document.documentElement

    if (resolved === 'dark') {
        root.classList.add('dark')
    } else {
        root.classList.remove('dark')
    }

    root.dataset.theme = resolved
    root.style.colorScheme = resolved
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'system',
            setTheme: (theme) => {
                set({ theme })
                applyTheme(theme)
            },
        }),
        {
            name: 'bedriftsgrafen-theme',
            onRehydrateStorage: () => (state) => {
                // Apply theme on app load
                if (state) {
                    applyTheme(state.theme)
                }
            },
        }
    )
)

// Listen for system preference changes
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const { theme } = useThemeStore.getState()
        if (theme === 'system') {
            applyTheme(theme)
        }
    })
}
