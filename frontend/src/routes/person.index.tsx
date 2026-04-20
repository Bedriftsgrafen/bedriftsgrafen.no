import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
    tab: z.enum(['oversikt', 'topplister', 'sok']).optional(),
    category: z.string().optional(),
    q: z.string().optional(),
    sort: z.enum(['role_count', 'active_roles', 'name']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    view: z.enum(['cards', 'list']).optional(),
})

export const Route = createFileRoute('/person/')({
    validateSearch: searchSchema,
})
