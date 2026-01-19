import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// Search params schema - now includes tab for state persistence
const searchSchema = z.object({
    nace: z.string().optional(),
    tab: z.enum(['stats', 'search', 'map']).optional(),
    orgnr: z.string().optional(),
})

export const Route = createFileRoute('/bransjer')({
    validateSearch: searchSchema,
})
