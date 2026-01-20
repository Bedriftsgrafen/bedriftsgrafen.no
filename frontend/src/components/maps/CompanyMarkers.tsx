/**
 * Company Markers Layer for IndustryMap
 * 
 * Displays clustered company markers when a NACE code is selected
 * and the map is zoomed in enough.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import useSupercluster from 'use-supercluster';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../utils/apiClient';
import { MapPin, Users } from 'lucide-react';
import { renderToString } from 'react-dom/server';

// Types
interface MapMarker {
    orgnr: string;
    navn: string;
    lat: number;
    lng: number;
    nace: string | null;
    ansatte: number | null;
}

interface MarkersResponse {
    markers: MapMarker[];
    total: number;
    truncated: boolean;
}

interface CompanyMarkersProps {
    naceCode: string | null;
    countyCode?: string | null;
    municipalityName?: string | null;
    municipalityCode?: string | null;
    onCompanyClick?: (orgnr: string) => void;
    // Extra analytical filters
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
    isBankrupt?: boolean | null;
    inLiquidation?: boolean | null;
    inForcedLiquidation?: boolean | null;
    hasAccounting?: boolean | null;
    query?: string | null;
}

// Minimum zoom level to show markers (lowered for earlier visibility)
const MIN_ZOOM_FOR_MARKERS = 6;

// Create cluster icon
function createClusterIcon(count: number, size: 'small' | 'medium' | 'large'): L.DivIcon {
    const sizeMap = {
        small: { width: 30, height: 30, fontSize: 11 },
        medium: { width: 40, height: 40, fontSize: 13 },
        large: { width: 50, height: 50, fontSize: 15 },
    };
    const s = sizeMap[size];

    return L.divIcon({
        html: `<div class="cluster-marker cluster-${size}">${count}</div>`,
        className: 'custom-cluster-icon',
        iconSize: L.point(s.width, s.height, true),
    });
}

// Create single company icon with Lucide icon - cached for performance
const companyIconCache = {
    withEmployees: null as L.DivIcon | null,
    withoutEmployees: null as L.DivIcon | null,
};

function getCompanyIcon(hasEmployees: boolean): L.DivIcon {
    const cacheKey = hasEmployees ? 'withEmployees' : 'withoutEmployees';

    if (!companyIconCache[cacheKey]) {
        const iconHtml = renderToString(
            <div className={`company-marker ${hasEmployees ? 'has-employees' : ''}`}>
                <MapPin size={24} />
            </div>
        );

        companyIconCache[cacheKey] = L.divIcon({
            html: iconHtml,
            className: 'custom-company-icon',
            iconSize: L.point(24, 24, true),
            iconAnchor: L.point(12, 24, true),
            popupAnchor: L.point(0, -24, true),
        });
    }

    return companyIconCache[cacheKey]!;
}

// Component to inject marker styles
function MarkerStyles() {
    useEffect(() => {
        const styleId = 'company-marker-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .custom-cluster-icon {
                background: transparent;
            }
            .cluster-marker {
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                color: white;
                font-weight: bold;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                border: 3px solid white;
            }
            .cluster-small {
                background: #3b82f6;
                width: 30px;
                height: 30px;
                font-size: 11px;
            }
            .cluster-medium {
                background: #f59e0b;
                width: 40px;
                height: 40px;
                font-size: 13px;
            }
            .cluster-large {
                background: #ef4444;
                width: 50px;
                height: 50px;
                font-size: 15px;
            }
            .custom-company-icon {
                background: transparent;
            }
            .company-marker {
                color: #3b82f6;
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
            }
            .company-marker.has-employees {
                color: #10b981;
            }
            .marker-popup {
                min-width: 200px;
            }
            .marker-popup h3 {
                font-weight: 600;
                margin-bottom: 4px;
                color: #1f2937;
            }
            .marker-popup .stat {
                display: flex;
                align-items: center;
                gap: 6px;
                color: #6b7280;
                font-size: 13px;
            }
        `;
        document.head.appendChild(style);
    }, []);

    return null;
}

// Hook to get map bounds
function useMapBounds() {
    const map = useMap();
    const [bounds, setBounds] = useState<{
        west: number;
        south: number;
        east: number;
        north: number;
    } | null>(null);
    const [zoom, setZoom] = useState(map.getZoom());

    useEffect(() => {
        const updateBounds = () => {
            const b = map.getBounds();
            setBounds({
                west: b.getWest(),
                south: b.getSouth(),
                east: b.getEast(),
                north: b.getNorth(),
            });
            setZoom(map.getZoom());
        };

        updateBounds();
        map.on('moveend', updateBounds);
        map.on('zoomend', updateBounds);

        return () => {
            map.off('moveend', updateBounds);
            map.off('zoomend', updateBounds);
        };
    }, [map]);

    return { bounds, zoom };
}

export function CompanyMarkers({
    naceCode,
    countyCode,
    municipalityName,
    municipalityCode,
    onCompanyClick,
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
    isBankrupt,
    inLiquidation,
    inForcedLiquidation,
    hasAccounting,
    query
}: CompanyMarkersProps) {
    const map = useMap();
    const { bounds, zoom } = useMapBounds();

    // Should we show markers?
    // Allow markers if we have NACE OR if we have other selective filters and are zoomed in
    const hasActiveFilters = Boolean(naceCode) || (organizationForms && organizationForms.length > 0) || Boolean(municipalityCode || countyCode);
    const shouldFetch = hasActiveFilters && zoom >= MIN_ZOOM_FOR_MARKERS && bounds;

    // Fetch markers from API
    const { data, isLoading, isError } = useQuery({
        queryKey: [
            'company-markers',
            naceCode,
            countyCode,
            municipalityCode || municipalityName,
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
            isBankrupt,
            inLiquidation,
            inForcedLiquidation,
            hasAccounting,
            query
        ],
        queryFn: async () => {
            const params: Record<string, string | number | boolean | string[] | null | undefined> = {};
            if (naceCode) params.naeringskode = naceCode;
            if (query) params.name = query;
            if (countyCode) params.county = countyCode;
            if (municipalityCode) params.municipality_code = municipalityCode;
            if (municipalityName) params.municipality = municipalityName;

            // Basic filters
            if (organizationForms?.length) params.organisasjonsform = organizationForms;

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
                if (min !== null && min !== undefined) params[`${name}_min`] = min;
                if (max !== null && max !== undefined) params[`${name}_max`] = max;
            });

            // Specific Dates
            if (foundedFrom) params.founded_from = foundedFrom;
            if (foundedTo) params.founded_to = foundedTo;
            if (bankruptFrom) params.bankrupt_from = bankruptFrom;
            if (bankruptTo) params.bankrupt_to = bankruptTo;

            // Status flags (explicitly check for boolean)
            if (isBankrupt !== null) params.is_bankrupt = isBankrupt;
            if (inLiquidation !== null) params.in_liquidation = inLiquidation;
            if (inForcedLiquidation !== null) params.in_forced_liquidation = inForcedLiquidation;
            if (hasAccounting !== null) params.has_accounting = hasAccounting;

            const { data } = await apiClient.get<MarkersResponse>('/v1/companies/markers', {
                params,
                paramsSerializer: {
                    indexes: null
                }
            });
            return data;
        },
        enabled: Boolean(shouldFetch),
        staleTime: 60_000, // Cache for 1 minute
        retry: 2,
    });

    // Convert markers to GeoJSON points for Supercluster
    const points = useMemo(() => {
        if (!data?.markers) return [];
        return data.markers.map(m => ({
            type: 'Feature' as const,
            properties: {
                cluster: false,
                orgnr: m.orgnr,
                navn: m.navn,
                ansatte: m.ansatte,
                nace: m.nace,
            },
            geometry: {
                type: 'Point' as const,
                coordinates: [m.lng, m.lat],
            },
        }));
    }, [data]);

    // Supercluster hook
    const { clusters, supercluster } = useSupercluster({
        points,
        bounds: bounds ? [bounds.west, bounds.south, bounds.east, bounds.north] : undefined,
        zoom,
        options: {
            radius: 60,
            maxZoom: 16,
            minPoints: 2, // Only cluster if 2+ points
        },
    });

    // Handle cluster click - zoom in
    const handleClusterClick = useCallback((clusterId: number, position: [number, number]) => {
        if (!supercluster) return;
        const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(clusterId), 18);
        map.setView(position, expansionZoom, { animate: true });
    }, [map, supercluster]);

    // Don't render if zoom is too low
    if (!shouldFetch) {
        return null;
    }

    // Error state - fail silently for markers (non-critical)
    if (isError) {
        return null;
    }

    // Loading state - subtle indicator only when data hasn't loaded yet
    if (isLoading && !data) {
        return null; // Don't block map, markers will appear when ready
    }

    return (
        <>
            <MarkerStyles />
            {clusters.map(cluster => {
                const [lng, lat] = cluster.geometry.coordinates;
                const properties = cluster.properties as { cluster?: boolean; point_count?: number; orgnr?: string; navn?: string; ansatte?: number | null };
                const isCluster = properties.cluster;
                const pointCount = properties.point_count || 0;

                if (isCluster) {
                    // Cluster marker
                    const size = pointCount < 10 ? 'small' : pointCount < 50 ? 'medium' : 'large';
                    return (
                        <Marker
                            key={`cluster-${cluster.id}`}
                            position={[lat, lng]}
                            icon={createClusterIcon(pointCount, size)}
                            eventHandlers={{
                                click: () => handleClusterClick(cluster.id as number, [lat, lng]),
                            }}
                        />
                    );
                }

                // Single company marker
                const { orgnr, navn, ansatte } = properties;
                if (!orgnr) return null; // Skip if no orgnr
                return (
                    <Marker
                        key={`marker-${orgnr}`}
                        position={[lat, lng]}
                        icon={getCompanyIcon(Boolean(ansatte))}
                    >
                        <Popup className="marker-popup">
                            <div className="marker-popup">
                                <h3>{navn}</h3>
                                {ansatte && (
                                    <div className="stat">
                                        <Users size={14} />
                                        {ansatte} ansatte
                                    </div>
                                )}
                                <button
                                    onClick={() => onCompanyClick?.(orgnr)}
                                    className="mt-2 text-sm text-blue-600 hover:underline"
                                >
                                    Vis bedrift →
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {/* Show truncation warning */}
            {data?.truncated && (
                <div
                    className="absolute bottom-4 left-4 bg-yellow-100 text-yellow-800 text-sm px-3 py-2 rounded-lg shadow z-1000"
                    style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000 }}
                >
                    Viser {data.markers.length} av {data.total} bedrifter. Zoom inn for å se flere.
                </div>
            )}
        </>
    );
}
