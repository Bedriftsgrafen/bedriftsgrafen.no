import { Link } from '@tanstack/react-router'
import { Building2, User } from 'lucide-react'

type SearchType = 'virksomheter' | 'personer'

interface SearchTypeNavProps {
    active: SearchType
    query?: string
}

const tabs = [
    { type: 'virksomheter' as const, label: 'Virksomheter', icon: Building2, to: '/utforsk' },
    { type: 'personer' as const, label: 'Personer', icon: User, to: '/personer' },
] as const

export function SearchTypeNav({ active, query }: SearchTypeNavProps) {
    return (
        <nav className="flex gap-1 border-b border-gray-200 mb-4" aria-label="Søketype">
            {tabs.map(({ type, label, icon: Icon, to }) => {
                const isActive = active === type
                return (
                    <Link
                        key={type}
                        to={to}
                        search={query ? { q: query } : {}}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            isActive
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                    </Link>
                )
            })}
        </nav>
    )
}
