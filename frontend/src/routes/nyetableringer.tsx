import { createFileRoute } from '@tanstack/react-router'

import { z } from 'zod'

const nyetableringerSearchSchema = z.object({
    period: z.enum(['30d', '90d', '1y']).optional().catch('1y'),
})

export type NyetableringerSearch = z.infer<typeof nyetableringerSearchSchema>

export const Route = createFileRoute('/nyetableringer')({
    validateSearch: (search) => nyetableringerSearchSchema.parse(search),
})
