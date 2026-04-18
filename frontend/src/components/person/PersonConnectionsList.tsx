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
        <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-gray-100 p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-lg bg-gray-100" />
                        <div className="flex-1">
                            <div className="h-4 w-40 bg-gray-100 rounded" />
                            <div className="h-3 w-24 bg-gray-50 rounded mt-2" />
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
            <div className="text-center py-12 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Ingen direkte forbindelser funnet</p>
                <p className="text-sm mt-1">Denne personen deler ingen aktive selskaper med andre</p>
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                    {connections.length} {connections.length === 1 ? 'forbindelse' : 'forbindelser'}
                </p>
                <button
                    onClick={() => setExpandAll(!expandAll)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
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
