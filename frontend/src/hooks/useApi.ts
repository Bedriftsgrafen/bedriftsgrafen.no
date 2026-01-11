/**
 * @deprecated This file contains legacy hooks using useState/useEffect.
 * 
 * Use the modern React Query hooks instead:
 * - useCompaniesQuery (from hooks/queries/useCompaniesQuery)
 * - useCompanyDetailQuery (from hooks/queries/useCompanyDetailQuery)
 * - useCompanySearchQuery (from hooks/queries/useCompanySearchQuery)
 * - useAccountingKpisQuery (from hooks/queries/useAccountingKpisQuery)
 * 
 * These provide better caching, refetching, and loading state management.
 */

// If you find any usage of this file, please migrate to the react-query hooks above.
// The types re-exported here should be imported directly from 'types/index.ts'.

import { apiClient } from '../utils/apiClient'

// Fetch company from Brønnøysund - K1SSO: Keeping this one as it's a mutation/action helper, not a data-fetching hook
export async function fetchCompanyFromBrreg(orgnr: string): Promise<{ success: boolean; message: string }> {
    try {
        const response = await apiClient.post(`/v1/companies/${orgnr}/fetch`, {
            fetch_financials: true
        })

        if (response.data.company_fetched) {
            return {
                success: true,
                message: `Hentet ${response.data.financials_fetched} regnskapsår`
            }
        } else {
            return {
                success: false,
                message: response.data.errors.join(', ') || 'Feil ved henting'
            }
        }
    } catch (_err) {
        return {
            success: false,
            message: 'Kunne ikke hente fra Brønnøysund'
        }
    }
}
