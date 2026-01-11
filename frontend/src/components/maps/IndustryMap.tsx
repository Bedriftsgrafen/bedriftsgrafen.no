import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { GeoJsonObject, Feature, Geometry } from 'geojson';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../../utils/apiClient';
import { formatNumber } from '../../utils/formatters';
import { RefreshCw, ExternalLink, Users } from 'lucide-react';
import { CompanyMarkers } from './CompanyMarkers';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';

// ============================================================================
// Types
// ============================================================================

interface GeoStat {
    code: string;
    name: string;
    value: number;
    population?: number;
    companies_per_capita?: number;
}

interface GeoAverages {
    national_avg: number;
    national_total: number;
    county_avg?: number;
    county_total?: number;
    county_name?: string;
}

interface RegionProperties {
    id: string;
    name: string;
    fylkesnummer?: string;
    fylkesnavn?: string;
    kommunenummer?: string;
    kommunenavn?: string;
}

type GeoLevel = 'county' | 'municipality';

interface IndustryMapProps {
    selectedNace?: string | null;
    metric?: 'company_count' | 'new_last_year' | 'bankrupt_count';
    onRegionClick?: (regionName: string, regionCode: string, level: GeoLevel) => void;
    onSearchClick?: (regionName: string, regionCode: string, naceCode: string | null) => void;
    onCompanyClick?: (orgnr: string) => void;
}

// County codes for dropdown
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

// ============================================================================
// Color Scale
// ============================================================================

const getColor = (value: number, max: number): string => {
    if (max === 0) return '#f7fafc';
    const ratio = value / max;

    // Blue color scale (light to dark)
    if (ratio > 0.8) return '#1e40af';
    if (ratio > 0.6) return '#2563eb';
    if (ratio > 0.4) return '#3b82f6';
    if (ratio > 0.2) return '#60a5fa';
    if (ratio > 0.1) return '#93c5fd';
    if (ratio > 0) return '#bfdbfe';
    return '#f7fafc';
};

// Metric labels (outside component to prevent recreation)
const METRIC_LABELS: Readonly<Record<string, string>> = {
    company_count: 'Antall bedrifter',
    new_last_year: 'Nye siste år',
    bankrupt_count: 'Konkurser',
} as const;

// ============================================================================
// Map Bounds Component
// ============================================================================

function SetBoundsToNorway() {
    const map = useMap();

    useEffect(() => {
        map.fitBounds([
            [57.5, 4.5],   // Southwest
            [71.5, 31.5]   // Northeast
        ]);
    }, [map]);

    return null;
}

// ============================================================================
// Legend Component
// ============================================================================

