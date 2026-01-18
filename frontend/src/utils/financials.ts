/**
 * Financial utility for unit conversions and formatting.
 * Centralizes MNOK <-> NOK scaling to prevent data-loss/discrepancies.
 */

export const MNOK_MULTIPLIER = 1_000_000;

/**
 * Converts MNOK (Million NOK) to whole NOK.
 */
export function mnokToNok(mnok: number | null | undefined): number | undefined {
    if (mnok === null || mnok === undefined) return undefined;
    // Use Math.round to avoid floating point precision issues in whole NOK
    return Math.round(mnok * MNOK_MULTIPLIER);
}

/**
 * Converts whole NOK to MNOK (Million NOK).
 */
export function nokToMnok(nok: number | null | undefined): number | undefined {
    if (nok === null || nok === undefined) return undefined;
    return nok / MNOK_MULTIPLIER;
}
