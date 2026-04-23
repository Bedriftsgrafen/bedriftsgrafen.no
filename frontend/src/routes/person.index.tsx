import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
    tab: z.enum(['oversikt', 'topplister', 'sok']).optional().catch(undefined),
    category: z.string().optional(),
    q: z.string().optional(),
    sort: z.enum(['role_count', 'active_roles', 'name']).optional().catch(undefined),
    order: z.enum(['asc', 'desc']).optional().catch(undefined),
    view: z.enum(['cards', 'list']).optional().catch(undefined),
    page: z.number().optional().catch(undefined),
})

export const Route = createFileRoute('/person/')({
    validateSearch: searchSchema,
})
