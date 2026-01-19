export interface GeoStat {
    code: string;
    name: string;
    value: number;
    population?: number;
    companies_per_capita?: number;
}

export interface GeoAverages {
    national_avg: number;
    national_total: number;
    county_avg?: number;
    county_total?: number;
    county_name?: string;
}

export interface RegionProperties {
    id: string;
    name: string;
    fylkesnummer?: string;
    fylkesnavn?: string;
    kommunenummer?: string;
    kommunenavn?: string;
}

export type GeoLevel = 'county' | 'municipality';

export interface SelectedRegion {
    name: string;
    code: string;
}
