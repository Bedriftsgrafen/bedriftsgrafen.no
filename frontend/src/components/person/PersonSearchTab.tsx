import { memo, useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { PersonSearchBar } from '../PersonSearchBar'

/**
 * Search tab wrapping the existing PersonSearchBar component.
 */
export const PersonSearchTab = memo(function PersonSearchTab() {
    const [query, setQuery] = useState('')
    const navigate = useNavigate()

    const handleSearch = useCallback((q: string) => {
        setQuery(q)
        if (q.trim()) {
            navigate({ to: '/personer', search: { q: q.trim() } })
        }
    }, [navigate])

    return (
        <div className="space-y-4">
            <p className="text-slate-600 text-sm">
                Søk etter personer med roller i norsk næringsliv.
            </p>
            <PersonSearchBar initialValue={query} onSearch={handleSearch} />
        </div>
    )
})
