import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import type { NetworkPathResponse } from '../../types/person'

interface NetworkPathRequest {
    person_a_name: string
    person_a_birthdate: string | null
    person_b_name: string
    person_b_birthdate: string | null
    max_depth?: number
}

/**
 * Mutation hook for network path search (triggered by user action, not auto-fetch).
 */
export function useNetworkPathMutation() {
    return useMutation({
        mutationFn: async (params: NetworkPathRequest): Promise<NetworkPathResponse> => {
            const response = await apiClient.post<NetworkPathResponse>(
                '/v1/people/network-path',
                params
            )
            return response.data
        },
    })
}
