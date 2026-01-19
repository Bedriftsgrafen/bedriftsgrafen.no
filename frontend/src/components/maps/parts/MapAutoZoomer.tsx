import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJsonObject, Geometry, FeatureCollection } from 'geojson';
import type { RegionProperties } from './types';

interface MapAutoZoomerProps {
    selectedRegionCode: string | null;
    geoData: GeoJsonObject | null;
}

export function MapAutoZoomer({ selectedRegionCode, geoData }: MapAutoZoomerProps) {
    const map = useMap();
    const prevGeoDataRef = useRef<GeoJsonObject | null>(null);
    const prevCodeRef = useRef<string | null>(null);

    useEffect(() => {
        // Only return early if BOTH the region code and the geoData layer haven't changed
        // This ensures re-zooming when switching map levels (new geoData)
        if (!selectedRegionCode || !geoData ||
            (selectedRegionCode === prevCodeRef.current && geoData === prevGeoDataRef.current)) {
            prevCodeRef.current = selectedRegionCode;
            prevGeoDataRef.current = geoData;
            return;
        }

        // Find all features for the selected region (could be multiple municipalities in a county)
        const featureCollection = geoData as FeatureCollection<Geometry, RegionProperties>;
        const features = featureCollection.features;
        const matchingFeatures = features.filter(f => {
            const code = f.properties.kommunenummer || f.properties.fylkesnummer || f.properties.id;
            // Match if exact code OR if municipality's county code matches
            const isExactMatch = code === selectedRegionCode;
            const isCountyMatch = selectedRegionCode.length === 2 && (f.properties.fylkesnummer === selectedRegionCode || (code?.length === 4 && code.slice(0, 2) === selectedRegionCode));
            return isExactMatch || isCountyMatch;
        });

        if (matchingFeatures.length > 0) {
            // Create a temporary GeoJSON layer to get the combined bounds
            const layer = L.geoJSON(matchingFeatures);
            const bounds = layer.getBounds();

            if (bounds.isValid()) {
                map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 11,
                    animate: true,
                    duration: 1
                });
            }
        }

        prevCodeRef.current = selectedRegionCode;
    }, [selectedRegionCode, geoData, map]);

    return null;
}
