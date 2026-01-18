/**
 * Complete list of Norwegian municipalities (356 total)
 * Extracted from database - includes all registered municipalities
 * Names are stored in UPPERCASE as per Brønnøysund registry format
 */

export const ALL_NORWEGIAN_MUNICIPALITIES: readonly string[] = Object.freeze([
    "ALSTAHAUG", "ALTA", "ALVDAL", "ALVER", "ANDØY", "AREMARK", "ARENDAL", "ASKER",
    "ASKVOLL", "ASKØY", "AUKRA", "AURE", "AURLAND", "AURSKOG-HØLAND", "AUSTEVOLL",
    "AUSTRHEIM", "AVERØY", "BALSFJORD", "BAMBLE", "BARDU", "BEIARN", "BERGEN",
    "BERLEVÅG", "BINDAL", "BIRKENES", "BJERKREIM", "BJØRNAFJORDEN", "BODØ", "BOKN",
    "BREMANGER", "BRØNNØY", "BYGLAND", "BYKLE", "BÆRUM", "BØ", "BØMLO", "BÅTSFJORD",
    "DOVRE", "DRAMMEN", "DRANGEDAL", "DYRØY", "DØNNA", "EIDFJORD", "EIDSKOG",
    "EIDSVOLL", "EIGERSUND", "ELVERUM", "ENEBAKK", "ENGERDAL", "ETNE", "ETNEDAL",
    "EVENES", "EVJE OG HORNNES", "FARSUND", "FAUSKE", "FEDJE", "FITJAR", "FJALER",
    "FJORD", "FLAKSTAD", "FLATANGER", "FLEKKEFJORD", "FLESBERG", "FLÅ", "FOLLDAL",
    "FREDRIKSTAD", "FROGN", "FROLAND", "FROSTA", "FRØYA", "FYRESDAL", "FÆRDER",
    "GAMVIK", "GAUSDAL", "GILDESKÅL", "GISKE", "GJEMNES", "GJERDRUM", "GJERSTAD",
    "GJESDAL", "GJØVIK", "GLOPPEN", "GOL", "GRAN", "GRANE", "GRATANGEN", "GRIMSTAD",
    "GRONG", "GRUE", "GULEN", "HADSEL", "HALDEN", "HAMAR", "HAMARØY", "HAMMERFEST",
    "HARAM", "HAREID", "HARSTAD", "HASVIK", "HATTFJELLDAL", "HAUGESUND", "HEIM",
    "HEMNES", "HEMSEDAL", "HERØY", "HITRA", "HJARTDAL", "HJELMELAND", "HOL", "HOLE",
    "HOLMESTRAND", "HOLTÅLEN", "HORTEN", "HURDAL", "HUSTADVIKA", "HVALER", "HYLLESTAD",
    "HÆGEBOSTAD", "HØYANGER", "HØYLANDET", "HÅ", "IBESTAD", "INDERØY", "INDRE FOSEN",
    "INDRE ØSTFOLD", "IVELAND", "JEVNAKER", "KARASJOK", "KARLSØY", "KARMØY",
    "KAUTOKEINO", "KINN", "KLEPP", "KONGSBERG", "KONGSVINGER", "KRAGERØ",
    "KRISTIANSAND", "KRISTIANSUND", "KRØDSHERAD", "KVAM", "KVINESDAL", "KVINNHERAD",
    "KVITESEID", "KVITSØY", "KVÆFJORD", "KVÆNANGEN", "KÅFJORD", "LARVIK", "LAVANGEN",
    "LEBESBY", "LEIRFJORD", "LEKA", "LESJA", "LEVANGER", "LIER", "LIERNE",
    "LILLEHAMMER", "LILLESAND", "LILLESTRØM", "LINDESNES", "LOM", "LOPPA", "LUND",
    "LUNNER", "LURØY", "LUSTER", "LYNGDAL", "LYNGEN", "LÆRDAL", "LØDINGEN",
    "LØRENSKOG", "LØTEN", "MALVIK", "MARKER", "MASFJORDEN", "MELHUS", "MELØY",
    "MERÅKER", "MIDTRE GAULDAL", "MIDT-TELEMARK", "MODALEN", "MODUM", "MOLDE",
    "MOSKENES", "MOSS", "MÅLSELV", "MÅSØY", "NAMSOS", "NAMSSKOGAN", "NANNESTAD",
    "NARVIK", "NES", "NESBYEN", "NESNA", "NESODDEN", "NESSEBY", "NISSEDAL",
    "NITTEDAL", "NOME", "NORD-AURDAL", "NORD-FRON", "NORDKAPP", "NORD-ODAL",
    "NORDRE FOLLO", "NORDREISA", "NORDRE LAND", "NORE OG UVDAL", "NOTODDEN",
    "NÆRØYSUND", "OPPDAL", "ORKLAND", "OS", "OSEN", "OSLO", "OSTERØY", "OVERHALLA",
    "PORSANGER", "PORSGRUNN", "RAKKESTAD", "RANA", "RANDABERG", "RAUMA", "RENDALEN",
    "RENNEBU", "RINDAL", "RINGEBU", "RINGERIKE", "RINGSAKER", "RISØR", "ROLLAG",
    "RÆLINGEN", "RØDØY", "RØROS", "RØST", "RØYRVIK", "RÅDE", "SALANGEN", "SALTDAL",
    "SAMNANGER", "SANDE", "SANDEFJORD", "SANDNES", "SARPSBORG", "SAUDA", "SEL",
    "SELBU", "SELJORD", "SENJA", "SIGDAL", "SILJAN", "SIRDAL", "SKAUN", "SKIEN",
    "SKIPTVET", "SKJERVØY", "SKJÅK", "SMØLA", "SNÅSA", "SOGNDAL", "SOKNDAL", "SOLA",
    "SOLUND", "SORTLAND", "STAD", "STANGE", "STAVANGER", "STEIGEN", "STEINKJER",
    "STJØRDAL", "STORD", "STOR-ELVDAL", "STORFJORD", "STRAND", "STRANDA", "STRYN",
    "SULA", "SULDAL", "SUNNDAL", "SUNNFJORD", "SURNADAL", "SVALBARD", "SVEIO",
    "SYKKYLVEN", "SØMNA", "SØNDRE LAND", "SØR-AURDAL", "SØRFOLD", "SØR-FRON",
    "SØR-ODAL", "SØRREISA", "SØR-VARANGER", "TANA", "TIME", "TINGVOLL", "TINN",
    "TJELDSUND", "TOKKE", "TOLGA", "TROMSØ", "TRONDHEIM", "TRYSIL", "TRÆNA",
    "TVEDESTRAND", "TYDAL", "TYNSET", "TYSNES", "TYSVÆR", "TØNSBERG", "ULLENSAKER",
    "ULLENSVANG", "ULSTEIN", "ULVIK", "UTSIRA", "VADSØ", "VAKSDAL", "VALLE", "VANG",
    "VANYLVEN", "VARDØ", "VEFSN", "VEGA", "VEGÅRSHEI", "VENNESLA", "VERDAL", "VESTBY",
    "VESTNES", "VESTRE SLIDRE", "VESTRE TOTEN", "VESTVÅGØY", "VEVELSTAD", "VIK",
    "VINDAFJORD", "VINJE", "VOLDA", "VOSS", "VÆRØY", "VÅGAN", "VÅGÅ", "VÅLER",
    "ØKSNES", "ØRLAND", "ØRSTA", "ØSTRE TOTEN", "ØVRE EIKER", "ØYER", "ØYGARDEN",
    "ØYSTRE SLIDRE", "ÅFJORD", "ÅL", "ÅLESUND", "ÅMLI", "ÅMOT", "ÅRDAL", "ÅS",
    "ÅSERAL", "ÅSNES"
])

