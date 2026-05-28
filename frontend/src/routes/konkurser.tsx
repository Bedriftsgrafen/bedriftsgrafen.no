import { createFileRoute } from '@tanstack/react-router'

import { z } from 'zod'
import { booleanSearchParam } from '../utils/searchParamSchemas'

const konkurserSearchSchema = z.object({
    period: z.enum(['30d', '90d', '1y']).optional().catch('1y'),
    nace: z.string().optional(),
    county: z.string().optional(),
    county_code: z.string().optional(),
    municipality: z.string().optional(),
    municipality_code: z.string().optional(),
    org_form: z.union([z.string(), z.array(z.string())]).optional(),
    q: z.string().optional(),
    revenue_min: z.coerce.number().optional(),
    revenue_max: z.coerce.number().optional(),
    profit_min: z.coerce.number().optional(),
    profit_max: z.coerce.number().optional(),
    employee_min: z.coerce.number().optional(),
    employee_max: z.coerce.number().optional(),
    is_bankrupt: booleanSearchParam,
    has_accounting: booleanSearchParam,
    in_liquidation: booleanSearchParam,
    in_forced_liquidation: booleanSearchParam,
    show_per_capita: booleanSearchParam,
})

export type KonkurserSearch = z.infer<typeof konkurserSearchSchema>

export const Route = createFileRoute('/konkurser')({
    validateSearch: (search) => konkurserSearchSchema.parse(search),
})
