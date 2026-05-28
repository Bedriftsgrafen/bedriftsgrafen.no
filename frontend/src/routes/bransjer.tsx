import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { booleanSearchParam, numberSearchParam } from '../utils/searchParamSchemas'

// Search params schema - now includes tab for state persistence
const searchSchema = z.object({
    nace: z.string().optional(),
    tab: z.enum(['stats', 'search', 'map', 'toplist']).optional(),
    orgnr: z.preprocess((val) => (typeof val === 'string' ? val.replace(/"/g, '') : val), z.string().optional()),
    // Map filters
    county: z.string().optional(),
    county_code: z.string().optional(),
    municipality: z.string().optional(),
    municipality_code: z.string().optional(),
    org_form: z.union([z.string(), z.array(z.string())]).optional(),
    q: z.string().optional(),
    revenue_min: numberSearchParam,
    revenue_max: numberSearchParam,
    employee_min: numberSearchParam,
    employee_max: numberSearchParam,
    profit_min: numberSearchParam,
    profit_max: numberSearchParam,
    is_bankrupt: booleanSearchParam,
    has_accounting: booleanSearchParam,
    in_liquidation: booleanSearchParam,
    in_forced_liquidation: booleanSearchParam,
    show_per_capita: booleanSearchParam,
})

export const Route = createFileRoute('/bransjer')({
    validateSearch: searchSchema,
})
