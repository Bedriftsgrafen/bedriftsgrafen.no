import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { booleanSearchParam } from '../utils/searchParamSchemas'

// Search params schema for all map filters
const searchSchema = z.object({
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

export type KartSearch = z.infer<typeof searchSchema>

export const Route = createFileRoute('/kart')({
    validateSearch: searchSchema,
})