/** Total count of municipalities */
export const MUNICIPALITY_TOTAL = ALL_NORWEGIAN_MUNICIPALITIES.length // 356

/**
 * Sami and dual-language name mapping to canonical Norwegian names.
 * This ensures that when a user clicks a Sami region on the map (e.g., "Hábmer"),
 * it correctly maps to the Norwegian name used in the registry ("Hamarøy").
 */
export const SAMI_NAME_MAPPING: Record<string, string> = {
    "HÁBMER": "HAMARØY",
    "HABMER": "HAMARØY",
    "GUOVDAGEAIDNU": "KAUTOKEINO",
    "KARASJOHKA": "KARASJOK",
    "UNJÁRGA": "NESSEBY",
    "UNJARGA": "NESSEBY",
    "DEATNU": "TANA",
    "PORSÁŊGU": "PORSANGER",
    "PORSANGU": "PORSANGER",
    "GÁIVUOTNA": "KÅFJORD",
    "GAIVUOTNA": "KÅFJORD",
    "LOABÁT": "LAVANGEN",
    "LOABAT": "LAVANGEN",
    "RIVTTÁT": "GRATANGEN",
    "RIVTTAT": "GRATANGEN",
    "EVENÁŠŠI": "EVENES",
    "EVENASSI": "EVENES",
    "SKÁNIT": "TJELDSUND",
    "SKANIT": "TJELDSUND",
    "DIERVI": "STORFJORD",
    "BÁHCCEVEAJDNI": "BÅTSFJORD",
    "BAHCCEVEAJDNI": "BÅTSFJORD",
    "BÁIDÁR": "BEIARN",
    "BAIDAR": "BEIARN",
    "AARBORTE": "HATTFJELLDAL",
    "AARPORTE": "HATTFJELLDAL",
}

/**
 * Format municipality name for display (Title Case)
 * Prioritizes canonical Norwegian names and includes Sami name in parentheses if applicable.
 */
export function formatMunicipalityName(name: string): string {
    // 1. Handle dual names from map (e.g. "Aarborte - Hattfjelldal" or just "Aarborte")
    const parts = name.includes(' - ') ? name.split(' - ') : [name];

    // Check if any part is a Sami name that maps to a Norwegian name
    let norwegianName = '';
    let samiName = '';

    for (const part of parts) {
        const upper = part.toUpperCase();
        if (SAMI_NAME_MAPPING[upper]) {
            norwegianName = SAMI_NAME_MAPPING[upper];
            samiName = part;
            break;
        }
    }

    // If no part matched mapping, but we have multiple parts, assume first is Sami, second is Norwegian
    if (!norwegianName && parts.length > 1) {
        samiName = parts[0];
        norwegianName = parts[1];
    } else if (!norwegianName) {
        // Fallback: use the provided name as norwegian
        norwegianName = name;
    }

    const toTitleCase = (str: string) => {
        const words = str.toLowerCase().split(/[\s-]+/).filter(Boolean);
        let result = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        // Re-insert dashes for specific Norwegian names (e.g. Sør-Varanger) if original had them
        if (str.includes('-') && !str.includes(' - ')) {
            result = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-');
        }
        return result;
    };

    const formattedNorwegian = toTitleCase(norwegianName);

    // If we have a distinct Sami name, show both: "Hattfjelldal (Aarborte)"
    if (samiName && samiName.toUpperCase() !== norwegianName.toUpperCase()) {
        return `${formattedNorwegian} (${toTitleCase(samiName)})`;
    }

    return formattedNorwegian;
}
