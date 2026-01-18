import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MapAutoZoomer } from '../parts/MapAutoZoomer';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { FeatureCollection } from 'geojson';

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
    useMap: vi.fn(),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
    default: {
        geoJSON: vi.fn().mockReturnValue({
            getBounds: vi.fn().mockReturnValue({
                isValid: vi.fn().mockReturnValue(true),
            }),
        }),
    },
}));

describe('MapAutoZoomer', () => {
    const mockMap = {
        fitBounds: vi.fn(),
    };

    const mockGeoData = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: { id: '0301', name: 'Oslo' },
                geometry: { type: 'Point', coordinates: [10, 60] },
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // @ts-expect-error - mockMap is simplified for testing
        (useMap as vi.Mock).mockReturnValue(mockMap);
    });

    it('should call fitBounds when a valid region code is provided', () => {
        render(<MapAutoZoomer selectedRegionCode="0301" geoData={mockGeoData as unknown as FeatureCollection} />);

        expect(mockMap.fitBounds).toHaveBeenCalled();
        expect(L.geoJSON).toHaveBeenCalledWith([mockGeoData.features[0]]);
    });

    it('should zoom to all municipalities when a county code (2 digits) is provided', () => {
        const mockCountyGeoData = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { kommunenummer: '0301', fylkesnummer: '03' },
                    geometry: { type: 'Point', coordinates: [10, 60] },
                },
                {
                    type: 'Feature',
                    properties: { kommunenummer: '0302', fylkesnummer: '03' },
                    geometry: { type: 'Point', coordinates: [11, 61] },
                }
            ],
        };

        render(<MapAutoZoomer selectedRegionCode="03" geoData={mockCountyGeoData as unknown as FeatureCollection} />);

        expect(mockMap.fitBounds).toHaveBeenCalled();
        // Should match both features
        expect(L.geoJSON).toHaveBeenCalledWith(mockCountyGeoData.features);
    });

    it('should not call fitBounds when region code is null', () => {
        render(<MapAutoZoomer selectedRegionCode={null} geoData={mockGeoData as unknown as FeatureCollection} />);

        expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });

    it('should not call fitBounds when geoData is null', () => {
        render(<MapAutoZoomer selectedRegionCode="0301" geoData={null} />);

        expect(mockMap.fitBounds).not.toHaveBeenCalled();
    });
});