function Legend({ maxValue, metricLabel }: { maxValue: number; metricLabel: string }) {
    const steps = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1];

    return (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-1000">
            <div className="text-xs font-medium text-gray-700 mb-2">{metricLabel}</div>
            <div className="flex gap-1">
                {steps.map((ratio, i) => (
                    <div key={i} className="flex flex-col items-center">
                        <div
                            className="w-5 h-4 border border-gray-200"
                            style={{ backgroundColor: getColor(ratio * maxValue, maxValue) }}
                        />
                        {i === 0 && <span className="text-[10px] text-gray-500 mt-1">0</span>}
                        {i === steps.length - 1 && (
                            <span className="text-[10px] text-gray-500 mt-1">
                                {maxValue >= 1000 ? `${Math.round(maxValue / 1000)}k` : parseFloat(maxValue.toFixed(1))}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Averages Info Box
// ============================================================================

function AveragesBox({ averages, level, currentValue }: {
    averages?: GeoAverages;
    level: GeoLevel;
    currentValue?: { name: string; value: number };
}) {
    if (!averages) return null;

    const formatNum = (n: number) => formatNumber(n);

    return (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-1000 min-w-[180px]">
            <div className="text-xs font-medium text-gray-700 mb-2">
                {level === 'county' ? 'Fylkessammenligning' : 'Kommunesammenligning'}
            </div>

            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-600">Landssnitt:</span>
                    <span className="font-medium">{formatNumber(Math.round(averages.national_avg))}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Landstotal:</span>
                    <span className="font-medium">{formatNumber(averages.national_total)}</span>
                </div>

                {averages.county_avg !== undefined && (
                    <>
                        <hr className="my-1 border-gray-200" />
                        <div className="flex justify-between">
                            <span className="text-gray-600">{averages.county_name} snitt:</span>
                            <span className="font-medium">{formatNum(Math.round(averages.county_avg))}</span>
                        </div>
                    </>
                )}

                {currentValue && (
                    <>
                        <hr className="my-1 border-gray-200" />
                        <div className="flex justify-between text-blue-600">
                            <span className="font-medium">{currentValue.name}:</span>
                            <span className="font-bold">{formatNum(currentValue.value)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function IndustryMap({ selectedNace, metric = 'company_count', onRegionClick, onSearchClick, onCompanyClick }: IndustryMapProps) {
    const navigate = useNavigate();
    const [level, setLevel] = useState<GeoLevel>('county');
    const [selectedCounty, setSelectedCounty] = useState<string>('');
    const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
    const [geoDataError, setGeoDataError] = useState<string | null>(null);
    const [hoveredRegion, setHoveredRegion] = useState<{ name: string; value: number } | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<{ name: string; code: string; value: number; perCapita?: number; population?: number } | null>(null);
    const [showPerCapita, setShowPerCapita] = useState(false);

    // Fetch GeoJSON based on level (with AbortController for cleanup)
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
                    console.error('Failed to load GeoJSON:', err);
                    setGeoDataError('Kunne ikke laste kartdata');
                    setGeoData(null);
                }
            });

        return () => abortController.abort();
    }, [level]);

    // Fetch geographic stats
    const { data: geoStats, isLoading, isError, refetch, isRefetching } = useQuery<GeoStat[]>({
        queryKey: ['geographyStats', level, selectedNace, metric, selectedCounty],
        queryFn: async () => {
            const params = new URLSearchParams({ level, metric });
            if (selectedNace) params.set('nace', selectedNace);
            if (level === 'municipality' && selectedCounty) params.set('county_code', selectedCounty);
            const { data } = await apiClient.get<GeoStat[]>(`/v1/stats/geography?${params}`);
            return data;
        },
        staleTime: 1000 * 60 * 30,
        retry: 2,
    });

    // Fetch averages
    const { data: averages } = useQuery<GeoAverages>({
        queryKey: ['geographyAverages', level, selectedNace, metric, selectedCounty],
        queryFn: async () => {
            const params = new URLSearchParams({ level, metric });
            if (selectedNace) params.set('nace', selectedNace);
            if (level === 'municipality' && selectedCounty) params.set('county_code', selectedCounty);
            const { data } = await apiClient.get<GeoAverages>(`/v1/stats/geography/averages?${params}`);
            return data;
        },
        staleTime: 1000 * 60 * 30,
    });

    // Create lookup map
    const statsMap = useMemo(() => {
        const map = new Map<string, GeoStat>();
        geoStats?.forEach(stat => map.set(stat.code, stat));
        return map;
    }, [geoStats]);

    // Get value for a given stat (handles per-capita switch)
    const getValue = useCallback((stat?: GeoStat) => {
        if (!stat) return 0;
        if (showPerCapita) return stat.companies_per_capita || 0;
        return stat.value;
    }, [showPerCapita]);

    // Calculate max value dynamically
    const maxValue = useMemo(() => {
        if (!geoStats?.length) return 0;
        return Math.max(...geoStats.map(s => getValue(s)));
    }, [geoStats, getValue]);

    // Style function for GeoJSON features (memoized to prevent re-renders)
    const style = useCallback((feature: Feature<Geometry, RegionProperties> | undefined) => {
        if (!feature?.properties) return {};
        const code = feature.properties.kommunenummer || feature.properties.fylkesnummer || feature.properties.id;
        const stat = statsMap.get(code);
        const value = getValue(stat);

        // If this region is selected, show only outline (no fill)
        const isSelected = selectedRegion?.code === code;

        return {
            fillColor: getColor(value, maxValue),
            weight: isSelected ? 2 : (level === 'county' ? 1 : 0.5),
            opacity: 1,
            color: isSelected ? '#1e40af' : '#64748b',
            fillOpacity: isSelected ? 0 : 0.5,  // No fill on selected region
        };
    }, [statsMap, maxValue, level, getValue, selectedRegion?.code]);

    // Memoize tooltip generation to reduce re-renders
    const generateTooltip = useCallback((name: string, value: number, population?: number) => {
        const label = showPerCapita ? `${(METRIC_LABELS[metric] || 'Verdi').toLowerCase()} per 1000 innb.` : (METRIC_LABELS[metric]?.toLowerCase() || '');
        const formattedValue = showPerCapita ? value.toFixed(1) : formatNumber(value);
        const popText = showPerCapita && population ? `<span class="text-xs text-gray-400">(${formatNumber(population)} innb.)</span><br/>` : '';
        return `<strong>${name}</strong><br/>${formattedValue} ${label}<br/>${popText}<em>Klikk for detaljer</em>`;
    }, [showPerCapita, metric]);

    // Memoize level toggle handlers
    const handleSetCountyLevel = useCallback(() => {
        setLevel('county');
        setSelectedCounty('');
    }, []);

    const handleSetMunicipalityLevel = useCallback(() => {
        setLevel('municipality');
    }, []);

    const handleTogglePerCapita = useCallback(() => {
        setShowPerCapita(prev => !prev);
    }, []);

    // Event handlers for GeoJSON features
    const onEachFeature = useCallback((feature: Feature<Geometry, RegionProperties>, layer: L.Layer) => {
        const code = feature.properties.kommunenummer || feature.properties.fylkesnummer || feature.properties.id;
        const name = feature.properties.kommunenavn || feature.properties.fylkesnavn || feature.properties.name;
        const stat = statsMap.get(code);
        const value = getValue(stat);

        layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
                const target = e.target;
                target.setStyle({ weight: 3, color: '#1e40af', fillOpacity: 0.7 });
                target.bringToFront();
                setHoveredRegion({ name, value });
            },
            mouseout: (e: L.LeafletMouseEvent) => {
                const target = e.target;
                // Only reset to default style if this region is NOT selected
                const isThisSelected = selectedRegion?.code === code;
                target.setStyle({
                    weight: isThisSelected ? 2 : (level === 'county' ? 1 : 0.5),
                    color: isThisSelected ? '#1e40af' : '#64748b',
                    fillOpacity: isThisSelected ? 0 : 0.5
                });
                setHoveredRegion(null);
            },
            click: (e: L.LeafletMouseEvent) => {
                // Set fill opacity to 0 on selected region to show terrain
                const target = e.target;
                target.setStyle({ fillOpacity: 0, weight: 2, color: '#1e40af' });

                setSelectedRegion({
                    name,
                    code,
                    value: stat?.value || 0,
                    perCapita: stat?.companies_per_capita,
                    population: stat?.population
                });
                onRegionClick?.(name, code, level);
            },
        });

        layer.bindTooltip(
            generateTooltip(name, value, stat?.population),
            { sticky: true, className: 'region-tooltip' }
        );
    }, [statsMap, level, onRegionClick, getValue, generateTooltip, selectedRegion]);

    // GeoJSON error state
    if (geoDataError) {
        return (
            <div className="h-[500px] flex items-center justify-center">
                <ErrorState
                    title="Kunne ikke laste kartdata"
                    message={geoDataError}
                    onRetry={() => {
                        setGeoDataError(null);
                        setGeoData(null);
                        // Trigger re-fetch by toggling level
                        setLevel(prev => prev);
                    }}
                />
            </div>
        );
    }

    // GeoJSON loading state
    if (!geoData) {
        return (
            <div className="h-[500px] flex items-center justify-center bg-gray-100 rounded-xl">
                <LoadingState message="Laster kart..." className="bg-transparent border-0 shadow-none" />
            </div>
        );
    }

    // Error state
    if (isError) {
        return (
            <div className="h-[500px] flex items-center justify-center">
                <ErrorState
                    title="Kunne ikke laste kartdata"
                    message="Prøv igjen om litt"
                    onRetry={() => refetch()}
                />
            </div>
        );
    }

    return (
        <div className="relative h-[500px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {/* Controls - positioned below Leaflet zoom controls */}
            <div className="absolute top-20 left-2 z-1000 flex flex-col gap-2">
                {/* Level toggle */}
                <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-1 flex">
                    <button
                        onClick={handleSetCountyLevel}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${level === 'county'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Fylker
                    </button>
                    <button
                        onClick={handleSetMunicipalityLevel}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${level === 'municipality'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Kommuner
                    </button>
                </div>

                {/* Per Capita Toggle */}
                {(level === 'municipality' || level === 'county') && (
                    <button
                        onClick={handleTogglePerCapita}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg shadow-lg transition-colors ${showPerCapita
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/95 text-gray-700 hover:bg-gray-50'
                            }`}
                        title="Vis antall bedrifter per 1000 innbyggere"
                    >
                        <Users className="h-3 w-3" />
                        {showPerCapita ? 'Per innbygger' : 'Per innbygger'}
                    </button>
                )}

                {/* County filter (only for municipality level) */}
                {level === 'municipality' && (
                    <select
                        value={selectedCounty}
                        onChange={(e) => setSelectedCounty(e.target.value)}
                        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-2 py-1.5 text-xs border-0 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Hele landet</option>
                        {COUNTIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Refresh button */}
            <div className="absolute top-4 right-4 z-1000">
                <button
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Oppdater data"
                >
                    <RefreshCw className={`h-4 w-4 text-gray-600 ${isRefetching ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Selected region info panel - top right corner */}
            {selectedRegion && (
                <div className="absolute top-14 right-4 z-1000 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 min-w-[200px]">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-sm font-medium text-gray-900">{selectedRegion.name}</div>
                            <div className="text-lg font-bold text-blue-600">
                                {showPerCapita && selectedRegion.perCapita != null
                                    ? selectedRegion.perCapita.toFixed(1)
                                    : formatNumber(selectedRegion.value)}
                                <span className="text-xs font-normal text-gray-500 ml-1">
                                    {showPerCapita ? `per 1000 innb.` : (METRIC_LABELS[metric]?.toLowerCase() || 'bedrifter')}
                                </span>
                            </div>
                            {selectedRegion.population && (
                                <div className="text-xs text-gray-500 mt-1">
                                    Befolkning: {formatNumber(selectedRegion.population)}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedRegion(null)}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            if (onSearchClick) {
                                onSearchClick(selectedRegion.name, selectedRegion.code, selectedNace || null);
                            } else {
                                // Fallback: store in session and navigate
                                // Extract just Norwegian name (remove Sami name if present)
                                const cleanName = selectedRegion.name.split(' - ')[0].trim();
                                const isCounty = selectedRegion.code.length === 2;

                                sessionStorage.setItem('mapFilter', JSON.stringify({
                                    county: isCounty ? selectedRegion.code : '',
                                    municipality: isCounty ? '' : cleanName,
                                    nace: selectedNace,
                                }));
                                navigate({ to: '/bransjer', search: { nace: selectedNace || undefined } });
                            }
                            setSelectedRegion(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Vis bedrifter
                    </button>
                </div>
            )}

            {/* Map */}
            <MapContainer
                center={[65, 15]}
                zoom={4}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
                className="bg-gray-50"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                />
                <SetBoundsToNorway />
                {geoStats && (
                    <GeoJSON
                        key={`${level}-${selectedNace}-${metric}-${selectedCounty}-${selectedRegion?.code || 'none'}`}
                        data={geoData}
                        style={style}
                        onEachFeature={onEachFeature}
                    />
                )}
                {/* Company markers - shown when zoomed in with NACE filter */}
                <CompanyMarkers
                    naceCode={selectedNace || null}
                    countyCode={level === 'municipality' && selectedCounty ? selectedCounty : undefined}
                    onCompanyClick={(orgnr) => {
                        if (onCompanyClick) {
                            // Parent handles the click (modal overlay)
                            onCompanyClick(orgnr);
                        } else {
                            // Fallback to navigation
                            navigate({ to: '/bedrift/$orgnr', params: { orgnr } });
                        }
                    }}
                />
            </MapContainer>

            {/* Legend */}
            <Legend maxValue={maxValue} metricLabel={showPerCapita ? 'Bedrifter pr 1000 innb.' : (METRIC_LABELS[metric] || 'Verdi')} />

            {/* Averages */}
            {!showPerCapita && <AveragesBox averages={averages} level={level} currentValue={hoveredRegion || undefined} />}

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-1001">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            )}
        </div>
    );
}
