/**
 * Explorer constants - NACE codes and regions
 * Centralized data to keep components DRY
 */

import type { NaceCode, NaceCodeKey, Region, MunicipalityEntry } from '../types/explorer'

// ============================================================================
// NACE CODES
// ============================================================================

/** Top-level NACE codes (A-U) with Norwegian descriptions */
export const NACE_CODES: readonly NaceCode[] = Object.freeze([
    { code: 'A', name: 'Jordbruk, skogbruk og fiske' },
    { code: 'B', name: 'Bergverksdrift og utvinning' },
    { code: 'C', name: 'Industri' },
    { code: 'D', name: 'Elektrisitets-, gass-, damp- og varmtvannsforsyning' },
    { code: 'E', name: 'Vannforsyning, avløps- og renovasjonsvirksomhet' },
    { code: 'F', name: 'Bygge- og anleggsvirksomhet' },
    { code: 'G', name: 'Varehandel, reparasjon av motorvogner' },
    { code: 'H', name: 'Transport og lagring' },
    { code: 'I', name: 'Overnattings- og serveringsvirksomhet' },
    { code: 'J', name: 'Informasjon og kommunikasjon' },
    { code: 'K', name: 'Finansierings- og forsikringsvirksomhet' },
    { code: 'L', name: 'Omsetning og drift av fast eiendom' },
    { code: 'M', name: 'Faglig, vitenskapelig og teknisk tjenesteyting' },
    { code: 'N', name: 'Forretningsmessig tjenesteyting' },
    { code: 'O', name: 'Offentlig administrasjon og forsvar' },
    { code: 'P', name: 'Undervisning' },
    { code: 'Q', name: 'Helse- og sosialtjenester' },
    { code: 'R', name: 'Kulturell virksomhet, underholdning og fritidsaktiviteter' },
    { code: 'S', name: 'Annen tjenesteyting' },
    { code: 'T', name: 'Lønnet arbeid i private husholdninger' },
    { code: 'U', name: 'Internasjonale organisasjoner og organer' },
])

/** NACE code to name mapping for quick lookup - O(1) access */
export const NACE_CODE_NAMES: Readonly<Record<NaceCodeKey, string>> = Object.freeze(
    NACE_CODES.reduce((acc, nace) => {
        acc[nace.code as NaceCodeKey] = nace.name
        return acc
    }, {} as Record<NaceCodeKey, string>)
)

/** Division type for sub-level NACE codes */
export interface NaceDivision {
    readonly code: string
    readonly name: string
}

