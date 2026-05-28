import { z } from 'zod'

export const booleanSearchParam = z.preprocess((value) => {
    if (value === 'true' || value === true) return true
    if (value === 'false' || value === false) return false
    if (value === undefined || value === null || value === '') return undefined
    return value
}, z.boolean().optional())