import { describe, expect, it } from 'vitest'
import { booleanSearchParam, numberSearchParam } from '../searchParamSchemas'

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

describe('numberSearchParam', () => {
    it('parses URL number strings without treating empty values as zero', () => {
        expect(numberSearchParam.parse('12.5')).toBe(12.5)
        expect(numberSearchParam.parse(0)).toBe(0)
        expect(numberSearchParam.parse('0')).toBe(0)
        expect(numberSearchParam.parse('')).toBeUndefined()
        expect(numberSearchParam.parse('not-a-number')).toBeUndefined()
    })
})