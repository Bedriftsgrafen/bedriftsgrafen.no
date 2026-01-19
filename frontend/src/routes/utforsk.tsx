import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// Search params schema - accepts q for text search
const searchSchema = z.object({
    q: z.string().optional(),
})

export const Route = createFileRoute('/utforsk')({
    validateSearch: searchSchema,
})
