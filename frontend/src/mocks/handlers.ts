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

    // Mock person sparklines
    http.get('*/api/v1/people/sparklines', () => {
        return HttpResponse.json([
            { month: '2025-01', active_roles: 2 },
            { month: '2025-02', active_roles: 3 },
            { month: '2025-03', active_roles: 3 },
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
    }),

    // Mock person toplists
    http.get('*/api/v1/people/toplists', () => {
        return HttpResponse.json([
            {
                category: 'active_roles',
                entries: [
                    { rank: 1, name: 'Ola Nordmann', birth_year: 1970, value: 120, active_roles: 120, active_companies: 45 },
                    { rank: 2, name: 'Kari Hansen', birth_year: 1965, value: 98, active_roles: 98, active_companies: 32 },
                ],
            },
            {
                category: 'LEDE',
                entries: [
                    { rank: 1, name: 'Trude Moen', birth_year: 1972, value: 50, active_roles: 80, active_companies: 50 },
                ],
            },
            {
                category: 'DAGL',
                entries: [
                    { rank: 1, name: 'Egil Langemyr', birth_year: 1968, value: 40, active_roles: 100, active_companies: 40 },
                ],
            },
            {
                category: 'MEDL',
                entries: [
                    { rank: 1, name: 'Per Olsen', birth_year: 1975, value: 60, active_roles: 90, active_companies: 35 },
                ],
            },
            {
                category: 'active_companies',
                entries: [
                    { rank: 1, name: 'Nils Berg', birth_year: 1980, value: 55, active_roles: 70, active_companies: 55 },
                ],
            },
            {
                category: 'industry_diversity',
                entries: [
                    { rank: 1, name: 'Rune Plener', birth_year: 1960, value: 30, active_roles: 60, active_companies: 30 },
                ],
            },
        ])
    }),

    // Mock person aggregate stats
    http.get('*/api/v1/people/stats', () => {
        return HttpResponse.json({
            total_persons: 906050,
            total_active_roles: 1842630,
            avg_board_age: 53,
            role_type_distribution: [
                { type_kode: 'MEDL', type_beskrivelse: 'Styremedlem', count: 580000 },
                { type_kode: 'DAGL', type_beskrivelse: 'Daglig leder', count: 420000 },
                { type_kode: 'LEDE', type_beskrivelse: 'Styrets leder', count: 350000 },
            ],
            generation_distribution: [
                { generation: 'Gen X', birth_year_range: '1965-1980', count: 531000 },
                { generation: 'Millennials', birth_year_range: '1981-1996', count: 447000 },
                { generation: 'Boomers', birth_year_range: '1946-1964', count: 246000 },
                { generation: 'Gen Z', birth_year_range: '1997-2012', count: 65000 },
            ],
        })
    }),
]
