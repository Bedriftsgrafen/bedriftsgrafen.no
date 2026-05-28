import type { FilterValues } from '../store/filterStore'
import { buildMapRouteFilterUpdates, type MapRouteSearchFilters } from './mapRouteSearchSync'

export type BransjerRouteSearchFilters = MapRouteSearchFilters

interface BuildBransjerRouteFilterUpdatesOptions {
    clearMissing?: boolean
}

export function buildBransjerRouteFilterUpdates(
    search: BransjerRouteSearchFilters,
    current: FilterValues,
    options: BuildBransjerRouteFilterUpdatesOptions = {},
): Partial<FilterValues> {
    return buildMapRouteFilterUpdates(search, current, { ...options, moneyUnit: 'nok' })
}