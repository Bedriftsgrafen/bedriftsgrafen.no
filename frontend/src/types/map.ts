export interface MapFilterValues {
    query: string | null;
    // Basic filters
    naceCode: string | null;
    municipalityCode: string | null;
    countyCode: string | null;
    organizationForms: string[];

    // Financial filters
    revenueMin: number | null;
    revenueMax: number | null;
    profitMin: number | null;
    profitMax: number | null;
    equityMin: number | null;
    equityMax: number | null;
    operatingProfitMin: number | null;
    operatingProfitMax: number | null;
    liquidityRatioMin: number | null;
    liquidityRatioMax: number | null;
    equityRatioMin: number | null;
    equityRatioMax: number | null;

    // Employee range
    employeeMin: number | null;
    employeeMax: number | null;

    // Date filters
    foundedFrom: string | null; // ISO date string
    foundedTo: string | null;
    bankruptFrom: string | null;
    bankruptTo: string | null;

    // Status flags
    isBankrupt: boolean | null;
    inLiquidation: boolean | null;
    inForcedLiquidation: boolean | null;
    hasAccounting: boolean | null;
}

export const defaultMapFilters: MapFilterValues = {
    query: null,
    naceCode: null,
    municipalityCode: null,
    countyCode: null,
    organizationForms: [],
    revenueMin: null,
    revenueMax: null,
    profitMin: null,
    profitMax: null,
    equityMin: null,
    equityMax: null,
    operatingProfitMin: null,
    operatingProfitMax: null,
    liquidityRatioMin: null,
    liquidityRatioMax: null,
    equityRatioMin: null,
    equityRatioMax: null,
    employeeMin: null,
    employeeMax: null,
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    hasAccounting: null,
};
