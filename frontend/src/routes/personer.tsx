import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
    q: z.string().optional(),
})

export const Route = createFileRoute('/personer')({
    validateSearch: searchSchema,
})
