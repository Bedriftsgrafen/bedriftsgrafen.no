/**
 * Chart data transformation utilities.
 * 
 * Pure functions for preparing accounting data for Recharts.
 * Keeps React components focused on rendering.
 */

import { Accounting } from '../types/company'
import { deduplicateAccountingsByYear } from './accountingHelpers'

// Chart colors - centralized for consistency
export const CHART_COLORS = {
    revenue: "#3b82f6", // blue-500
    profit: "#10b981",  // emerald-500
    equity: "#8b5cf6",  // violet-500
    cost: "#ef4444",    // red-500
    neutral: "#6b7280", // gray-500
} as const

/**
 * Chart data point for revenue/profit charts
 */
export interface FinancialChartPoint {
    year: string
    inntekt: number
    resultat: number
    egenkapital: number
}

/**
 * Chart data point with margin calculations
 */
export interface MarginChartPoint {
    year: string
    driftsmargin: number | null
    resultatmargin: number | null
}

/**
 * Transform accounting records into chart-ready data.
 * Sorts by year ascending and extracts key financial metrics.
 * Deduplicates by year.
 */
export function prepareFinancialChartData(regnskap: Accounting[]): FinancialChartPoint[] {
    return deduplicateAccountingsByYear(regnskap)
        .sort((a, b) => a.aar - b.aar)
        .map(r => ({
            year: r.aar.toString(),
            inntekt: r.salgsinntekter || 0,
            resultat: r.aarsresultat || 0,
            egenkapital: r.egenkapital || 0,
        }))
}

/**
 * Calculate profit margins for chart display.
 * Returns null for years with zero or missing revenue.
 */
export function prepareMarginChartData(regnskap: Accounting[]): MarginChartPoint[] {
    return deduplicateAccountingsByYear(regnskap)
        .sort((a, b) => a.aar - b.aar)
        .map(r => {
            const revenue = r.salgsinntekter || 0

            // Avoid division by zero
            if (revenue === 0) {
                return {
                    year: r.aar.toString(),
                    driftsmargin: null,
                    resultatmargin: null,
                }
            }

            return {
                year: r.aar.toString(),
                driftsmargin: r.driftsresultat ? (r.driftsresultat / revenue) * 100 : null,
                resultatmargin: r.aarsresultat ? (r.aarsresultat / revenue) * 100 : null,
            }
        })
}

/**
 * Calculate EBITDA (Earnings Before Interest, Taxes, Depreciation, Amortization)
 */
export function calculateEBITDA(accounting: Accounting): number | null {
    const driftsresultat = accounting.driftsresultat
    const avskrivninger = accounting.avskrivninger

    if (driftsresultat == null) return null

    // EBITDA = Operating profit + Depreciation
    return driftsresultat + (avskrivninger || 0)
}

/**
 * Prepare EBITDA trend data
 */
export function prepareEBITDAChartData(regnskap: Accounting[]): { year: string; ebitda: number | null }[] {
    return deduplicateAccountingsByYear(regnskap)
        .sort((a, b) => a.aar - b.aar)
        .map(r => ({
            year: r.aar.toString(),
            ebitda: calculateEBITDA(r),
        }))
}

/**
 * Calculate year-over-year growth percentage
 */
export function calculateGrowth(current: number | null, previous: number | null): number | null {
    if (current == null || previous == null || previous === 0) return null
    return ((current - previous) / Math.abs(previous)) * 100
}

/**
 * Prepare growth chart data
 */
export function prepareGrowthChartData(regnskap: Accounting[]): { year: string; vekst: number | null }[] {
    const sorted = deduplicateAccountingsByYear(regnskap).sort((a, b) => a.aar - b.aar)

    return sorted.map((r, index) => ({
        year: r.aar.toString(),
        vekst: index > 0
            ? calculateGrowth(r.salgsinntekter, sorted[index - 1].salgsinntekter)
            : null,
    }))
}