/** NACE divisions (2-digit codes) under each section letter */
export const NACE_DIVISIONS: Readonly<Record<string, readonly NaceDivision[]>> = Object.freeze({
    'A': [
        { code: '01', name: 'Jordbruk og tjenester tilknyttet jordbruk, jakt' },
        { code: '02', name: 'Skogbruk og tjenester tilknyttet skogbruk' },
        { code: '03', name: 'Fiske, fangst og akvakultur' },
    ],
    'B': [
        { code: '05', name: 'Bryting av steinkull og brunkull' },
        { code: '06', name: 'Utvinning av råolje og naturgass' },
        { code: '07', name: 'Bryting av metallholdig malm' },
        { code: '08', name: 'Bryting og bergverksdrift ellers' },
        { code: '09', name: 'Tjenester tilknyttet bergverksdrift og utvinning' },
    ],
    'C': [
        { code: '10', name: 'Produksjon av næringsmidler' },
        { code: '11', name: 'Produksjon av drikkevarer' },
        { code: '12', name: 'Produksjon av tobakksvarer' },
        { code: '13', name: 'Produksjon av tekstiler' },
        { code: '14', name: 'Produksjon av klær' },
        { code: '15', name: 'Produksjon av lær og lærvarer' },
        { code: '16', name: 'Produksjon av trelast og varer av tre' },
        { code: '17', name: 'Produksjon av papir og papirvarer' },
        { code: '18', name: 'Trykking og reproduksjon' },
        { code: '19', name: 'Produksjon av kull- og petroleumsprodukter' },
        { code: '20', name: 'Produksjon av kjemikalier og kjemiske produkter' },
        { code: '21', name: 'Produksjon av farmasøytiske råvarer' },
        { code: '22', name: 'Produksjon av gummi- og plastprodukter' },
        { code: '23', name: 'Produksjon av andre ikke-metallholdige produkter' },
        { code: '24', name: 'Produksjon av metaller' },
        { code: '25', name: 'Produksjon av metallvarer' },
        { code: '26', name: 'Produksjon av datamaskiner og elektronikk' },
        { code: '27', name: 'Produksjon av elektrisk utstyr' },
        { code: '28', name: 'Produksjon av maskiner og utstyr' },
        { code: '29', name: 'Produksjon av motorvogner og tilhengere' },
        { code: '30', name: 'Produksjon av andre transportmidler' },
        { code: '31', name: 'Produksjon av møbler' },
        { code: '32', name: 'Annen industriproduksjon' },
        { code: '33', name: 'Reparasjon og installasjon av maskiner' },
    ],
    'D': [
        { code: '35', name: 'Elektrisitets-, gass-, damp- og varmtvannsforsyning' },
    ],
    'E': [
        { code: '36', name: 'Uttak og rensing av vann' },
        { code: '37', name: 'Oppsamling og behandling av avløpsvann' },
        { code: '38', name: 'Innsamling, behandling og disponering av avfall' },
        { code: '39', name: 'Miljørydding, miljørensing og lignende' },
    ],
    'F': [
        { code: '41', name: 'Oppføring av bygninger' },
        { code: '42', name: 'Anleggsvirksomhet' },
        { code: '43', name: 'Spesialisert bygge- og anleggsvirksomhet' },
    ],
    'G': [
        { code: '45', name: 'Handel og reparasjon av motorvogner' },
        { code: '46', name: 'Agentur- og engroshandel' },
        { code: '47', name: 'Detaljhandel' },
    ],
    'H': [
        { code: '49', name: 'Landtransport og rørtransport' },
        { code: '50', name: 'Sjøfart' },
        { code: '51', name: 'Lufttransport' },
        { code: '52', name: 'Lagring og tjenester tilknyttet transport' },
        { code: '53', name: 'Post og distribusjonsvirksomhet' },
    ],
    'I': [
        { code: '55', name: 'Overnattingsvirksomhet' },
        { code: '56', name: 'Serveringsvirksomhet' },
    ],
    'J': [
        { code: '58', name: 'Forlagsvirksomhet' },
        { code: '59', name: 'Film-, video- og fjernsynsprogramproduksjon' },
        { code: '60', name: 'Radio- og fjernsynskringkasting' },
        { code: '61', name: 'Telekommunikasjon' },
        { code: '62', name: 'Tjenester tilknyttet informasjonsteknologi' },
        { code: '63', name: 'Informasjonstjenester' },
    ],
    'K': [
        { code: '64', name: 'Finansieringsvirksomhet' },
        { code: '65', name: 'Forsikringsvirksomhet og pensjonskasser' },
        { code: '66', name: 'Tjenester tilknyttet finansierings- og forsikring' },
    ],
    'L': [
        { code: '68', name: 'Omsetning og drift av fast eiendom' },
    ],
    'M': [
        { code: '69', name: 'Juridisk og regnskapsmessig tjenesteyting' },
        { code: '70', name: 'Hovedkontortjenester; administrativ rådgivning' },
        { code: '71', name: 'Arkitekt- og teknisk konsulentvirksomhet' },
        { code: '72', name: 'Forskning og utviklingsarbeid' },
        { code: '73', name: 'Annonse- og reklamevirksomhet' },
        { code: '74', name: 'Annen faglig, vitenskapelig virksomhet' },
        { code: '75', name: 'Veterinærtjenester' },
    ],
    'N': [
        { code: '77', name: 'Utleievirksomhet' },
        { code: '78', name: 'Arbeidskrafttjenester' },
        { code: '79', name: 'Reisebyrå- og reisearrangørvirksomhet' },
        { code: '80', name: 'Vakttjeneste og etterforsking' },
        { code: '81', name: 'Tjenester tilknyttet eiendomsdrift' },
        { code: '82', name: 'Annen forretningsmessig tjenesteyting' },
    ],
    'O': [
        { code: '84', name: 'Offentlig administrasjon og forsvar' },
    ],
    'P': [
        { code: '85', name: 'Undervisning' },
    ],
    'Q': [
        { code: '86', name: 'Helsetjenester' },
        { code: '87', name: 'Pleie- og omsorgstjenester i institusjon' },
        { code: '88', name: 'Sosiale omsorgstjenester uten botilbud' },
    ],
    'R': [
        { code: '90', name: 'Kunstnerisk virksomhet og underholdning' },
        { code: '91', name: 'Drift av biblioteker, arkiver, museer' },
        { code: '92', name: 'Lotteri og totalisatorspill' },
        { code: '93', name: 'Sports- og fritidsaktiviteter' },
    ],
    'S': [
        { code: '94', name: 'Aktiviteter i medlemsorganisasjoner' },
        { code: '95', name: 'Reparasjon av datamaskiner og husholdningsvarer' },
        { code: '96', name: 'Andre personlige tjenester' },
    ],
    'T': [
        { code: '97', name: 'Lønnet arbeid i private husholdninger' },
        { code: '98', name: 'Ikke-spesifisert vareproduksjon i husholdninger' },
    ],
    'U': [
        { code: '99', name: 'Internasjonale organisasjoner og organer' },
    ],
})

