export const createMockCompany = (overrides = {}) => ({
    orgnr: '993144169',
    navn: 'BEDRIFTSGRAFEN TEST AS',
    adresse: 'Testgata 10',
    postnummer: '0123',
    poststed: 'TESTBY',
    stiftelsesdato: '2015-05-15',
    organisasjonsform: 'AS',
    status: 'Aktiv',
    bransje: {
        kode: '62.010',
        navn: 'Programmeringstjenester'
    },
    regnskap: [
        {
            aar: 2023,
            omsetning: 5000000,
            driftsresultat: 500000,
            resultat_for_skatt: 450000,
            arsresultat: 350000,
            egenkapital: 2000000,
            gjeld: 1000000,
            antall_ansatte: 5,
            profit_margin: 10,
            operating_margin: 10
        }
    ],
    roller: [],
    underenheter: [],
    ...overrides
})

export const createMockAccounting = (overrides = {}) => ({
    aar: 2023,
    omsetning: 1000000,
    driftsresultat: 100000,
    resultat_for_skatt: 90000,
    arsresultat: 70000,
    egenkapital: 500000,
    gjeld: 200000,
    antall_ansatte: 2,
    profit_margin: 9,
    operating_margin: 10,
    ...overrides
})

export const createMockBenchmarkMetric = (overrides = {}) => ({
    company_value: 1000,
    industry_avg: 800,
    industry_median: 750,
    percentile: 75,
    ...overrides
})
