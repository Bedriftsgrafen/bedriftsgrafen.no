import type { CompanyWithAccounting } from '../types'

export interface MetricWinner {
    revenue: string | null
    profit: string | null
    equity: string | null
    employees: string | null
}

export interface MetricMax {
    revenue: number
    profit: number
    equity: number
    employees: number
}

/**
 * Calculates the winner for each metric and the maximum values for relative scaling.
 * 
 * @param data - Array of comparison data objects
 * @returns Object containing winners (orgnr) and max values for each metric
 */
export function calculateComparisonMetrics(data: { orgnr: string; company: CompanyWithAccounting | null }[]) {
    const winners: MetricWinner = { revenue: null, profit: null, equity: null, employees: null }
    const maxValues: MetricMax = { revenue: 0, profit: 0, equity: 0, employees: 0 }
    
    let maxRev = -Infinity
    let maxProf = -Infinity
    let maxEq = -Infinity
    let maxEmp = -Infinity

    for (const item of data) {
        if (!item.company) continue
        
        // Employees
        const emp = item.company.antall_ansatte ?? 0
        if (emp > maxEmp) {
            maxEmp = emp
            winners.employees = item.orgnr
        }
        maxValues.employees = Math.max(maxValues.employees, emp)

        // Get latest accounting
        const acc = item.company.regnskap && item.company.regnskap.length > 0
            ? [...item.company.regnskap].sort((a, b) => b.aar - a.aar)[0]
            : null
        
        if (acc) {
            // Revenue
            const rev = acc.salgsinntekter ?? 0
            if (rev > maxRev) {
                maxRev = rev
                winners.revenue = item.orgnr
            }
            maxValues.revenue = Math.max(maxValues.revenue, Math.abs(rev))

            // Profit
            const prof = acc.aarsresultat ?? 0
            if (prof > maxProf) {
                maxProf = prof
                winners.profit = item.orgnr
            }
            maxValues.profit = Math.max(maxValues.profit, Math.abs(prof))

            // Equity
            const eq = acc.egenkapital ?? 0
            if (eq > maxEq) {
                maxEq = eq
                winners.equity = item.orgnr
            }
            maxValues.equity = Math.max(maxValues.equity, Math.abs(eq))
        }
    }

    return { winners, maxValues }
}
