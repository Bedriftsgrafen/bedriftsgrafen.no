import { z } from 'zod'

export const booleanSearchParam = z.preprocess((value) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    if (value === undefined || value === null || value === '') return undefined
    return value
}, z.boolean().optional())

export const numberSearchParam = z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined
    const parsed = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}, z.number().optional())