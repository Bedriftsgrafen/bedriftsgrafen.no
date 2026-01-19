import { createFileRoute } from '@tanstack/react-router'

import { z } from 'zod'

const konkurserSearchSchema = z.object({
    period: z.enum(['30d', '90d', '1y']).optional().catch('1y'),
})

export type KonkurserSearch = z.infer<typeof konkurserSearchSchema>

export const Route = createFileRoute('/konkurser')({
    validateSearch: (search) => konkurserSearchSchema.parse(search),
})
