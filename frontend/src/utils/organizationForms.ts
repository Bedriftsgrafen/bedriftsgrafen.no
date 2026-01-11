/**
 * Organization form mappings for Norwegian companies
 * Maps short codes (AS, ASA, etc.) to full descriptions
 */

export const ORGANIZATION_FORM_MAP: Record<string, string> = {
  // Complete list from https://data.brreg.no/enhetsregisteret/api/organisasjonsformer
  'AAFY': 'Underenhet til ikke-næringsdrivende',
  'ADOS': 'Administrativ enhet - offentlig sektor',
  'ANNA': 'Annen juridisk person',
  'ANS': 'Ansvarlig selskap med solidarisk ansvar',
  'AS': 'Aksjeselskap',
  'ASA': 'Allmennaksjeselskap',
  'BA': 'Selskap med begrenset ansvar',
  'BBL': 'Boligbyggelag',
  'BEDR': 'Underenhet til næringsdrivende og offentlig forvaltning',
  'BO': 'Andre bo',
  'BRL': 'Borettslag',
  'DA': 'Ansvarlig selskap med delt ansvar',
  'ENK': 'Enkeltpersonforetak',
  'EOFG': 'Europeisk økonomisk foretaksgruppe',
  'ESEK': 'Eierseksjonssameie',
  'FKF': 'Fylkeskommunalt foretak',
  'FLI': 'Forening/lag/innretning',
  'FYLK': 'Fylkeskommune',
  'GFS': 'Gjensidig forsikringsselskap',
  'IKJP': 'Andre ikke-juridiske personer',
  'IKS': 'Interkommunalt selskap',
  'KBO': 'Konkursbo',
  'KF': 'Kommunalt foretak',
  'KIRK': 'Den norske kirke',
  'KOMM': 'Kommune',
  'KS': 'Kommandittselskap',
  'KTRF': 'Kontorfellesskap',
  'NUF': 'Norskregistrert utenlandsk foretak',
  'OPMV': 'Særskilt oppdelt enhet, jf. mval. § 2-2',
  'ORGL': 'Organisasjonsledd',
  'PERS': 'Andre enkeltpersoner som registreres i tilknyttet register',
  'PK': 'Pensjonskasse',
  'PRE': 'Partrederi',
  'SA': 'Samvirkeforetak',
  'SAM': 'Tingsrettslig sameie',
  'SE': 'Europeisk selskap',
  'SF': 'Statsforetak',
  'SPA': 'Sparebank',
  'STAT': 'Staten',
  'STI': 'Stiftelse',
  'SÆR': 'Annet foretak iflg. særskilt lov',
  'TVAM': 'Tvangsregistrert for MVA',
  'UTLA': 'Utenlandsk enhet',
  'VPFO': 'Verdipapirfond',
}

/**
 * Get full organization form name from code
 * @param code - Organization form code (e.g., "AS", "ASA")
 * @returns Full name with code (e.g., "Aksjeselskap (AS)") or just the code if not found
 */
export function getOrganizationFormLabel(code: string | undefined | null): string {
  if (!code) return 'Ukjent'

  const fullName = ORGANIZATION_FORM_MAP[code]
  return fullName ? `${fullName} (${code})` : code
}

/**
 * Get just the full organization form name without code
 * @param code - Organization form code (e.g., "AS", "ASA")
 * @returns Full name (e.g., "Aksjeselskap") or the code if not found
 */
export function getOrganizationFormName(code: string | undefined | null): string {
  if (!code) return 'Ukjent'
  return ORGANIZATION_FORM_MAP[code] || code
}
