import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject, Feature, Geometry, FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../../utils/apiClient';
import { formatNumber, cleanOrgnr } from '../../utils/formatters';
import { formatMunicipalityName } from '../../constants/municipalities';
import { MapSidebar } from './MapSidebar';
import { MapView } from './MapView';
import { RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { MapFilterValues } from '../../types/map';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';

// Internal Parts
import { getColor } from './parts/mapUtils';
import type { GeoStat, GeoAverages, RegionProperties, GeoLevel } from './parts/types';

// ============================================================================
// Constants
// ============================================================================

const COUNTIES = [
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
];

const METRIC_LABELS: Readonly<Record<string, string>> = {
    company_count: 'Antall bedrifter',
    new_last_year: 'Nye selskaper',
    bankrupt_count: 'Konkurser',
} as const;

// ============================================================================
// Types
// ============================================================================

interface IndustryMapProps {
    selectedNace?: string | null;
    metric?: 'company_count' | 'new_last_year' | 'bankrupt_count';
    onRegionClick?: (regionName: string, regionCode: string, level: GeoLevel) => void;
    onSearchClick?: (regionName: string, regionCode: string, naceCode: string | null) => void;
    onCompanyClick?: (orgnr: string) => void;
    // Explorer sync props
    countyFromExplorer?: string;
    countyCodeFromExplorer?: string;
    municipalityFromExplorer?: string;
    municipalityCodeFromExplorer?: string;
    // New filters from explorer
    organizationForms?: string[];
    revenueMin?: number | null;
    revenueMax?: number | null;
    profitMin?: number | null;
    profitMax?: number | null;
    equityMin?: number | null;
    equityMax?: number | null;
    operatingProfitMin?: number | null;
    operatingProfitMax?: number | null;
    liquidityRatioMin?: number | null;
    liquidityRatioMax?: number | null;
    equityRatioMin?: number | null;
    equityRatioMax?: number | null;
    employeeMin?: number | null;
    employeeMax?: number | null;
    foundedFrom?: string | null;
    foundedTo?: string | null;
    bankruptFrom?: string | null;
    bankruptTo?: string | null;
    registeredFrom?: string | null;
    registeredTo?: string | null;
    isBankrupt?: boolean | null;
    inLiquidation?: boolean | null;
    inForcedLiquidation?: boolean | null;
    hasAccounting?: boolean | null;
    query?: string | null;

    // Direct filter props for Sidebar consolidation
    filters?: MapFilterValues;
    onFilterChange?: (updates: Partial<MapFilterValues>) => void;
    onClearFilters?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function IndustryMap({
    selectedNace,
    metric = 'company_count',
    onRegionClick,
    onSearchClick,
    onCompanyClick,
    countyFromExplorer,
    countyCodeFromExplorer,
    municipalityFromExplorer,
    municipalityCodeFromExplorer,
    organizationForms,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    equityMin,
    equityMax,
    operatingProfitMin,
    operatingProfitMax,
    liquidityRatioMin,
    liquidityRatioMax,
    equityRatioMin,
    equityRatioMax,
    employeeMin,
    employeeMax,
    foundedFrom,
    foundedTo,
    bankruptFrom,
    bankruptTo,
    registeredFrom,
    registeredTo,
    isBankrupt,
    inLiquidation,
    inForcedLiquidation,
    hasAccounting,
    query,
    filters,
    onFilterChange,
    onClearFilters
}: IndustryMapProps) {
    const navigate = useNavigate();

    // Initialize state
    const [level, setLevel] = useState<GeoLevel>(() =>
        (municipalityFromExplorer || municipalityCodeFromExplorer) ? 'municipality' : 'county'
    );

    const [selectedCounty, setSelectedCounty] = useState<string>(() => {
        if (countyCodeFromExplorer) return countyCodeFromExplorer;
        if (municipalityCodeFromExplorer) return municipalityCodeFromExplorer.slice(0, 2);
        if (countyFromExplorer) {
            return COUNTIES.find(c => c.name === countyFromExplorer)?.code || '';
        }
        return '';
    });

    const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
    const [geoDataError, setGeoDataError] = useState<string | null>(null);
    const [hoveredRegion, setHoveredRegion] = useState<{ name: string; value: number } | null>(null);

    const [selectedRegion, setSelectedRegion] = useState<{ name: string; code: string } | null>(() => {
        if (municipalityCodeFromExplorer && municipalityFromExplorer) {
            return { name: municipalityFromExplorer, code: municipalityCodeFromExplorer };
        }
        if (countyCodeFromExplorer) {
            const countyName = COUNTIES.find(c => c.code === countyCodeFromExplorer)?.name || countyFromExplorer || 'Ukjent';
            return { name: countyName, code: countyCodeFromExplorer };
        }
        if (countyFromExplorer) {
            const countyName = COUNTIES.find(c => c.code === countyFromExplorer)?.name || countyFromExplorer;
            return { name: countyName, code: countyFromExplorer };
        }
        return null;
    });



    const prevExplorerPropsRef = useRef({ countyFromExplorer, countyCodeFromExplorer, municipalityCodeFromExplorer, municipalityFromExplorer });

    // Fetch geographic stats
    const { data: geoStats, isLoading, isError, refetch, isRefetching } = useQuery<GeoStat[]>({
        queryKey: [
            'geographyStats',
            level,
            selectedNace,
            metric,
            selectedCounty,
            organizationForms,
            revenueMin, revenueMax,
            profitMin, profitMax,
            equityMin, equityMax,
            operatingProfitMin, operatingProfitMax,
            liquidityRatioMin, liquidityRatioMax,
            equityRatioMin, equityRatioMax,
            employeeMin, employeeMax,
            foundedFrom, foundedTo,
            bankruptFrom, bankruptTo,
            registeredFrom, registeredTo,
            isBankrupt,
            inLiquidation,
            inForcedLiquidation,
            hasAccounting,
            query
        ],
        queryFn: async () => {
            const params = new URLSearchParams({ level, metric });
            if (selectedNace) params.set('nace', selectedNace);
            if (query) params.set('name', query);
            if (level === 'municipality' && selectedCounty) params.set('county_code', selectedCounty);

            organizationForms?.forEach(form => params.append('organisasjonsform', form));

            // Ranges
            const ranges = [
                ['revenue', revenueMin, revenueMax],
                ['profit', profitMin, profitMax],
                ['equity', equityMin, equityMax],
                ['operating_profit', operatingProfitMin, operatingProfitMax],
                ['liquidity_ratio', liquidityRatioMin, liquidityRatioMax],
                ['equity_ratio', equityRatioMin, equityRatioMax],
                ['employee', employeeMin, employeeMax]
            ];

            ranges.forEach(([name, min, max]) => {
                if (min != null) params.set(`${name}_min`, min.toString());
                if (max != null) params.set(`${name}_max`, max.toString());
            });

            // Dates
            if (foundedFrom) params.set('founded_from', foundedFrom);
            if (foundedTo) params.set('founded_to', foundedTo);
            if (bankruptFrom) params.set('bankrupt_from', bankruptFrom);
            if (bankruptTo) params.set('bankrupt_to', bankruptTo);
            if (registeredFrom) params.set('registered_from', registeredFrom);
            if (registeredTo) params.set('registered_to', registeredTo);

            // Boolean Flags
            if (isBankrupt !== null && isBankrupt !== undefined) params.set('is_bankrupt', isBankrupt.toString());
            if (inLiquidation !== null && inLiquidation !== undefined) params.set('in_liquidation', inLiquidation.toString());
            if (inForcedLiquidation !== null && inForcedLiquidation !== undefined) params.set('in_forced_liquidation', inForcedLiquidation.toString());
            if (hasAccounting !== null && hasAccounting !== undefined) params.set('has_accounting', hasAccounting.toString());

            const { data } = await apiClient.get<GeoStat[]>(`/v1/stats/geography?${params}`);
            return data;
        },
        staleTime: 1000 * 60 * 30,
        retry: 2,
    });

    const statsMap = useMemo(() => {
        const map = new Map<string, GeoStat>();
        geoStats?.forEach(stat => map.set(stat.code, stat));
        return map;
    }, [geoStats]);

    useEffect(() => {
        const prev = prevExplorerPropsRef.current;
        const hasChanged =
            prev.countyFromExplorer !== countyFromExplorer ||
            prev.countyCodeFromExplorer !== countyCodeFromExplorer ||
            prev.municipalityCodeFromExplorer !== municipalityCodeFromExplorer ||
            prev.municipalityFromExplorer !== municipalityFromExplorer;

        if (hasChanged && geoData) {
            queueMicrotask(() => {
                if (municipalityCodeFromExplorer) {
                    const countyCode = municipalityCodeFromExplorer.slice(0, 2);
                    setLevel('municipality');
                    setSelectedCounty(countyCode);
                    if (municipalityFromExplorer) {
                        setSelectedRegion({
                            name: municipalityFromExplorer,
                            code: municipalityCodeFromExplorer
                        });
                    }
                } else if (countyCodeFromExplorer) {
                    setLevel('county');
                    setSelectedCounty('');
                    const countyName = COUNTIES.find(c => c.code === countyCodeFromExplorer)?.name || countyFromExplorer || 'Ukjent';
                    setSelectedRegion({ name: countyName, code: countyCodeFromExplorer });
                } else if (countyFromExplorer) {
                    setLevel('county');
                    setSelectedCounty('');
                    const countyName = COUNTIES.find(c => c.code === countyFromExplorer)?.name || countyFromExplorer;
                    setSelectedRegion({ name: countyName, code: countyFromExplorer });
                } else if (municipalityFromExplorer) {
                    const featureCollection = geoData as FeatureCollection<Geometry, RegionProperties>;
                    const features = featureCollection.features;
                    const found = features.find(f => {
                        const rawName = f.properties.kommunenavn || f.properties.fylkesnavn || f.properties.name;
                        return formatMunicipalityName(rawName) === municipalityFromExplorer;
                    });

                    if (found) {
                        const code = found.properties.kommunenummer || found.properties.id;
                        setLevel('municipality');
                        if (code) {
                            setSelectedCounty(code.slice(0, 2));
                            setSelectedRegion({ name: municipalityFromExplorer, code });
                        }
                    }
                } else {
                    setLevel('county');
                    setSelectedCounty('');
                    setSelectedRegion(null);
                }
            });
            prevExplorerPropsRef.current = { countyFromExplorer, countyCodeFromExplorer, municipalityCodeFromExplorer, municipalityFromExplorer };
        }
    }, [countyFromExplorer, countyCodeFromExplorer, municipalityCodeFromExplorer, municipalityFromExplorer, geoData]);

    useEffect(() => {
        const abortController = new AbortController();
        const file = level === 'county' ? '/norway-counties.geojson?v=2' : '/norway-municipalities.geojson?v=2';

        fetch(file, { signal: abortController.signal })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                setGeoData(data);
                setGeoDataError(null);
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    setGeoDataError('Kunne ikke laste kartdata');
                }
            });

        return () => abortController.abort();
    }, [level]);

    const { data: averages } = useQuery<GeoAverages>({
        queryKey: [
            'geographyAverages',
            level,
            selectedNace,
            metric,
            selectedCounty,
            organizationForms,
            revenueMin, revenueMax,
            profitMin, profitMax,
            equityMin, equityMax,
            operatingProfitMin, operatingProfitMax,
            liquidityRatioMin, liquidityRatioMax,
            equityRatioMin, equityRatioMax,
            employeeMin, employeeMax,
            foundedFrom, foundedTo,
            bankruptFrom, bankruptTo,
            registeredFrom, registeredTo,
            isBankrupt,
            inLiquidation,
            inForcedLiquidation,
            hasAccounting,
            query
        ],
        queryFn: async () => {
            const params = new URLSearchParams({ level, metric });
            if (selectedNace) params.set('nace', selectedNace);
            if (query) params.set('name', query);
            if (level === 'municipality' && selectedCounty) params.set('county_code', selectedCounty);

            organizationForms?.forEach(form => params.append('organisasjonsform', form));

            // Ranges
            const ranges = [
                ['revenue', revenueMin, revenueMax],
                ['profit', profitMin, profitMax],
                ['equity', equityMin, equityMax],
                ['operating_profit', operatingProfitMin, operatingProfitMax],
                ['liquidity_ratio', liquidityRatioMin, liquidityRatioMax],
                ['equity_ratio', equityRatioMin, equityRatioMax],
                ['employee', employeeMin, employeeMax]
            ];

            ranges.forEach(([name, min, max]) => {
                if (min != null) params.set(`${name}_min`, min.toString());
                if (max != null) params.set(`${name}_max`, max.toString());
            });

            // Dates
            if (foundedFrom) params.set('founded_from', foundedFrom);
            if (foundedTo) params.set('founded_to', foundedTo);
            if (bankruptFrom) params.set('bankrupt_from', bankruptFrom);
            if (bankruptTo) params.set('bankrupt_to', bankruptTo);
            if (registeredFrom) params.set('registered_from', registeredFrom);
            if (registeredTo) params.set('registered_to', registeredTo);

            // Boolean Flags
            if (isBankrupt !== null && isBankrupt !== undefined) params.set('is_bankrupt', isBankrupt.toString());
            if (inLiquidation !== null && inLiquidation !== undefined) params.set('in_liquidation', inLiquidation.toString());
            if (inForcedLiquidation !== null && inForcedLiquidation !== undefined) params.set('in_forced_liquidation', inForcedLiquidation.toString());
            if (hasAccounting !== null && hasAccounting !== undefined) params.set('has_accounting', hasAccounting.toString());

            const { data } = await apiClient.get<GeoAverages>(`/v1/stats/geography/averages?${params}`);
            return data;
        },
        staleTime: 1000 * 60 * 30,
    });

    const getValue = useCallback((stat?: GeoStat) => {
        if (!stat) return 0;
        if (filters?.showPerCapita) return stat.companies_per_capita || 0;
        return stat.value;
    }, [filters?.showPerCapita]);

    const selectedRegionData = useMemo(() => {
        if (!selectedRegion) return null;
        const stat = statsMap.get(selectedRegion.code);

        return {
            name: selectedRegion.name,
            code: selectedRegion.code,
            value: stat ? getValue(stat) : 0,
            perCapita: stat?.companies_per_capita,
            population: stat?.population
        };
    }, [selectedRegion, statsMap, getValue]);

    const maxValue = useMemo(() => {
        if (!geoStats?.length) return 0;
        return Math.max(...geoStats.map(s => getValue(s)));
    }, [geoStats, getValue]);

    const style = useCallback((feature: Feature<Geometry, RegionProperties> | undefined) => {
        if (!feature?.properties) return {};
        const code = feature.properties.kommunenummer || feature.properties.fylkesnummer || feature.properties.id;
        const fylkesnummer = feature.properties.fylkesnummer || (code?.length === 4 ? code.slice(0, 2) : undefined);

        const stat = statsMap.get(code);
        const value = getValue(stat);
        const isSelected = selectedRegion?.code === code || (selectedRegion?.code?.length === 2 && fylkesnummer === selectedRegion.code);

        return {
            fillColor: getColor(value, maxValue),
            weight: isSelected ? 2 : (level === 'county' ? 1 : 0.5),
            opacity: 1,
            color: isSelected ? '#1e40af' : '#64748b',
            fillOpacity: isSelected ? 0 : 0.5,
        };
    }, [statsMap, maxValue, level, getValue, selectedRegion]);

    const generateTooltip = useCallback((name: string, value: number, population?: number) => {
        const label = filters?.showPerCapita ? `${(METRIC_LABELS[metric] || 'Verdi').toLowerCase()} per 1000 innb.` : (METRIC_LABELS[metric]?.toLowerCase() || '');
        const formattedValue = filters?.showPerCapita ? value.toFixed(1) : formatNumber(value);
        const popText = filters?.showPerCapita && population ? `<span class="text-xs text-gray-400">(${formatNumber(population)} innb.)</span><br/>` : '';
        return `<strong>${name}</strong><br/>${formattedValue} ${label}<br/>${popText}<em>Klikk for detaljer</em>`;
    }, [filters?.showPerCapita, metric]);

    const onEachFeature = useCallback((feature: Feature<Geometry, RegionProperties>, layer: L.Layer) => {
        const code = feature.properties.kommunenummer || feature.properties.fylkesnummer || feature.properties.id;
        const rawName = feature.properties.kommunenavn || feature.properties.fylkesnavn || feature.properties.name;
        const isMunicipality = !!feature.properties.kommunenummer || (code?.length === 4);
        const name = isMunicipality ? formatMunicipalityName(rawName) : rawName;

        const stat = statsMap.get(code);
        const value = getValue(stat);

        layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
                e.target.setStyle({ weight: 3, color: '#1e40af', fillOpacity: 0.7 });
                e.target.bringToFront();
                setHoveredRegion({ name, value });
            },
            mouseout: (e: L.LeafletMouseEvent) => {
                const isThisSelected = selectedRegion?.code === code;
                e.target.setStyle({
                    weight: isThisSelected ? 2 : (level === 'county' ? 1 : 0.5),
                    color: isThisSelected ? '#1e40af' : '#64748b',
                    fillOpacity: isThisSelected ? 0 : 0.5
                });
                setHoveredRegion(null);
            },
            click: (e: L.LeafletMouseEvent) => {
                e.target.setStyle({ fillOpacity: 0, weight: 2, color: '#1e40af' });
                setSelectedRegion({ name, code });
                onRegionClick?.(name, code, level);
            },
        });

        layer.bindTooltip(
            generateTooltip(name, value, stat?.population),
            { sticky: true, className: 'region-tooltip' }
        );
    }, [statsMap, level, onRegionClick, getValue, generateTooltip, selectedRegion]);

    if (geoDataError) return (
        <div className="h-[600px] flex flex-col items-center justify-center border border-slate-200 rounded-xl bg-slate-50 gap-4">
            <ErrorState title="Kartfeil" message={geoDataError} onRetry={() => setGeoData(null)} />
        </div>
    );

    if (!geoData) return (
        <div className="h-[600px] bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200">
            <LoadingState message="Laster kartdata..." />
        </div>
    );

    if (isError) return (
        <div className="h-[600px] flex flex-col items-center justify-center border border-slate-200 rounded-xl bg-slate-50 gap-4">
            <ErrorState title="Tjenestefeil" message="Kunne ikke hente statistikk" onRetry={() => refetch()} />
        </div>
    );

    const metricLabel = filters?.showPerCapita ? 'Bedrifter pr 1000 innb.' : (METRIC_LABELS[metric] || 'Verdi');

    return (
        <div className="flex flex-col md:flex-row h-full rounded-xl overflow-hidden border border-slate-200 shadow-xl bg-white">
            <div className="flex-1 order-1 md:order-2 relative bg-slate-50 min-h-[400px]">
                <div className="absolute top-4 right-4 z-1000">
                    <button
                        onClick={() => refetch()}
                        className="bg-white/90 backdrop-blur-sm rounded-full shadow-lg p-2.5 hover:bg-white hover:scale-110 transition-all active:scale-95 disabled:opacity-50 border border-slate-100"
                        title="Oppdater kartdata"
                    >
                        <RefreshCw className={clsx("h-4 w-4 text-slate-600", isRefetching ? "animate-spin" : "")} />
                    </button>
                </div>

                <MapView
                    level={level}
                    selectedNace={selectedNace}
                    metric={metric}
                    selectedCounty={selectedCounty}
                    geoData={geoData}
                    geoStats={geoStats}
                    selectedRegionCode={selectedRegion?.code || null}
                    style={style}
                    onEachFeature={onEachFeature}
                    onCompanyClick={(orgnr: string) => {
                        const clean = cleanOrgnr(orgnr) || orgnr;
                        if (onCompanyClick) {
                            onCompanyClick(clean);
                        } else {
                            navigate({ to: '/bedrift/$orgnr', params: { orgnr: clean } });
                        }
                    }}
                    municipalityName={level === 'municipality' && selectedRegionData && selectedRegionData.code.length === 4 ? selectedRegionData.name : undefined}
                    municipalityCode={level === 'municipality' && selectedRegionData && selectedRegionData.code.length === 4 ? selectedRegionData.code : undefined}
                    organizationForms={organizationForms}
                    revenueMin={revenueMin}
                    revenueMax={revenueMax}
                    profitMin={profitMin}
                    profitMax={profitMax}
                    equityMin={equityMin}
                    equityMax={equityMax}
                    operatingProfitMin={operatingProfitMin}
                    operatingProfitMax={operatingProfitMax}
                    liquidityRatioMin={liquidityRatioMin}
                    liquidityRatioMax={liquidityRatioMax}
                    equityRatioMin={equityRatioMin}
                    equityRatioMax={equityRatioMax}
                    employeeMin={employeeMin}
                    employeeMax={employeeMax}
                    foundedFrom={foundedFrom}
                    foundedTo={foundedTo}
                    bankruptFrom={bankruptFrom}
                    bankruptTo={bankruptTo}
                    registeredFrom={registeredFrom}
                    registeredTo={registeredTo}
                    isBankrupt={isBankrupt}
                    inLiquidation={inLiquidation}
                    inForcedLiquidation={inForcedLiquidation}
                    hasAccounting={hasAccounting}
                    query={query}
                />

                {isLoading && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-1001 animate-in fade-in">
                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-2xl border border-slate-100" style={{ pointerEvents: 'auto' }}>
                            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-blue-600 border-t-transparent" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Henter data...</p>
                        </div>
                    </div>
                )}
            </div>

            <MapSidebar
                className="order-2 md:order-1"
                level={level}
                setLevel={(l) => {
                    setLevel(l);
                    if (l === 'county') setSelectedCounty('');
                    if (onFilterChange) onFilterChange({ municipalityCode: null });
                }}
                selectedRegionData={selectedRegionData}
                hoveredRegion={hoveredRegion}
                maxValue={maxValue}
                metricLabel={metricLabel}
                averages={averages}
                onCloseRegion={() => setSelectedRegion(null)}
                onShowCompanies={(name, code) => {
                    if (onSearchClick) onSearchClick(name, code, selectedNace || null);
                    else {
                        const normalizedName = formatMunicipalityName(name);
                        const isCounty = code.length === 2;
                        sessionStorage.setItem('mapFilter', JSON.stringify({
                            county: isCounty ? code : '',
                            municipality: isCounty ? '' : normalizedName,
                            municipality_code: isCounty ? '' : code,
                            nace: selectedNace,
                        }));
                        navigate({ to: '/bransjer', search: { nace: selectedNace || undefined } });
                    }
                }}
                filters={filters || {
                    query: query || null,
                    naceCode: selectedNace || null,
                    countyCode: countyCodeFromExplorer || null,
                    municipalityCode: municipalityCodeFromExplorer || null,
                    organizationForms: organizationForms || [],
                    revenueMin: revenueMin || null,
                    revenueMax: revenueMax || null,
                    profitMin: profitMin || null,
                    profitMax: profitMax || null,
                    equityMin: equityMin || null,
                    equityMax: equityMax || null,
                    operatingProfitMin: operatingProfitMin || null,
                    operatingProfitMax: operatingProfitMax || null,
                    liquidityRatioMin: liquidityRatioMin || null,
                    liquidityRatioMax: liquidityRatioMax || null,
                    equityRatioMin: equityRatioMin || null,
                    equityRatioMax: equityRatioMax || null,
                    employeeMin: employeeMin || null,
                    employeeMax: employeeMax || null,
                    foundedFrom: foundedFrom || null,
                    foundedTo: foundedTo || null,
                    bankruptFrom: bankruptFrom || null,
                    bankruptTo: bankruptTo || null,
                    isBankrupt: isBankrupt || null,
                    inLiquidation: inLiquidation || null,
                    inForcedLiquidation: inForcedLiquidation || null,
                    hasAccounting: hasAccounting || null,
                    showPerCapita: false,
                }}
                onFilterChange={onFilterChange || (() => { })}
                onClearFilters={onClearFilters || (() => { })}
            />
        </div>
    );
}
