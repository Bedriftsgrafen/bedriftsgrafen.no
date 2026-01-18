import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJsonObject, Feature, Geometry, FeatureCollection } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../../utils/apiClient';
import { formatNumber } from '../../utils/formatters';
import { RefreshCw, Users } from 'lucide-react';
import { CompanyMarkers } from './CompanyMarkers';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';
import { formatMunicipalityName } from '../../constants/municipalities';

// Internal Parts
import { Legend } from './parts/Legend';
import { AveragesBox } from './parts/AveragesBox';
import { NorwayBounds } from './parts/NorwayBounds';
import { MapAutoZoomer } from './parts/MapAutoZoomer';
import { RegionInfoPanel } from './parts/RegionInfoPanel';
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
    new_last_year: 'Nye siste år',
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
    employeeMin?: number | null;
    employeeMax?: number | null;
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
    employeeMin,
    employeeMax
}: IndustryMapProps) {
    const navigate = useNavigate();

    // Initialize state
    const [level, setLevel] = useState<GeoLevel>(() =>
        (municipalityFromExplorer || municipalityCodeFromExplorer) ? 'municipality' : 'county'
    );

    const [selectedCounty, setSelectedCounty] = useState<string>(() => {
        if (countyCodeFromExplorer) return countyCodeFromExplorer;
        if (municipalityCodeFromExplorer) return municipalityCodeFromExplorer.slice(0, 2);
        // If we only have a name (legacy/edge case), try to find the code or return empty
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

    const [showPerCapita, setShowPerCapita] = useState(false);

    // Track previous explorer props
    const prevExplorerPropsRef = useRef({ countyFromExplorer, countyCodeFromExplorer, municipalityCodeFromExplorer, municipalityFromExplorer });

    // Fetch geographic stats
    const { data: geoStats, isLoading, isError, refetch, isRefetching } = useQuery<GeoStat[]>({
        queryKey: ['geographyStats', level, selectedNace, metric, selectedCounty, organizationForms, revenueMin, revenueMax, employeeMin, employeeMax],
        queryFn: async () => {
            const params = new URLSearchParams({ level, metric });
            if (selectedNace) params.set('nace', selectedNace);
            if (level === 'municipality' && selectedCounty) params.set('county_code', selectedCounty);

            // Add advanced filters
            organizationForms?.forEach(form => params.append('org_form', form));
            if (revenueMin != null) params.set('revenue_min', revenueMin.toString());
            if (revenueMax != null) params.set('revenue_max', revenueMax.toString());
            if (employeeMin != null) params.set('employee_min', employeeMin.toString());
            if (employeeMax != null) params.set('employee_max', employeeMax.toString());

            const { data } = await apiClient.get<GeoStat[]>(`/v1/stats/geography?${params}`);
            return data;
        },
        staleTime: 1000 * 60 * 30,
        retry: 2,
    });

    // Create lookup map
    const statsMap = useMemo(() => {
        const map = new Map<string, GeoStat>();
        geoStats?.forEach(stat => map.set(stat.code, stat));
        return map;
    }, [geoStats]);

    // Effect to sync when explorer props change
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
                    // Fallback: Resolve code by name from geoData
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
                    // All filters cleared - reset to national level
                    setLevel('county');
                    setSelectedCounty('');
                    setSelectedRegion(null);
                }
            });
            prevExplorerPropsRef.current = { countyFromExplorer, countyCodeFromExplorer, municipalityCodeFromExplorer, municipalityFromExplorer };
        }
    }, [countyFromExplorer, countyCodeFromExplorer, municipalityCodeFromExplorer, municipalityFromExplorer, geoData]);

    // Fetch GeoJSON
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

    // Fetch averages
    const { data: averages } = useQuery<GeoAverages>({
        queryKey: ['geographyAverages', level, selectedNace, metric, selectedCounty, organizationForms, revenueMin, revenueMax, employeeMin, employeeMax],
        queryFn: async () => {
            const params = new URLSearchParams({ level, metric });
            if (selectedNace) params.set('nace', selectedNace);
            if (level === 'municipality' && selectedCounty) params.set('county_code', selectedCounty);

            // Add advanced filters
            organizationForms?.forEach(form => params.append('org_form', form));
            if (revenueMin != null) params.set('revenue_min', revenueMin.toString());
            if (revenueMax != null) params.set('revenue_max', revenueMax.toString());
            if (employeeMin != null) params.set('employee_min', employeeMin.toString());
            if (employeeMax != null) params.set('employee_max', employeeMax.toString());

            const { data } = await apiClient.get<GeoAverages>(`/v1/stats/geography/averages?${params}`);
            return data;
        },
        staleTime: 1000 * 60 * 30,
    });

    const getValue = useCallback((stat?: GeoStat) => {
        if (!stat) return 0;
        if (showPerCapita) return stat.companies_per_capita || 0;
        return stat.value;
    }, [showPerCapita]);

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
        const label = showPerCapita ? `${(METRIC_LABELS[metric] || 'Verdi').toLowerCase()} per 1000 innb.` : (METRIC_LABELS[metric]?.toLowerCase() || '');
        const formattedValue = showPerCapita ? value.toFixed(1) : formatNumber(value);
        const popText = showPerCapita && population ? `<span class="text-xs text-gray-400">(${formatNumber(population)} innb.)</span><br/>` : '';
        return `<strong>${name}</strong><br/>${formattedValue} ${label}<br/>${popText}<em>Klikk for detaljer</em>`;
    }, [showPerCapita, metric]);

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

    if (geoDataError) return <div className="h-[500px] flex items-center justify-center border rounded-xl"><ErrorState title="Feil" message={geoDataError} onRetry={() => setGeoData(null)} /></div>;
    if (!geoData) return <div className="h-[500px] bg-gray-100 rounded-xl flex items-center justify-center"><LoadingState message="Laster kart..." /></div>;
    if (isError) return <div className="h-[500px] flex items-center justify-center border rounded-xl"><ErrorState title="Feil" message="Noe gikk galt" onRetry={() => refetch()} /></div>;

    const metricLabel = showPerCapita ? 'Bedrifter pr 1000 innb.' : (METRIC_LABELS[metric] || 'Verdi');

    return (
        <div className="relative h-[500px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {/* Controls */}
            <div className="absolute top-20 left-2 z-1000 flex flex-col gap-2">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-1 flex">
                    <button onClick={() => { setLevel('county'); setSelectedCounty(''); }} className={`px-3 py-1.5 text-xs font-medium rounded ${level === 'county' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Fylker</button>
                    <button onClick={() => setLevel('municipality')} className={`px-3 py-1.5 text-xs font-medium rounded ${level === 'municipality' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Kommuner</button>
                </div>

                <button
                    onClick={() => setShowPerCapita(!showPerCapita)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg ${showPerCapita ? 'bg-purple-600 text-white' : 'bg-white/95 text-gray-700'}`}
                >
                    <Users className="h-3 w-3" />
                    Per innbygger
                </button>

            </div>

            {/* Refresh */}
            <div className="absolute top-4 right-4 z-1000">
                <button onClick={() => refetch()} className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-2 hover:bg-gray-50 disabled:opacity-50">
                    <RefreshCw className={`h-4 w-4 text-gray-600 ${isRefetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {selectedRegionData && (
                <RegionInfoPanel
                    regionData={selectedRegionData}
                    showPerCapita={showPerCapita}
                    metricLabel={METRIC_LABELS[metric] || 'Bedrifter'}
                    onClose={() => setSelectedRegion(null)}
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
                        setSelectedRegion(null);
                    }}
                />
            )}

            <MapContainer center={[65, 15]} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} className="bg-gray-50">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
                <NorwayBounds />
                <MapAutoZoomer selectedRegionCode={selectedRegion?.code || null} geoData={geoData} />
                {geoStats && <GeoJSON key={`${level}-${selectedNace}-${metric}-${selectedCounty}-${selectedRegion?.code || 'none'}`} data={geoData} style={style} onEachFeature={onEachFeature} />}
                <CompanyMarkers
                    naceCode={selectedNace || null}
                    countyCode={selectedCounty || (selectedRegion?.code?.length === 2 ? selectedRegion.code : undefined)}
                    municipalityName={level === 'municipality' && selectedRegionData && selectedRegionData.code.length === 4 ? selectedRegionData.name : undefined}
                    municipalityCode={level === 'municipality' && selectedRegionData && selectedRegionData.code.length === 4 ? selectedRegionData.code : undefined}
                    onCompanyClick={(orgnr) => onCompanyClick ? onCompanyClick(orgnr) : navigate({ to: '/bedrift/$orgnr', params: { orgnr } })}
                    organizationForms={organizationForms}
                    revenueMin={revenueMin}
                    revenueMax={revenueMax}
                    employeeMin={employeeMin}
                    employeeMax={employeeMax}
                />
            </MapContainer>

            <Legend maxValue={maxValue} metricLabel={metricLabel} />
            {!showPerCapita && <AveragesBox averages={averages} level={level} currentValue={hoveredRegion || undefined} />}
            {isLoading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-1001"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}
        </div>
    );
}
