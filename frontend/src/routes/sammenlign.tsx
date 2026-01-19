import { createFileRoute } from '@tanstack/react-router'

// Search params schema for the route
interface ComparisonSearchParams {
    orgnr?: string // Comma-separated org numbers: "123456789,987654321"
}

export const Route = createFileRoute('/sammenlign')({
    validateSearch: (search: Record<string, unknown>): ComparisonSearchParams => {
        return {
            orgnr: typeof search.orgnr === 'string' ? search.orgnr : undefined
        }
    }
})
