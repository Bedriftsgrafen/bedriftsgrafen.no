import { describe, it, expect } from 'vitest'
import { calculateComparisonMetrics } from '../comparison'
import type { CompanyWithAccounting } from '../../types'

describe('calculateComparisonMetrics', () => {
    it('should correctly identify winners for all metrics', () => {
        const data = [
            {
                orgnr: '111',
                company: {
                    orgnr: '111',
                    antall_ansatte: 10,
                    regnskap: [
                        { aar: 2023, salgsinntekter: 1000, aarsresultat: 100, egenkapital: 500 }
                    ]
                } as CompanyWithAccounting
            },
            {
                orgnr: '222',
                company: {
                    orgnr: '222',
                    antall_ansatte: 20,
                    regnskap: [
                        { aar: 2023, salgsinntekter: 500, aarsresultat: 200, egenkapital: 300 }
                    ]
                } as CompanyWithAccounting
            },
            {
                orgnr: '333',
                company: {
                    orgnr: '333',
                    antall_ansatte: 5,
                    regnskap: [
                        { aar: 2023, salgsinntekter: 800, aarsresultat: 50, egenkapital: 1000 }
                    ]
                } as CompanyWithAccounting
            }
        ]

        const { winners, maxValues } = calculateComparisonMetrics(data)

        expect(winners.employees).toBe('222')
        expect(winners.revenue).toBe('111')
        expect(winners.profit).toBe('222')
        expect(winners.equity).toBe('333')

        expect(maxValues.employees).toBe(20)
        expect(maxValues.revenue).toBe(1000)
        expect(maxValues.profit).toBe(200)
        expect(maxValues.equity).toBe(1000)
    })

    it('should handle missing data gracefully', () => {
        const data = [
            {
                orgnr: '111',
                company: null
            },
            {
                orgnr: '222',
                company: {
                    orgnr: '222',
                    antall_ansatte: 10,
                    regnskap: []
                } as CompanyWithAccounting
            }
        ]

        const { winners, maxValues } = calculateComparisonMetrics(data)

        expect(winners.employees).toBe('222')
        expect(winners.revenue).toBeNull()
        expect(winners.profit).toBeNull()
        expect(winners.equity).toBeNull()

        expect(maxValues.employees).toBe(10)
        expect(maxValues.revenue).toBe(0)
    })

    it('should use the latest year for calculations', () => {
        const data = [
            {
                orgnr: '111',
                company: {
                    orgnr: '111',
                    regnskap: [
                        { aar: 2022, salgsinntekter: 5000 },
                        { aar: 2023, salgsinntekter: 1000 }
                    ]
                } as CompanyWithAccounting
            },
            {
                orgnr: '222',
                company: {
                    orgnr: '222',
                    regnskap: [
                        { aar: 2023, salgsinntekter: 2000 }
                    ]
                } as CompanyWithAccounting
            }
        ]

        const { winners } = calculateComparisonMetrics(data)
        // Even though 111 had 5000 in 2022, 222 wins because 2000 > 1000 in 2023
        expect(winners.revenue).toBe('222')
    })
})
