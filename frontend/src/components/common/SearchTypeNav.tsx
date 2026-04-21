import { Link } from '@tanstack/react-router'
import { Building2, User } from 'lucide-react'

type SearchType = 'virksomheter' | 'personer'

interface SearchTypeNavProps {
    active: SearchType
    query?: string
}

export function SearchTypeNav({ active, query }: SearchTypeNavProps) {
    return (
        <nav className="flex gap-1 border-b border-gray-200 mb-4" aria-label="Søketype">
            <Link
                to="/utforsk"
                search={query ? { q: query } : {}}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    active === 'virksomheter'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-current={active === 'virksomheter' ? 'page' : undefined}
            >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Virksomheter
            </Link>
            <Link
                to="/person"
                search={query ? { tab: 'sok' as const, q: query } : { tab: 'sok' as const }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    active === 'personer'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-current={active === 'personer' ? 'page' : undefined}
            >
                <User className="h-4 w-4" aria-hidden="true" />
                Personer
            </Link>
        </nav>
    )
}
