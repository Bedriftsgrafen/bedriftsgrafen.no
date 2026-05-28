/**
 * Lightweight NACE section-level mapping for frontend charting.
 * Derived from backend/constants/nace.py — section-level only.
 */

export const NACE_SECTIONS: Record<string, string> = {
    A: 'Jordbruk, skogbruk og fiske',
    B: 'Bergverksdrift og utvinning',
    C: 'Industri',
    D: 'Elektrisitet og kjøleluft',
    E: 'Vann, avløp og opprydding',
    F: 'Bygg og anlegg',
    G: 'Varehandel',
    H: 'Transport og lagring',
    I: 'Overnatting og servering',
    J: 'Utgivelse og innhold',
    K: 'Telekom og IT',
    L: 'Finans',
    M: 'Eiendom',
    N: 'Faglig tjenesteyting',
    O: 'Forretningsmessig tjenesteyting',
    P: 'Offentlig administrasjon',
    Q: 'Undervisning',
    R: 'Helse og sosial',
    S: 'Kultur, idrett og fritid',
    T: 'Annen tjenesteyting',
    U: 'Private husholdninger',
    V: 'Internasjonale organisasjoner',
}

/** Maps 2-digit NACE division codes to their section letter. */
export const NACE_DIVISION_TO_SECTION: Record<string, string> = {
    '01': 'A', '02': 'A', '03': 'A',
    '05': 'B', '06': 'B', '07': 'B', '08': 'B', '09': 'B',
    '10': 'C', '11': 'C', '12': 'C', '13': 'C', '14': 'C', '15': 'C', '16': 'C', '17': 'C',
    '18': 'C', '19': 'C', '20': 'C', '21': 'C', '22': 'C', '23': 'C', '24': 'C', '25': 'C',
    '26': 'C', '27': 'C', '28': 'C', '29': 'C', '30': 'C', '31': 'C', '32': 'C', '33': 'C',
    '35': 'D',
    '36': 'E', '37': 'E', '38': 'E', '39': 'E',
    '41': 'F', '42': 'F', '43': 'F',
    '46': 'G', '47': 'G',
    '49': 'H', '50': 'H', '51': 'H', '52': 'H', '53': 'H',
    '55': 'I', '56': 'I',
    '58': 'J', '59': 'J', '60': 'J',
    '61': 'K', '62': 'K', '63': 'K',
    '64': 'L', '65': 'L', '66': 'L',
    '68': 'M',
    '69': 'N', '70': 'N', '71': 'N', '72': 'N', '73': 'N', '74': 'N', '75': 'N',
    '77': 'O', '78': 'O', '79': 'O', '80': 'O', '81': 'O', '82': 'O',
    '84': 'P',
    '85': 'Q',
    '86': 'R', '87': 'R', '88': 'R',
    '90': 'S', '91': 'S', '92': 'S', '93': 'S',
    '94': 'T', '95': 'T', '96': 'T',
    '97': 'U', '98': 'U',
    '99': 'V',
}

/**
 * Get NACE section name from a naeringskode (e.g. "62.010" → "IT og kommunikasjon").
 * Returns null if the code can't be mapped.
 */
export function getNaceSectionName(naeringskode: string | null): string | null {
    if (!naeringskode) return null
    const division = naeringskode.replace('.', '').slice(0, 2)
    const section = NACE_DIVISION_TO_SECTION[division]
    return section ? NACE_SECTIONS[section] : null
}
