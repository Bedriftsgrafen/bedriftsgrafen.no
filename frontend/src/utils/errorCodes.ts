/**
 * Stable API error codes returned in { code: string } from the backend.
 *
 * Using named codes instead of status numbers lets us give precise
 * Norwegian messages and decouples the UI from HTTP status semantics.
 */
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  COMPANY_NOT_FOUND: 'Selskapet finnes ikke i databasen.',
  ACCOUNTING_NOT_FOUND: 'Regnskapsdata for denne perioden finnes ikke.',
  INVALID_ORGNR: 'Ugyldig organisasjonsnummer. Må være 9 siffer.',
  VALIDATION_ERROR: 'Ugyldig forespørsel. Sjekk parametrene.',
  DATABASE_ERROR: 'Serverfeil. Prøv igjen senere.',
  BRREG_API_ERROR: 'Kunne ikke hente data fra Brønnøysundregistrene. Prøv igjen.',
  RATE_LIMITED: 'For mange forespørsler. Vent litt og prøv igjen.',
  ERROR: 'Noe gikk galt. Prøv igjen.',
}

/**
 * Returns the Norwegian message for a given error code, or undefined if unknown.
 */
export function getMessageForCode(code: string): string | undefined {
  return ERROR_CODE_MESSAGES[code]
}
