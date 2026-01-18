import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { Company } from '../../types'

export interface UseCompaniesQueryParams {
  skip?: number
  limit?: number
  name?: string
  organisasjonsform?: string[]
  naeringskode?: string
  min_employees?: number | null
  max_employees?: number | null
  municipality?: string
  county?: string
  founded_from?: string
  founded_to?: string
  bankrupt_from?: string
  bankrupt_to?: string
  is_bankrupt?: boolean | null
  in_liquidation?: boolean | null
  in_forced_liquidation?: boolean | null
  min_revenue?: number | null
  max_revenue?: number | null
  min_profit?: number | null
  max_profit?: number | null
  min_equity?: number | null
  max_equity?: number | null
  min_operating_profit?: number | null
  max_operating_profit?: number | null
  min_liquidity_ratio?: number | null
  max_liquidity_ratio?: number | null
  min_equity_ratio?: number | null
  max_equity_ratio?: number | null
  has_accounting?: boolean | null
  sort_by?: string
  sort_order?: string
  exclude_org_form?: string[]
  municipality_code?: string
}

export function useCompaniesQuery({
  skip = 0,
  limit = 20,
  name,
  organisasjonsform,
  naeringskode,
  min_employees,
  max_employees,
  municipality,
  county,
  founded_from,
  founded_to,
  is_bankrupt,
  in_liquidation,
  in_forced_liquidation,
  min_revenue,
  max_revenue,
  min_profit,
  max_profit,
  min_equity,
  max_equity,
  min_operating_profit,
  max_operating_profit,
  min_liquidity_ratio,
  max_liquidity_ratio,
  min_equity_ratio,
  max_equity_ratio,
  has_accounting,
  sort_by,
  sort_order,
  exclude_org_form,
  municipality_code
}: UseCompaniesQueryParams = {}) {
  return useQuery({
    queryKey: [
      'companies',
      {
        pagination: { skip, limit },
        filters: {
          name, organisasjonsform, naeringskode,
          employees: { min: min_employees, max: max_employees },
          location: { municipality, municipality_code, county },
          dates: { founded_from, founded_to },
          status: { is_bankrupt, in_liquidation, in_forced_liquidation },
          financials: {
            revenue: { min: min_revenue, max: max_revenue },
            profit: { min: min_profit, max: max_profit },
            equity: { min: min_equity, max: max_equity },
            operatingProfit: { min: min_operating_profit, max: max_operating_profit },
            liquidityRatio: { min: min_liquidity_ratio, max: max_liquidity_ratio },
            equityRatio: { min: min_equity_ratio, max: max_equity_ratio },
          },
          has_accounting,
          exclude_org_form
        },
        sort: { sort_by, sort_order }
      }
    ] as const,
    queryFn: async () => {
      const params: Record<string, string | number | boolean | string[]> = { skip, limit }

      // Add search filter
      if (name) params.name = name

      // Add filters if provided
      if (organisasjonsform && organisasjonsform.length > 0) params.organisasjonsform = organisasjonsform
      if (naeringskode) params.naeringskode = naeringskode

      if (min_employees !== null && min_employees !== undefined) params.min_employees = min_employees
      if (max_employees !== null && max_employees !== undefined) params.max_employees = max_employees

      if (municipality) params.municipality = municipality
      if (municipality_code) params.municipality_code = municipality_code
      if (county) params.county = county

      if (founded_from) params.founded_from = founded_from
      if (founded_to) params.founded_to = founded_to

      if (is_bankrupt !== null && is_bankrupt !== undefined) params.is_bankrupt = is_bankrupt
      if (in_liquidation !== null && in_liquidation !== undefined) params.in_liquidation = in_liquidation
      if (in_forced_liquidation !== null && in_forced_liquidation !== undefined) params.in_forced_liquidation = in_forced_liquidation

      if (min_revenue !== null && min_revenue !== undefined) params.min_revenue = min_revenue
      if (max_revenue !== null && max_revenue !== undefined) params.max_revenue = max_revenue

      if (min_profit !== null && min_profit !== undefined) params.min_profit = min_profit
      if (max_profit !== null && max_profit !== undefined) params.max_profit = max_profit

      if (min_equity !== null && min_equity !== undefined) params.min_equity = min_equity
      if (max_equity !== null && max_equity !== undefined) params.max_equity = max_equity

      if (min_operating_profit !== null && min_operating_profit !== undefined) params.min_operating_profit = min_operating_profit
      if (max_operating_profit !== null && max_operating_profit !== undefined) params.max_operating_profit = max_operating_profit

      if (min_liquidity_ratio !== null && min_liquidity_ratio !== undefined) params.min_liquidity_ratio = min_liquidity_ratio
      if (max_liquidity_ratio !== null && max_liquidity_ratio !== undefined) params.max_liquidity_ratio = max_liquidity_ratio

      if (min_equity_ratio !== null && min_equity_ratio !== undefined) params.min_equity_ratio = min_equity_ratio
      if (max_equity_ratio !== null && max_equity_ratio !== undefined) params.max_equity_ratio = max_equity_ratio

      if (has_accounting !== null && has_accounting !== undefined) params.has_accounting = has_accounting

      if (sort_by) params.sort_by = sort_by
      if (sort_order) params.sort_order = sort_order

      if (exclude_org_form && exclude_org_form.length > 0) params.exclude_org_form = exclude_org_form

      const response = await apiClient.get<Company[]>('/v1/companies', { params })
      return response.data
    },
    staleTime: 30_000, // Cache for 30 seconds to reduce API calls
    // placeholderData removed - showing stale data while filtering is confusing
  })
}