/**
 * Get NACE name by code with fallback
 * @param code - NACE code (A-U)
 * @returns Name or 'Ukjent' if not found
 */
export function getNaceName(code: string): string {
    return NACE_CODE_NAMES[code as NaceCodeKey] ?? 'Ukjent'
}

// ============================================================================
// REGIONS
// ============================================================================

/** County with code - used for county filtering */
export interface County {
    readonly code: string
    readonly name: string
}

/** List of Norwegian counties (2024 structure) with codes */
export const COUNTIES: readonly County[] = Object.freeze([
    { code: '03', name: 'Oslo' },
    { code: '11', name: 'Rogaland' },
    { code: '15', name: 'Møre og Romsdal' },
    { code: '18', name: 'Nordland' },
    { code: '31', name: 'Østfold' },
    { code: '32', name: 'Akershus' },
    { code: '33', name: 'Buskerud' },
    { code: '34', name: 'Innlandet' },
    { code: '39', name: 'Vestfold' },
    { code: '40', name: 'Telemark' },
    { code: '42', name: 'Agder' },
    { code: '46', name: 'Vestland' },
    { code: '50', name: 'Trøndelag' },
    { code: '55', name: 'Troms' },
    { code: '56', name: 'Finnmark' },
])

/** Norwegian municipalities grouped by county (for backward compatibility) */
export const REGIONS: readonly Region[] = Object.freeze([
    { county: 'Oslo', municipalities: Object.freeze(['Oslo']) },
    { county: 'Akershus', municipalities: Object.freeze(['Bærum', 'Asker', 'Lillestrøm', 'Lørenskog', 'Ullensaker', 'Ås', 'Ski', 'Jessheim']) },
    { county: 'Østfold', municipalities: Object.freeze(['Fredrikstad', 'Sarpsborg', 'Moss', 'Halden']) },
    { county: 'Buskerud', municipalities: Object.freeze(['Drammen', 'Kongsberg', 'Ringerike']) },
    { county: 'Rogaland', municipalities: Object.freeze(['Stavanger', 'Sandnes', 'Haugesund', 'Sola', 'Randaberg', 'Karmøy', 'Eigersund']) },
    { county: 'Vestland', municipalities: Object.freeze(['Bergen', 'Askøy', 'Stord', 'Os', 'Voss', 'Førde']) },
    { county: 'Trøndelag', municipalities: Object.freeze(['Trondheim', 'Steinkjer', 'Stjørdal', 'Levanger', 'Verdal', 'Namsos', 'Malvik']) },
    { county: 'Vestfold', municipalities: Object.freeze(['Tønsberg', 'Sandefjord', 'Larvik', 'Horten', 'Holmestrand']) },
    { county: 'Telemark', municipalities: Object.freeze(['Skien', 'Porsgrunn', 'Notodden']) },
    { county: 'Innlandet', municipalities: Object.freeze(['Hamar', 'Lillehammer', 'Gjøvik', 'Elverum', 'Kongsvinger', 'Ringsaker']) },
    { county: 'Agder', municipalities: Object.freeze(['Kristiansand', 'Arendal', 'Grimstad', 'Mandal', 'Farsund', 'Flekkefjord', 'Lillesand']) },
    { county: 'Møre og Romsdal', municipalities: Object.freeze(['Ålesund', 'Molde', 'Kristiansund', 'Ulstein', 'Ørsta', 'Volda']) },
    { county: 'Nordland', municipalities: Object.freeze(['Bodø', 'Narvik', 'Mo i Rana', 'Mosjøen', 'Svolvær', 'Sortland']) },
    { county: 'Troms', municipalities: Object.freeze(['Tromsø', 'Harstad', 'Finnsnes']) },
    { county: 'Finnmark', municipalities: Object.freeze(['Alta', 'Hammerfest', 'Kirkenes', 'Vadsø']) },
])


/** 
 * Flattened list of all municipalities - computed once at module load.
 * Pre-computed for O(1) access rather than O(n) flatMap on each render.
 */
export const ALL_MUNICIPALITIES: readonly MunicipalityEntry[] = Object.freeze(
    REGIONS.flatMap((r): MunicipalityEntry[] =>
        r.municipalities.map((m): MunicipalityEntry => ({
            municipality: m,
            county: r.county,
        }))
    )
)

/** Total count of municipalities for validation */
export const MUNICIPALITY_COUNT = ALL_MUNICIPALITIES.length

// ============================================================================
// SORT FIELDS
// ============================================================================

/** Fields that should default to descending sort (numeric fields) */
export const NUMERIC_SORT_FIELDS = Object.freeze([
    'revenue',
    'profit',
    'antall_ansatte',
    'operating_profit',
] as const)

/** Check if a field should default to descending sort */
export function isNumericSortField(field: string): boolean {
    return (NUMERIC_SORT_FIELDS as readonly string[]).includes(field)
}
