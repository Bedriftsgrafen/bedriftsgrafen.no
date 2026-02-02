import { http, HttpResponse } from 'msw'

export const handlers = [
    // Mock company detail
    http.get('*/api/v1/companies/:orgnr', ({ params }) => {
        const { orgnr } = params
        return HttpResponse.json({
            orgnr: orgnr,
            navn: 'MOCK COMPANY AS',
            adresse: 'Testveien 1',
            postnummer: '0001',
            poststed: 'OSLO',
            stiftelsesdato: '2020-01-01',
            organisasjonsform: 'AS',
            status: 'Aktiv',
            bransje: {
                kode: '62.010',
                navn: 'Programmeringstjenester'
            },
            regnskap: [],
            roller: [],
            underenheter: []
        })
    }),

    // Mock person roles
    http.get('*/api/v1/people/roles', () => {
        return HttpResponse.json([
            {
                orgnr: '993144169',
                enhet_navn: 'MOCK COMPANY AS',
                type_kode: 'DAGL',
                type_beskrivelse: 'Daglig leder',
                fratraadt: false
            },
            {
                orgnr: '883144169',
                enhet_navn: 'HISTORICAL CORP',
                type_kode: 'STRE',
                type_beskrivelse: 'Styreleder',
                fratraadt: true
            }
        ])
    }),

    // Mock municipality dashboard
    http.get('*/api/v1/municipality/:code', ({ params }) => {
        const { code } = params
        return HttpResponse.json({
            code: code,
            name: 'MOCK KOMMUNE',
            county_code: '03',
            county_name: 'OSLO',
            population: 700000,
            population_growth_1y: 1.2,
            company_count: 50000,
            business_density: 71.4,
            business_density_national_avg: 68.5,
            lat: 59.91,
            lng: 10.75,
            top_sectors: [],
            top_companies: [],
            newest_companies: [],
            latest_bankruptcies: [],
            establishment_trend: [],
            ranking_in_county_density: { rank: 1, out_of: 1 },
            ranking_in_county_revenue: { rank: 1, out_of: 1 },
            ranking_in_county_population: { rank: 1, out_of: 1 }
        })
    }),

    // Mock postal coordinates
    http.get('*/postal-coords.json', () => {
        return HttpResponse.json({
            '0001': [59.9, 10.7],
            '1234': [60.0, 11.0]
        })
    })
]
