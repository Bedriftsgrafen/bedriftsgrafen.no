import { useState } from 'react'
import { Users } from 'lucide-react'
import type { PersonConnection } from '../../types/person'
import { PersonConnectionCard } from './PersonConnectionCard'

interface PersonConnectionsListProps {
    connections: PersonConnection[]
    isLoading: boolean
    personName: string
}

function LoadingSkeleton() {
    return (
        <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-5 dark:border-slate-800">
                    <div className="flex items-start gap-4">
                        <div className="h-11 w-11 rounded-lg bg-gray-100 dark:bg-slate-800" />
                        <div className="flex-1">
                            <div className="h-4 w-40 rounded bg-gray-100 dark:bg-slate-800" />
                            <div className="mt-2 h-3 w-24 rounded bg-gray-50 dark:bg-slate-900" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

export function PersonConnectionsList({ connections, isLoading, personName }: PersonConnectionsListProps) {
    const [expandAll, setExpandAll] = useState(false)

    if (isLoading) return <LoadingSkeleton />

    if (connections.length === 0) {
        return (
            <div className="py-12 text-center text-gray-400 dark:text-slate-500">
                <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p className="text-lg font-medium">Ingen direkte forbindelser funnet</p>
                <p className="mt-1 text-sm">Denne personen deler ingen aktive selskaper med andre</p>
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    {connections.length} {connections.length === 1 ? 'forbindelse' : 'forbindelser'}
                </p>
                <button
                    onClick={() => setExpandAll(!expandAll)}
                    className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                >
                    {expandAll ? 'Lukk alle' : 'Ekspander alle'}
                </button>
            </div>
            <div className="space-y-3">
                {connections.map((connection) => (
                    <PersonConnectionCard
                        key={`${connection.name}-${connection.birth_year}-${expandAll}`}
                        connection={connection}
                        defaultExpanded={expandAll}
                        personName={personName}
                    />
                ))}
            </div>
        </div>
    )
}
