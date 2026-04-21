/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createLazyFileRoute('/personer')({
    component: PersonerRedirect,
})

function PersonerRedirect() {
    const navigate = useNavigate()
    const { q, sort, order, view } = Route.useSearch()

    useEffect(() => {
        navigate({
            to: '/person',
            search: {
                tab: 'sok' as const,
                ...(q !== undefined && { q }),
                ...(sort !== undefined && { sort }),
                ...(order !== undefined && { order }),
                ...(view !== undefined && { view }),
            },
            replace: true,
        })
    }, [navigate, q, sort, order, view])

    return null
}
