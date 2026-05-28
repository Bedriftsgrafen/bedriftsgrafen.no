import { describe, expect, it } from 'vitest'
import { booleanSearchParam } from '../searchParamSchemas'

describe('booleanSearchParam', () => {
    it('parses URL boolean strings explicitly', () => {
        expect(booleanSearchParam.parse('true')).toBe(true)
        expect(booleanSearchParam.parse('false')).toBe(false)
    })

    it('keeps booleans and empty values predictable', () => {
        expect(booleanSearchParam.parse(true)).toBe(true)
        expect(booleanSearchParam.parse(false)).toBe(false)
        expect(booleanSearchParam.parse(undefined)).toBeUndefined()
        expect(booleanSearchParam.parse('')).toBeUndefined()
    })
})