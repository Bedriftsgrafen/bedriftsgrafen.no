/**
 * Explorer-specific types for the /bransjer page
 */

// ============================================================================
// NACE (Industry) Types
// ============================================================================

/** Top-level NACE code entry */
export interface NaceCode {
    readonly code: string
    readonly name: string
}

/** NACE code key (A-U) */
export type NaceCodeKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U'

// ============================================================================
// Region Types
// ============================================================================

/** Region with county and municipalities */
export interface Region {
    readonly county: string
    readonly municipalities: readonly string[]
}

/** Flattened municipality entry for display */
export interface MunicipalityEntry {
    readonly municipality: string
    readonly county: string
}

// ============================================================================
// Explorer Store Types
// ============================================================================

/** View mode for displaying results */
export type ExplorerViewMode = 'list' | 'cards'

/** Grouping option for results */
export type ExplorerGroupBy = 'county' | 'industry' | null

/** Range filter field types */
export type RangeFilterField = 'revenue' | 'employee'

// ============================================================================
// Modal Props Types
// ============================================================================

/** Base props for all picker modals */
export interface BasePickerModalProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Callback to close the modal */
    onClose: () => void
}

/** Props for the NACE picker modal */
export interface NacePickerModalProps extends BasePickerModalProps {
    /** Currently selected NACE code */
    selectedCode: string
    /** Callback when a code is selected */
    onSelect: (code: string) => void
}

/** Props for the region picker modal */
export interface RegionPickerModalProps extends BasePickerModalProps {
    /** Currently selected municipality */
    selectedMunicipality: string
    /** Callback when a municipality is selected */
    onSelect: (municipality: string) => void
}
